# Verification Engine — Design

Date: 2026-04-30
Project: `hackathon-permissions/verification_engine/`

## 1. Purpose

Build a Python service that:

1. **Extracts** building compliance rules, multi-rule processes, and visual assets (diagrams/tables) from the *Andhra Pradesh Building Rules 2017* PDF into a strict JSON schema.
2. **Evaluates** building-permission applications against the extracted rules and reports pass / fail / manual-review per rule, with the original verbatim text linked for auditability.
3. Surfaces both via a small **Streamlit UI** so a hackathon reviewer can upload a PDF, watch the extraction, plug in a sample application, and see the verification report with linked diagrams.

The output JSON is the contract. The existing React prototype in `hackathon-permissions/app/` keeps its own `demoRules.json` for now; future integration is out of scope but the schema is designed to be drop-in compatible.

## 2. Non-goals

- Replacing the React app's existing rule engine.
- Real production-grade officer auth / RBAC.
- Live legal advice. The UI must keep the existing language: "Preliminary Scrutiny Result", not "Final Approval".
- Coverage of the entire rulebook on the first pass — partial extraction with high-confidence rules is acceptable; missing rules just don't get enforced.

## 3. Output JSON contract

Verbatim from `verification_engine_prompt.txt` — three top-level arrays: `Rules`, `Processes`, `Visual_Assets`.

- **Rules[]**: `rule_id`, `description`, `required_inputs` (dict of var → type), `python_logic` (pseudo-code string, not Python), `rule_specific_documents`, `verbatim_chunk`, `associated_assets`.
- **Processes[]**: `process_name`, `associated_rules`, `overall_documents_required`.
- **Visual_Assets[]**: `asset_id`, `asset_type` (Table | Diagram | Image), `page_number`, `interpretation`, `suggested_filename`.

Pydantic models in `schema/models.py` are the single source of truth. Anything that fails validation is surfaced to the user, not silently dropped.

## 4. Architecture

```
verification_engine/
  pyproject.toml
  .env.example                  # ANTHROPIC_API_KEY=...
  config.py                     # loads env + .env.local; exposes settings
  schema/
    models.py                   # Pydantic: Rule, Process, VisualAsset, ExtractionOutput
  extractor/
    pdf_reader.py               # PyMuPDF text + page-window splitter
    prompt.py                   # builds system + user prompts; cache-friendly
    llm_client.py               # Anthropic SDK wrapper, prompt caching, retry
    runner.py                   # orchestrates windows -> validate -> merge -> dedupe
  asset_extractor/
    pdf_assets.py               # given page_number list, crops images / tables
  engine/
    expression.py               # parser+evaluator for python_logic pseudo-code
    verifier.py                 # given Rules + application -> per-rule verdict
  ui/
    app.py                      # Streamlit: upload -> extract -> verify -> report
  tests/
    fixtures/
      mini_rulebook.pdf         # 3-page synthetic PDF built at test time
      mini_application.json
    test_schema.py
    test_expression.py
    test_runner_merge.py
    test_verifier.py
    test_asset_extractor.py
    test_end_to_end.py
  scripts/
    extract_rules.py            # CLI entry: pdf -> rules.json
    verify.py                   # CLI entry: rules.json + application.json -> report
output/
  rules.json
  assets/<suggested_filename>
```

### Data flow

```
PDF
 │
 ▼
extractor/pdf_reader.py ──► page windows (8 pages, 1 overlap)
 │
 ▼  (per window)
extractor/prompt.py ──► system+user prompt with cached system block
 │
 ▼
extractor/llm_client.py ──► Anthropic API (claude-opus-4-7 default)
 │
 ▼  (per window)
schema/models.py.parse ──► validated chunk OR error report
 │
 ▼
extractor/runner.py.merge ──► deduped Rules+Processes+Visual_Assets
 │
 ├──► output/rules.json
 │
 ▼
asset_extractor/pdf_assets.py ──► output/assets/<file>.png
 │
 ▼
engine/verifier.py(rules, application) ──► report.json
 │
 ▼
ui/app.py renders report
```

## 5. Component detail

### 5.1 Configuration (`config.py`)

