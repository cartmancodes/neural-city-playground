from __future__ import annotations

import json
import os
from pathlib import Path

import streamlit as st

from asset_extractor.pdf_assets import extract_assets
from config import get_settings
from engine.verifier import verify
from extractor.llm_client import AnthropicClient
from extractor.ocr import OcrService, page_needs_ocr
from extractor.pdf_reader import Page, read_pages
from extractor.runner import run_extraction
from schema.models import ExtractionOutput

st.set_page_config(page_title="AP Building Rules - Verification Engine", layout="wide")

settings = get_settings()
out_dir = settings.output_dir
out_dir.mkdir(parents=True, exist_ok=True)
rules_path = out_dir / "rules.json"
assets_dir = out_dir / "assets"

st.title("AP Building Rules - Verification Engine")
st.caption("Preliminary Scrutiny Result. Final approval requires officer review.")

with st.sidebar:
    st.header("Configuration")
    session_key = st.text_input(
        "Anthropic API key (session-scoped)",
        type="password",
        value=os.environ.get("ANTHROPIC_API_KEY", ""),
    )
    st.write(f"Model: `{settings.extraction_model}`")
    st.write(f"Window: {settings.window_pages} pages, overlap {settings.window_overlap_pages}")

tab_extract, tab_assets, tab_verify = st.tabs(["1. Extract", "2. Assets", "3. Verify"])

with tab_extract:
    uploaded = st.file_uploader("Upload AP Building Rules 2017 PDF", type=["pdf"])
    if uploaded and st.button("Run extraction"):
        if not session_key:
            st.error("Set an API key in the sidebar before running extraction.")
        else:
            tmp_pdf = out_dir / "uploaded.pdf"
            tmp_pdf.write_bytes(uploaded.getvalue())
            llm = AnthropicClient(api_key=session_key, model=settings.extraction_model,
                                  vision_model=settings.vision_model)
            ocr = OcrService(vision=llm, cache_dir=out_dir / "ocr_cache")
            pages = read_pages(tmp_pdf)
            for i, p in enumerate(pages):
                if page_needs_ocr(p):
                    pages[i] = Page(number=p.number, text=ocr.transcribe_page(tmp_pdf, p.number))
            with st.spinner("Extracting..."):
                run = run_extraction(tmp_pdf, llm=llm,
                                     window_pages=settings.window_pages,
                                     overlap_pages=settings.window_overlap_pages,
                                     pages=pages)
            rules_path.write_text(run.output.model_dump_json(indent=2))
            extract_assets(tmp_pdf, run.output.Visual_Assets, assets_dir)
            st.success(f"Extracted {len(run.output.Rules)} rules - "
                       f"{len(run.output.Processes)} processes - "
                       f"{len(run.output.Visual_Assets)} assets")
            st.metric("Tokens (in / out)", f"{run.input_tokens} / {run.output_tokens}")
            with st.expander("warnings", expanded=bool(run.output.warnings)):
                for w in run.output.warnings:
                    st.write("- " + w)
            st.json(json.loads(rules_path.read_text()))

with tab_assets:
    if not assets_dir.exists() or not any(assets_dir.iterdir()):
        st.info("No assets yet - run extraction first.")
    else:
        if rules_path.exists():
            extraction = ExtractionOutput.model_validate_json(rules_path.read_text())
            asset_lookup = {a.suggested_filename: a for a in extraction.Visual_Assets}
        else:
            asset_lookup = {}
        cols = st.columns(2)
        for i, png in enumerate(sorted(assets_dir.glob("*.png"))):
            with cols[i % 2]:
                st.image(str(png), caption=png.name)
                meta = asset_lookup.get(png.name)
                if meta:
                    st.caption(f"`{meta.asset_id}` (page {meta.page_number}) - {meta.interpretation}")

with tab_verify:
    if not rules_path.exists():
        st.info("Run extraction first or paste a rules.json above.")
    else:
        extraction = ExtractionOutput.model_validate_json(rules_path.read_text())
        st.write(f"{len(extraction.Rules)} rules loaded.")
        # Build dynamic form from union of required_inputs
        all_inputs: dict[str, str] = {}
        for r in extraction.Rules:
            all_inputs.update(r.required_inputs)
        application: dict = {}
        with st.form("application"):
            cols = st.columns(2)
            for i, (name, type_str) in enumerate(sorted(all_inputs.items())):
                with cols[i % 2]:
                    if type_str.lower().startswith("bool"):
                        application[name] = st.checkbox(name, value=False)
                    else:
                        application[name] = st.number_input(name, value=0.0, step=0.1)
            submitted = st.form_submit_button("Run verification")
        if submitted:
            report = verify(extraction.Rules, application)
            st.subheader(report.summary.outcome.replace("_", " ").title())
            st.write(f"pass: {report.summary.pass_count} - fail: {report.summary.fail_count} - "
                     f"manual_review: {report.summary.manual_review_count}")
            for c in report.checks:
                badge = {"pass": "PASS", "fail": "FAIL", "manual_review": "REVIEW"}[c.status]
                st.write(f"**[{badge}] {c.rule_id}** - {c.description}")
                st.caption(c.reason)
                with st.expander("verbatim"):
                    st.write(c.verbatim_chunk)
                if c.associated_assets:
                    st.write("Linked assets: " + ", ".join(c.associated_assets))
