"""SQLAlchemy Core access to the SQLite database. Single-writer; WAL mode."""

from __future__ import annotations

import json
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import (
    Connection,
    create_engine,
    event,
    insert,
    select,
    update,
)
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine

from collector.models import (
    ComplianceLog,
    Document,
    ExtractedText,
    RelevanceScore,
    Source,
    Tender,
    TenderPage,
    compliance_logs_table,
    documents_table,
    extracted_texts_table,
    metadata_obj,
    relevance_scores_table,
    runs_table,
    schema_version_table,
    sources_table,
    tender_pages_table,
    tenders_table,
)

SCHEMA_VERSION = 1


def _enable_wal_and_fk(dbapi_conn: Any, _connection_record: Any) -> None:
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


def make_engine(db_path: Path) -> Engine:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    eng = create_engine(f"sqlite:///{db_path}", future=True)
    event.listen(eng, "connect", _enable_wal_and_fk)
    return eng


def init_schema(engine: Engine) -> None:
    metadata_obj.create_all(engine)
    with engine.begin() as conn:
        existing = conn.execute(select(schema_version_table.c.version)).scalar()
        if existing is None:
            conn.execute(
                insert(schema_version_table).values(
                    version=SCHEMA_VERSION,
                    set_at=datetime.now(timezone.utc),
                )
            )


@contextmanager
def transaction(engine: Engine) -> Iterator[Connection]:
    with engine.begin() as conn:
        yield conn


# ---------------------------------------------------------------------------
# Upserts (idempotent on primary key)
# ---------------------------------------------------------------------------


def _model_dict(obj: Any) -> dict[str, Any]:
    """pydantic.BaseModel -> dict that SQLAlchemy is happy with."""
    data: dict[str, Any] = dict(obj.model_dump(mode="python"))
    # Cast non-JSON-native types
    if "base_url" in data:
        data["base_url"] = str(data["base_url"])
    if "tos_url" in data and data["tos_url"] is not None:
        data["tos_url"] = str(data["tos_url"])
    if "url" in data and data["url"] is not None and not isinstance(data["url"], str):
        data["url"] = str(data["url"])
    if "source_tender_url" in data:
        data["source_tender_url"] = str(data["source_tender_url"])
    if "source_url" in data:
        data["source_url"] = str(data["source_url"])
    if "final_url" in data:
        data["final_url"] = str(data["final_url"])
    if "file_path" in data:
        data["file_path"] = str(data["file_path"])
    if "extracted_text_path" in data:
        data["extracted_text_path"] = str(data["extracted_text_path"])
    return data


def upsert_source(conn: Connection, source: Source) -> None:
    payload = _model_dict(source)
    payload.pop("discovery_mode", None)
    payload.pop("sitemap_url", None)
    payload.pop("search_pages", None)
    stmt = sqlite_insert(sources_table).values(**payload)
    stmt = stmt.on_conflict_do_update(index_elements=["source_id"], set_=payload)
    conn.execute(stmt)


def upsert_tender_page(conn: Connection, page: TenderPage) -> None:
    payload = _model_dict(page)
    stmt = sqlite_insert(tender_pages_table).values(**payload)
    stmt = stmt.on_conflict_do_update(
        index_elements=["tender_page_id"], set_={"fetched_at": payload["fetched_at"]}
    )
    conn.execute(stmt)


def upsert_tender(conn: Connection, tender: Tender) -> None:
    payload = _model_dict(tender)
    stmt = sqlite_insert(tenders_table).values(**payload)
    update_set = {k: v for k, v in payload.items() if k != "tender_id"}
    stmt = stmt.on_conflict_do_update(index_elements=["tender_id"], set_=update_set)
    conn.execute(stmt)


def upsert_document(
    conn: Connection, document: Document, near_duplicate_of: str | None = None
) -> None:
    payload = _model_dict(document)
    payload["near_duplicate_of"] = near_duplicate_of
    stmt = sqlite_insert(documents_table).values(**payload)
    update_set = {k: v for k, v in payload.items() if k != "document_id"}
    stmt = stmt.on_conflict_do_update(index_elements=["document_id"], set_=update_set)
    conn.execute(stmt)


def upsert_extracted_text(conn: Connection, et: ExtractedText) -> None:
    payload = _model_dict(et)
    stmt = sqlite_insert(extracted_texts_table).values(**payload)
    stmt = stmt.on_conflict_do_update(index_elements=["document_id"], set_=payload)
    conn.execute(stmt)


def upsert_relevance(conn: Connection, score: RelevanceScore) -> None:
    payload = _model_dict(score)
    stmt = sqlite_insert(relevance_scores_table).values(**payload)
    stmt = stmt.on_conflict_do_update(index_elements=["document_id"], set_=payload)
    conn.execute(stmt)


def insert_compliance_log(conn: Connection, log: ComplianceLog) -> None:
    payload = _model_dict(log)
    conn.execute(insert(compliance_logs_table).values(**payload))


def insert_run(conn: Connection, run_id: str, command: str) -> None:
    stmt = sqlite_insert(runs_table).values(
        run_id=run_id, command=command, started_at=datetime.now(timezone.utc)
    )
    stmt = stmt.on_conflict_do_nothing(index_elements=["run_id"])
    conn.execute(stmt)


def finish_run(conn: Connection, run_id: str, exit_status: int, counts: dict[str, int]) -> None:
    conn.execute(
        update(runs_table)
        .where(runs_table.c.run_id == run_id)
        .values(
            ended_at=datetime.now(timezone.utc),
            exit_status=exit_status,
            counts=json.dumps(counts),
        )
    )


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


def all_documents(conn: Connection) -> Iterable[dict[str, Any]]:
    rows = conn.execute(select(documents_table)).mappings().all()
    return [dict(r) for r in rows]


def all_extracted_texts(conn: Connection) -> Iterable[dict[str, Any]]:
    rows = conn.execute(select(extracted_texts_table)).mappings().all()
    return [dict(r) for r in rows]


def all_tenders(conn: Connection) -> Iterable[dict[str, Any]]:
    rows = conn.execute(select(tenders_table)).mappings().all()
    return [dict(r) for r in rows]


def all_relevance(conn: Connection) -> Iterable[dict[str, Any]]:
    rows = conn.execute(select(relevance_scores_table)).mappings().all()
    return [dict(r) for r in rows]


def all_compliance_logs(conn: Connection) -> Iterable[dict[str, Any]]:
    rows = conn.execute(select(compliance_logs_table)).mappings().all()
    return [dict(r) for r in rows]


def documents_for_tender(conn: Connection, tender_id: str) -> list[dict[str, Any]]:
    rows = (
        conn.execute(select(documents_table).where(documents_table.c.tender_id == tender_id))
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]
