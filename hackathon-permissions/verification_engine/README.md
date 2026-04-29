# Verification Engine

Python service that extracts AP Building Rules into JSON and verifies applications.

## Setup

```bash
cd verification_engine
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env.local
# edit .env.local to add ANTHROPIC_API_KEY
```

## Usage

```bash
# Extract rules from PDF
python scripts/extract_rules.py /path/to/rulebook.pdf

# Run verification
python scripts/verify.py output/rules.json sample_application.json

# Export rules to the React app
python scripts/export_to_react.py output/rules.json

# Streamlit UI
streamlit run ui/app.py
```

## Testing

```bash
pytest -q -m "not live"            # default — no API calls
RUN_LIVE_TESTS=1 pytest -q         # includes one live API integration test
```