- `ANTHROPIC_API_KEY` — required for extraction; not required for `engine` or `verifier` (those operate on already-extracted JSON).
- `EXTRACTION_MODEL` — default `claude-opus-4-7`, overridable.
- `WINDOW_PAGES` — default 8.
- `WINDOW_OVERLAP_PAGES` — default 1.
- `OUTPUT_DIR` — default `./output`.
- Loads from environment, then `.env.local` if present (gitignored). `.env.example` is committed.
- A `Settings` Pydantic-settings model so import-time access is typed.

### 5.2 Schema (`schema/models.py`)

Pydantic v2 models matching the prompt exactly. Strict mode (`extra="forbid"`) so model drift fails loudly. `RuleId` and `AssetId` are validated against `^[A-Z][A-Z0-9_]+$`. `python_logic` is stored as a string here; parsing happens in `engine/expression.py`.

### 5.3 Extractor (`extractor/`)

- **`pdf_reader.py`**: returns a list of `Page(number, text)` then a list of `Window(start, end, text)`.
- **`prompt.py`**: builds the system message (the verbatim instructions from `verification_engine_prompt.txt`) + a per-window user message with the window text. The system message is sent with `cache_control: ephemeral` so subsequent windows hit cache.
- **`llm_client.py`**: thin wrapper over `anthropic.Anthropic(api_key=...).messages.create(...)`. Retries on rate-limit / 5xx with exponential backoff. Returns the raw assistant text + token usage.
- **`runner.py`**:
  - For each window: call LLM, extract the JSON block from the assistant message, run `ExtractionOutput.model_validate_json`. On parse failure, log + skip that window, do not abort the run.
  - Merge: dedupe `Rules` by `rule_id` (first-wins), `Processes` by `process_name`, `Visual_Assets` by `asset_id`.
  - Cross-reference check (warn-only, never fail the run):
    - `Process.associated_rules` entries that don't match any merged `Rule.rule_id` are listed in a `warnings[]` field on the merged JSON.
    - `Rule.associated_assets` entries with no matching `VisualAsset.asset_id` are likewise warned.
  - Write merged JSON to `output/rules.json`.

### 5.4 Asset extractor (`asset_extractor/pdf_assets.py`)

