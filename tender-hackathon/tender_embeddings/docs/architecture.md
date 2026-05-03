# Architecture

> **One-line summary.** Read the collector's exports, chunk text, embed locally with sentence-transformers, store as SQLite + numpy, query with cosine similarity. No external API calls.

---

## Why a separate package

The collector ([`../public_tender_collector/`](../public_tender_collector/)) is **compliance-only**. Its operating contract forbids "LLM calls of any kind inside the collector" and forbids credential storage. Embeddings are a downstream concern, not a collection concern, so we put them in a sibling package.

The boundary is enforced by the file system: `tender_embeddings/` only ever **reads** from `../public_tender_collector/data/exports/`. It never writes back, never imports from `collector.*`, never knows the collector's database. If a future contributor wants to add cloud embeddings, they build a third package — they don't reach into either of these.

---

## Data flow

```
                ┌────────────────────────────────────┐
                │  public_tender_collector exports   │
                │  data/exports/<run_id>/            │
                │    training_manifest.jsonl         │
                │    document_metadata.csv  (fallback)│
                │  data/processed/<doc_id>.txt       │
                └─────────────┬──────────────────────┘
                              │ READ-ONLY
                              ▼
               ┌──────────────────────────────────┐
               │  manifest_reader.py              │
               │  read_training_manifest()        │
               │  iter_extracted_texts()          │
               └──────────────┬───────────────────┘
                              │
                              ▼
               ┌──────────────────────────────────┐
               │  chunker.py                      │
               │  chunk_text(doc_id, text)        │
               │   ├─ paragraph split             │
               │   └─ long-paragraph sentence cut │
               └──────────────┬───────────────────┘
                              │ Chunk[] (text + char_offset + ordinal)
                              ▼
               ┌──────────────────────────────────┐
               │  embedder.py                     │
               │   ├─ SentenceTransformerEmbedder │  ← production
               │   └─ HashEmbedder                │  ← deterministic, tests
               │  L2-normalises every vector      │
               └──────────────┬───────────────────┘
                              │ (N, dim) float32
                              ▼
               ┌──────────────────────────────────┐
               │  index.py                        │
               │  VectorIndex                     │
               │   ├─ meta.sqlite (chunk rows)    │
               │   ├─ vectors.npy (float32 mmap)  │
               │   └─ manifest.json               │
               │  Idempotent .add() — reuses      │
               │  row_index slots on rebuild      │
               └──────────────┬───────────────────┘
                              │
                              ▼
               ┌──────────────────────────────────┐
               │  matcher.py                      │
               │  Matcher                         │
               │   ├─ query(text, top_k, ...)     │
               │   └─ match_tender(tid, top_k)    │
               │  Cosine = dot product            │
               └──────────────────────────────────┘
                              │
                              ▼
                       Typer CLI (main.py)
```

---

## Module rationale

### `manifest_reader.py`

Read-only loader for the collector's export bundle. Two entry points:

- `read_training_manifest(exports_root, run_id)` — primary path. Returns the curated rows (those that scored ≥60 in collector relevance).
- `read_document_metadata(...)` — fallback. Used when the training manifest is empty (no document met the relevance threshold). Reconstructs `ManifestRow` objects from the broader `document_metadata.csv`.

The fallback matters: in the live verification run, none of the 7 small fixture PDFs scored high enough for the collector to recommend them for training, so the training manifest was empty. Without the fallback, `build` would index zero documents.

### `chunker.py`

Pure function: text in, `Chunk[]` out. No HTTP, no model.

- Splits on blank-line paragraphs first (cheap and faithful to PDF structure).
- Long paragraphs split at sentence boundaries.
- A sentence longer than `target_chars * 1.5` is hard-wrapped — extreme edge case.
- `min_chars`-driven backward-merge is **off by default** (it produced surprising test failures and short paragraphs in tender docs are often meaningful — one-line clauses, dates, references).

`Chunk.chunk_id = f"{document_id}::{ordinal}"`. Stable across rebuilds, which is what makes idempotent re-indexing possible.

### `embedder.py`

Two implementations behind a `Protocol`:

| Class | Use | Cost |
|---|---|---|
| `SentenceTransformerEmbedder` | Production. Wraps a HuggingFace model (`all-MiniLM-L6-v2` default). | One-time ~80 MB model download; ~5 ms/sentence on CPU; vectors are 384-dim float32. |
| `HashEmbedder` | Tests, smoke runs. | Zero deps beyond numpy. Hashes tokens with blake2b into bins; not semantically meaningful but enough to verify the pipeline end-to-end offline. |

Both return `(N, dim)` float32 arrays, **L2-normalised**. That's the contract — every consumer can assume cosine similarity collapses to a dot product.

