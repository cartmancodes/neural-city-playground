# Tender Embeddings

> Local sentence-transformers embeddings + cosine search over the public-tender-collector's exports. **No external API calls. No OpenAI. No credentials.** The model file is downloaded once from HuggingFace and then the package runs entirely offline.

## What this is

Reads the collector's `data/exports/<run_id>/training_manifest.jsonl` (read-only), chunks each tender's extracted text, embeds each chunk with a local sentence-transformers model, and writes a small SQLite + numpy index. Then you can:

- **Free-text query** the corpus (`tender-embeddings query "..."`).
- **Match a tender** to other semantically similar tenders (`tender-embeddings match-tender <tender_id>`).

The collector and the embedder are deliberately separate packages: the collector stays compliance-only (no ML calls inside), and the embedder stays a pure consumer (read-only against the collector's exports).

## Why local

- **No data leaves the machine.** Document content is embedded on-device; the only outbound network call is the one-time model download from HuggingFace (~80 MB for `all-MiniLM-L6-v2`).
- **No credentials.** This package never reads `OPENAI_API_KEY` or any other key. If you want OpenAI embeddings instead, build a separate component — don't add an external API call inside this one.
- **Determinism.** Same input bytes → same vectors. The full quality gate (mypy strict + ruff + pytest) runs offline using the deterministic `HashEmbedder`, so CI never needs the real model file.

## Quick start

```bash
cd tender_embeddings
python3.13 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# 1. Build an index from the latest collector run.
#    On first call this downloads the model (~80 MB, one-time).
python main.py build

# 2. Free-text query
python main.py query "marine berthing structure" --top-k 5
python main.py query "evaluation criteria for similar work" --top-k 5
python main.py query "steel grade" --type Technical_Specifications

# 3. Find tenders similar to a known tender_id (look one up in the collector DB)
python main.py match-tender 7fa83df821071190 --top-k 5

# 4. Inspect the index
python main.py status
```

All commands accept `--index-dir <path>` (default `data/index/`), `--exports <path>` (default `../public_tender_collector/data/exports`), and `--hash-fallback` (use the deterministic test embedder instead of the real model).

## Verified live run

The end-to-end pipeline was exercised against the collector's local-fixture run during development:

| Step | Outcome |
|---|---|
| Collector demo against fixture server | 7 PDFs downloaded, 7 extractions OK |
| `tender-embeddings build` (real `all-MiniLM-L6-v2`, 384-dim) | 13 chunks indexed across 7 documents |
| `query "marine berthing structure"` | Top 3: Tender_Document (0.436), Tender_Document (0.387), Technical_Specifications (0.282) — correctly ranks the docs that describe berthing above the steel-grade spec |
| `query "bid evaluation similar work qualification"` | Top 3: TDS (0.485), Corrigendum (0.482), Evaluation_Qualification_Criteria (0.435) — clusters the three evaluation-related documents |
| `query --type Technical_Specifications` | Filter applied; only matching chunks returned |

## Tech stack

- **Embedding model:** `sentence-transformers/all-MiniLM-L6-v2` by default (384-dim, ~80 MB). Override with `--model <hf-name>`.
- **Storage:** SQLite (chunk metadata) + a sidecar `vectors.npy` mmap'd float32 matrix. Cosine similarity = dot product because vectors are L2-normalised on insert.
- **CLI:** Typer 0.19 + Rich tables + JSON output mode.
- **Tests:** pytest, fully offline via `HashEmbedder`. 15 tests in 0.1 seconds.

## Layout

```
tender_embeddings/
├── README.md                     # this file
├── docs/
│   └── architecture.md           # design rationale + module map
├── pyproject.toml
├── main.py                       # Typer CLI
├── tender_embeddings/
│   ├── chunker.py                # paragraph + sentence chunker
│   ├── embedder.py               # SentenceTransformerEmbedder + HashEmbedder
│   ├── index.py                  # SQLite + numpy on-disk vector store
│   ├── matcher.py                # query() + match_tender()
│   ├── builder.py                # orchestration (read manifest → chunk → embed → index)
│   └── manifest_reader.py        # read-only access to collector exports
├── tests/                        # 15 offline tests
└── data/index/                   # index files (created on first build)
```

## What this package will NOT do

- **No external API calls** at runtime. Period.
- **No reading of `OPENAI_API_KEY`** or any other credential env var. Not now, not later.
- **No writes to the collector's database or files.** Strictly read-only against `../public_tender_collector/data/`.
- **No "smart" auth/proxy layer** for the model download. Use your normal HuggingFace cache (`~/.cache/huggingface/`); if you're behind a proxy, configure it at the OS level.

If you need OpenAI / Anthropic / cloud embeddings, build a separate component **outside** this package. Don't add a third embedder class here that calls out — the test invariants would break and the package's "no external calls" promise would no longer hold.

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the design walkthrough.

## License & contact

Internal tool for the Andhra Pradesh RTGS Hackathon. See `pyproject.toml`. Contact: ops@example.com.