For each `VisualAsset` in the merged JSON:
- Open the PDF page at `page_number - 1` (1-indexed → 0-indexed).
- For `asset_type == "Diagram"` or `"Image"`: extract the largest image on the page via `page.get_images()`, save as `output/assets/<suggested_filename>`.
- For `asset_type == "Table"`: render the page region as PNG (a table-detection library is overkill for prototype; we render the whole page if no specific bbox is recoverable, and the asset's `interpretation` field carries the read-coding logic).
- Skip and warn if the page doesn't have an extractable image.

### 5.5 Expression evaluator (`engine/expression.py`)

The `python_logic` field is pseudo-code, e.g. `IF plot_area > 100: REQUIRE setback >= 1.5`. We do **not** `eval` or `exec` this. Instead:

- Tokenizer recognises: identifiers (variables), numeric literals, comparators `>`, `>=`, `<`, `<=`, `==`, `!=`, boolean `AND`, `OR`, `NOT`, parens, keywords `IF`, `REQUIRE`, colon.
- Parser builds a small AST: `Rule := IF <cond> : REQUIRE <cond>` *or* a bare `REQUIRE <cond>` (no precondition).
- Evaluator takes a `dict[str, float|bool|str]` of inputs and returns `("pass" | "fail" | "manual_review", reason)`.
  - All identifiers in the parsed AST must be in the rule's declared `required_inputs`. Unknown identifier → `manual_review` with reason "missing input X".
  - Type mismatch → `manual_review`.
  - Otherwise normal boolean evaluation.

Anything outside this grammar (e.g. function calls, attribute access) raises `UnsupportedExpression` and the rule is reported as `manual_review` with a clear reason. This is the load-bearing safety boundary: a malicious or hallucinated `python_logic` can never execute arbitrary code.

### 5.6 Verifier (`engine/verifier.py`)

`verify(rules: list[Rule], application: dict) -> VerificationReport` where the report contains:

- `rule_id`, `status` (pass/fail/manual_review), `reason`, `verbatim_chunk`, `associated_assets`, `rule_specific_documents`.
- `summary`: counts per status, overall outcome (`auto_pass_eligible`, `needs_correction`, `needs_technical_review`, `manual_verification_required`) using the same labels the React app already uses.

### 5.7 Streamlit UI (`ui/app.py`)

Single-page app with three tabs:

1. **Extract**: PDF upload → "Run extraction" button → live token-usage counter → JSON preview → "Save to output/" button.
2. **Assets**: gallery of `output/assets/*` with `asset_id` and `interpretation` captions.
3. **Verify**: form fields auto-built from the union of `required_inputs` across all rules → "Run verification" button → per-rule report with status pill + verbatim_chunk + linked assets.

The same disclaimer text from the React prototype: "Preliminary Scrutiny Result. Final approval requires officer review."

## 6. Configuration & secrets

- `.env.example` committed with `ANTHROPIC_API_KEY=` and other settings (placeholder values).
- `.env.local` gitignored.
- The Streamlit UI also exposes a textbox at the top to paste an API key for the current session (overrides env). Useful for hackathon demos where the operator doesn't want to write a `.env`.
- Missing key behaviour: `extract_rules.py` exits with status 2 and a message pointing at `.env.example` if no key is found (env / `.env.local` / `--api-key` flag all unset). The `engine` and `verifier` paths never read the key — verification works offline once `rules.json` exists.

## 7. Testing strategy

"Test thoroughly" for this design means:

- **Schema** (`test_schema.py`): valid + invalid JSON examples; round-trip with strict mode.
- **Expression evaluator** (`test_expression.py`): full coverage of the grammar including all comparator combos, AND/OR/NOT, missing inputs, unsupported expressions.
- **Runner merge** (`test_runner_merge.py`): two windows with overlapping `rule_id`s — first-wins; one window returns malformed JSON — gets skipped without aborting; assertions on token usage accumulator.
- **Verifier** (`test_verifier.py`): pass / fail / manual_review for each path; outcome rollup.
- **Asset extractor** (`test_asset_extractor.py`): synthetic PDF with one image and one table-like region; assets get written with correct filenames.
- **End-to-end** (`test_end_to_end.py`): generates a 3-page synthetic rulebook PDF (reportlab) at runtime that contains 2 rules + 1 image, runs the *full* pipeline using a **stubbed** LLM client that returns canned valid JSON for each window. Validates `output/rules.json` matches the expected shape and the verifier produces the expected report. **No live API calls in tests.**
- LLM-prompt contract is exercised manually via the Streamlit UI when a real PDF is supplied.

CI command: `pytest -q` from `verification_engine/`.

## 8. Out of scope (intentionally)

- Live API calls in tests.
- Real OCR for scanned/image-only PDFs (assumed text-extractable).
- Table-bounding-box detection (rendering full page is good enough for v1).
- Integration with the React app's runtime.
- Production deployment (the Streamlit UI runs locally; `streamlit run ui/app.py`).

## 9. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Rulebook PDF not yet supplied | Pipeline tested with synthetic fixture; live PDF dropped in later runs end-to-end with no code change. |
| LLM hallucinates a `python_logic` we can't safely evaluate | AST grammar refuses unsupported constructs → rule reported as `manual_review`, never executed. |
| Window splitting breaks tables / diagrams across boundaries | 1-page overlap; merge dedupes by stable `rule_id`s the LLM is instructed to reuse across windows. |
| API key leaked to git | `.env.local` gitignored; `.env.example` only has placeholders; UI accepts session-scoped key without writing to disk. |
| Long PDFs blow context per window | Window size and overlap are configurable; default 8 + 1 stays well inside Claude's context per call. |

## 10. Acceptance checklist

- [ ] `pytest -q` passes in CI without internet access.
- [ ] `python scripts/extract_rules.py path/to/rulebook.pdf` produces `output/rules.json` validating against the schema (manual run, when PDF available).
- [ ] `python scripts/verify.py output/rules.json sample_application.json` prints a verification report.
- [ ] `streamlit run ui/app.py` starts the UI; all three tabs functional with the synthetic fixture.
- [ ] Disclaimer text matches the existing React app's wording.
- [ ] `.env.local` not committed; `.env.example` is.