### `index.py`

`VectorIndex` is a single-writer SQLite + sidecar `vectors.npy` store under one directory.

- `meta.sqlite` holds chunk rows + denormalised document metadata (so query results don't need a join).
- `vectors.npy` is loaded with `mmap_mode="r"` for queries — RAM stays bounded.
- `add(records, vectors)` is **truly idempotent**: a `chunk_id` seen before reuses its `row_index` slot (vector overwritten in place). Only genuinely new `chunk_id`s extend the file. A no-change rebuild leaves `vectors.npy` byte-identical-sized.
- `manifest.json` records the embedder name, dimension, chunk count, doc count, build time. Used by the `status` command and by future schema-migration logic.

### `matcher.py`

`Matcher.query(text, top_k=...)`:

1. Embed the query (`(1, dim)`).
2. Score = `vectors @ q` (1 BLAS call, vectorised).
3. `argsort(-scores)`, walk in order, apply `source_id` / `classified_type` filters, return up to `top_k` `Hit`s.
4. Each `Hit` carries the full `ChunkRecord` (text + metadata).

`Matcher.match_tender(tender_id)`:

1. Look up all chunks that belong to the source tender.
2. Compute their centroid; L2-normalise.
3. Score every other chunk against the centroid.
4. Group hits by `tender_id`, take the top `chunks_per_tender` per group.
5. Tender-level score = mean of those grouped chunk scores.

Centroid + group-by-tender + cap-per-tender is the simplest aggregation that handles tenders with very different document counts (one tender with 30 chunks doesn't drown out one with 3).

### `builder.py`

Orchestration only. Reads → chunks → batches → embeds → adds → writes manifest. The batch size matters because `sentence-transformers` is much faster per-document at batch=32-64 than one-by-one.

### `main.py` (Typer CLI)

Four commands: `build`, `query`, `match-tender`, `status`. Every command has a `--hash-fallback` flag for offline smoke testing without the model file. Every output command supports `--json` for machine consumption.

---

## Idempotency, in detail

| Property | Achieved by |
|---|---|
| Same documents → same chunks | `chunk_text` is deterministic; `chunk_id` is `(document_id, ordinal)`. |
| Same chunks → same vectors (HashEmbedder) | Byte-identical embedding from byte-identical text. |
| Same chunks → near-identical vectors (SentenceTransformer) | Model is deterministic for the same input. |
| Re-running `build` doesn't grow the file | `index.add()` reuses existing `row_index` slots when the `chunk_id` is known; only new `chunk_id`s append. Verified by `test_idempotent_rebuild`. |
| Re-running `build` doesn't duplicate DB rows | Existing `chunk_id` rows are UPDATEd in place; only new ones are INSERTed. |

---

## Threat model and what we deliberately don't do

- **No outbound HTTP at runtime.** Embedding happens locally. The only outbound call is the one-time HuggingFace model download, which is gated by your normal `~/.cache/huggingface/` cache.
- **No credentials.** No env-var reads of `OPENAI_API_KEY` / `HF_TOKEN` / anything. If you need a private model, configure HuggingFace's CLI separately and let the cache take care of auth.
- **No writes to the collector's data tree.** `manifest_reader.py` opens files read-only. The only files this package writes are under `data/index/`.
- **No second `Embedder` class that calls out.** If a future contributor wants OpenAI embeddings, that's a separate package — adding a third class here would silently break the package's promise.

---

## Where to extend

- **A different local model:** pass `--model <hf-name>`. The wrapper handles arbitrary sentence-transformers compatible models. Vector dimension is auto-detected.
- **GPU:** pass `device="cuda"` to `SentenceTransformerEmbedder`. Default lets the library decide (usually CPU on a hackathon laptop).
- **A faster ANN backend (FAISS / hnswlib):** replace `Matcher`'s `vectors @ q` with the ANN search call. The `(N, dim)` matrix in `vectors.npy` is FAISS-flat-index-compatible.
- **A new output format for the collector:** update `manifest_reader.read_training_manifest`. Keep that as the only place the collector's schema is decoded.

---

## Verified live run (recap)

The pipeline was end-to-end verified during development against the collector's local-fixture HTTP server:

```
collector demo            → 7 PDFs / 7 OK extractions / data/exports/<run>/training_manifest.jsonl
tender-embeddings build   → 13 chunks, 384-dim, all-MiniLM-L6-v2
tender-embeddings query   → semantic ranking matches intent (marine ↔ marine, evaluation ↔ evaluation)
tender-embeddings query --type Technical_Specifications → metadata filter applied correctly
```

Quality gate: 15/15 pytest, ruff clean, mypy strict clean.
