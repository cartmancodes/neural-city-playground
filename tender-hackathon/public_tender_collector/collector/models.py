"""Domain models: pydantic schemas for I/O + SQLAlchemy Core tables for persistence.

Spec §5: pydantic for I/O, SQLAlchemy Core (no ORM relationships) for persistence,
with a 1:1 mapping between schemas and tables.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    Text,
)

# ---------------------------------------------------------------------------
# Pydantic schemas (I/O layer)
# ---------------------------------------------------------------------------


class _Base(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, str_strip_whitespace=True)


class Source(_Base):
    source_id: str
    source_name: str
    base_url: AnyHttpUrl
    allowed_paths: list[str]
    source_type: Literal[
        "official_portal", "public_search_page", "bulk_download", "manual_url_list"
    ] = "official_portal"
    country: str = "IN"
    state: str | None = None
    department: str | None = None
    parser_name: str
    languages: list[str] = Field(default_factory=lambda: ["en"])
    rate_limit_seconds: int = 5
    max_pages_per_run: int = 10
    max_documents_per_run: int = 50
    allowed_file_extensions: list[str] = Field(
        default_factory=lambda: ["pdf", "doc", "docx", "xls", "xlsx", "zip"]
    )
    robots_required: bool = True
    approved: bool = False
    tos_url: AnyHttpUrl | None = None
    tos_summary: str = ""
    reviewed_by: str = ""
    reviewed_on: date | None = None
    discovery_mode: Literal["manual_seed", "search_page", "sitemap"] = "manual_seed"
    sitemap_url: AnyHttpUrl | None = None
    search_pages: list[str] = Field(default_factory=list)
    notes: str = ""


class TenderPage(_Base):
    tender_page_id: str
    source_id: str
    url: AnyHttpUrl
    fetched_at: datetime
    http_status: int
    content_sha256: str
    parser_name: str
    run_id: str


TenderStatus = Literal[
    "discovered",
    "documents_listed",
    "documents_downloaded",
    "extracted",
    "scored",
    "archived",
    "failed",
]


class Tender(_Base):
    tender_id: str
    source_id: str
    source_tender_url: AnyHttpUrl
    title: str | None = None
    reference_number: str | None = None
    organisation: str | None = None
    department: str | None = None
    state: str | None = None
    location: str | None = None
    tender_category: str | None = None
    product_category: str | None = None
    form_of_contract: str | None = None
    tender_type: str | None = None
    tender_value_inr: Decimal | None = None
    emd_inr: Decimal | None = None
    published_date: date | None = None
    closing_date: date | None = None
    bid_opening_date: date | None = None
    has_corrigendum: bool = False
    has_award: bool = False
    discovered_at: datetime
    updated_at: datetime
    status: TenderStatus = "discovered"


DocumentStatus = Literal["ok", "skipped", "failed"]


class Document(_Base):
    document_id: str
    tender_id: str
    source_id: str
    source_url: AnyHttpUrl
    final_url: AnyHttpUrl
    anchor_text: str | None = None
    file_name: str
    file_path: Path
    content_type: str
    file_extension: str
    file_size_bytes: int
    sha256: str
    downloaded_at: datetime
    status: DocumentStatus = "ok"
    skip_reason: str | None = None
    error_message: str | None = None
    classified_type: str = "Unknown"
    classification_confidence: float = 0.0


ExtractionStatus = Literal["ok", "scanned_or_no_text", "encrypted", "unsupported", "failed"]


class ExtractedText(_Base):
    document_id: str
    extracted_text_path: Path
    text_preview: str
    page_count: int | None = None
    language_guess: str | None = None
    extraction_status: ExtractionStatus = "ok"
    extraction_error: str | None = None
    manual_review_required: bool = False


ComplianceDecisionType = Literal["allow", "skip"]


class ComplianceLog(_Base):
    run_id: str
    timestamp: datetime
    source_id: str
    url: AnyHttpUrl
    decision: ComplianceDecisionType
    rule_triggered: str | None = None
    reason: str = ""


class RelevanceScore(_Base):
    document_id: str
    relevance_score: int
    relevance_reasons: list[str] = Field(default_factory=list)
    recommended_for_training: bool = False
    recommended_for_demo: bool = False
    scored_at: datetime


class DocumentLink(_Base):
    """One <a> on a tender page that we believe points at a tender artifact."""

    url: AnyHttpUrl
    anchor_text: str | None = None
    suggested_type: str = "Unknown"


class TenderPageParse(_Base):
    """Parser output: structured tender metadata + the document links found."""

    tender: Tender
    document_links: list[DocumentLink] = Field(default_factory=list)


class SearchPageResult(_Base):
    """Parser output for a search/listing page."""

    tender_page_urls: list[AnyHttpUrl] = Field(default_factory=list)
    next_page_url: AnyHttpUrl | None = None


class FetchResult(_Base):
    url: AnyHttpUrl
    final_url: AnyHttpUrl | None = None
    status: Literal["ok", "failed"]
    http_status: int | None = None
    content_type: str | None = None
    content_length: int | None = None
    body_path: Path | None = None  # set when expect="file"
    body_text: str | None = None  # set when expect="html"
    elapsed_ms: int = 0
    error: str | None = None


class ComplianceDecision(_Base):
    allow: bool
    rule_triggered: str | None = None
    reason: str = ""


# ---------------------------------------------------------------------------
# SQLAlchemy Core tables (persistence layer)
# ---------------------------------------------------------------------------

metadata_obj = MetaData()


sources_table = Table(
    "sources",
    metadata_obj,
    Column("source_id", String, primary_key=True),
    Column("source_name", Text, nullable=False),
    Column("base_url", Text, nullable=False),
    Column("allowed_paths", JSON, nullable=False),
    Column("source_type", String, nullable=False),
    Column("country", String, nullable=False),
    Column("state", String, nullable=True),
    Column("department", String, nullable=True),
    Column("parser_name", String, nullable=False),
    Column("languages", JSON, nullable=False),
    Column("rate_limit_seconds", Integer, nullable=False),
    Column("max_pages_per_run", Integer, nullable=False),
    Column("max_documents_per_run", Integer, nullable=False),
    Column("allowed_file_extensions", JSON, nullable=False),
    Column("robots_required", Boolean, nullable=False),
    Column("approved", Boolean, nullable=False),
    Column("tos_url", Text, nullable=True),
    Column("tos_summary", Text, nullable=False, default=""),
    Column("reviewed_by", String, nullable=False, default=""),
    Column("reviewed_on", Date, nullable=True),
    Column("notes", Text, nullable=False, default=""),
)

tender_pages_table = Table(
    "tender_pages",
    metadata_obj,
    Column("tender_page_id", String, primary_key=True),
    Column("source_id", String, nullable=False),
    Column("url", Text, nullable=False, unique=True),
    Column("fetched_at", DateTime(timezone=True), nullable=False),
    Column("http_status", Integer, nullable=False),
    Column("content_sha256", String, nullable=False),
    Column("parser_name", String, nullable=False),
    Column("run_id", String, nullable=False),
)

tenders_table = Table(
    "tenders",
    metadata_obj,
    Column("tender_id", String, primary_key=True),
    Column("source_id", String, nullable=False),
    Column("source_tender_url", Text, nullable=False),
    Column("title", Text, nullable=True),
    Column("reference_number", String, nullable=True),
    Column("organisation", Text, nullable=True),
    Column("department", Text, nullable=True),
    Column("state", String, nullable=True),
    Column("location", Text, nullable=True),
    Column("tender_category", String, nullable=True),
    Column("product_category", String, nullable=True),
    Column("form_of_contract", String, nullable=True),
    Column("tender_type", String, nullable=True),
    Column("tender_value_inr", Numeric(20, 2), nullable=True),
    Column("emd_inr", Numeric(20, 2), nullable=True),
    Column("published_date", Date, nullable=True),
    Column("closing_date", Date, nullable=True),
    Column("bid_opening_date", Date, nullable=True),
    Column("has_corrigendum", Boolean, nullable=False, default=False),
    Column("has_award", Boolean, nullable=False, default=False),
    Column("discovered_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("status", String, nullable=False, default="discovered"),
)

documents_table = Table(
    "documents",
    metadata_obj,
    Column("document_id", String, primary_key=True),
    Column("tender_id", String, nullable=False),
    Column("source_id", String, nullable=False),
    Column("source_url", Text, nullable=False),
    Column("final_url", Text, nullable=False),
    Column("anchor_text", Text, nullable=True),
    Column("file_name", Text, nullable=False),
    Column("file_path", Text, nullable=False),
    Column("content_type", String, nullable=False),
    Column("file_extension", String, nullable=False),
    Column("file_size_bytes", Integer, nullable=False),
    Column("sha256", String, nullable=False, unique=True),
    Column("downloaded_at", DateTime(timezone=True), nullable=False),
    Column("status", String, nullable=False, default="ok"),
    Column("skip_reason", Text, nullable=True),
    Column("error_message", Text, nullable=True),
    Column("classified_type", String, nullable=False, default="Unknown"),
    Column("classification_confidence", Float, nullable=False, default=0.0),
    Column("near_duplicate_of", String, nullable=True),
)

extracted_texts_table = Table(
    "extracted_texts",
    metadata_obj,
    Column("document_id", String, primary_key=True),
    Column("extracted_text_path", Text, nullable=False),
    Column("text_preview", Text, nullable=False, default=""),
    Column("page_count", Integer, nullable=True),
    Column("language_guess", String, nullable=True),
    Column("extraction_status", String, nullable=False, default="ok"),
    Column("extraction_error", Text, nullable=True),
    Column("manual_review_required", Boolean, nullable=False, default=False),
)

compliance_logs_table = Table(
    "compliance_logs",
    metadata_obj,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("run_id", String, nullable=False),
    Column("timestamp", DateTime(timezone=True), nullable=False),
    Column("source_id", String, nullable=False),
    Column("url", Text, nullable=False),
    Column("decision", String, nullable=False),
    Column("rule_triggered", String, nullable=True),
    Column("reason", Text, nullable=False, default=""),
)

relevance_scores_table = Table(
    "relevance_scores",
    metadata_obj,
    Column("document_id", String, primary_key=True),
    Column("relevance_score", Integer, nullable=False),
    Column("relevance_reasons", JSON, nullable=False),
    Column("recommended_for_training", Boolean, nullable=False),
    Column("recommended_for_demo", Boolean, nullable=False),
    Column("scored_at", DateTime(timezone=True), nullable=False),
)

runs_table = Table(
    "runs",
    metadata_obj,
    Column("run_id", String, primary_key=True),
    Column("command", String, nullable=False),
    Column("started_at", DateTime(timezone=True), nullable=False),
    Column("ended_at", DateTime(timezone=True), nullable=True),
    Column("exit_status", Integer, nullable=True),
    Column("counts", JSON, nullable=True),
)

schema_version_table = Table(
    "schema_version",
    metadata_obj,
    Column("version", Integer, primary_key=True),
    Column("set_at", DateTime(timezone=True), nullable=False),
)


def utcnow() -> datetime:
    """Single canonical UTC clock for the package."""
    return datetime.now(timezone.utc)
