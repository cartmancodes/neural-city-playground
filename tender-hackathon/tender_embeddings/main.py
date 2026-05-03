"""Typer CLI entry.

Subcommands:
    build         build the index from collector exports
    query         free-text similarity search
    match-tender  find tenders similar to a given tender_id
    status        index health
"""

import sys
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from tender_embeddings import __version__
from tender_embeddings.builder import build_index
from tender_embeddings.embedder import HashEmbedder, SentenceTransformerEmbedder
from tender_embeddings.index import VectorIndex
from tender_embeddings.matcher import Matcher

app = typer.Typer(add_completion=False, no_args_is_help=True, rich_markup_mode=None)
console = Console()

DEFAULT_EXPORTS = Path("../public_tender_collector/data/exports")
DEFAULT_PROCESSED = Path("../public_tender_collector/data/processed")
DEFAULT_INDEX_DIR = Path("data/index")
DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

EXIT_OK = 0
EXIT_CONFIG = 3
EXIT_INTERNAL = 5


def _make_embedder(model: str, *, hash_fallback: bool):
    if hash_fallback or model == "hash":
        return HashEmbedder()
    return SentenceTransformerEmbedder(model_name=model)


@app.command()
def build(
    exports: Path = typer.Option(DEFAULT_EXPORTS, "--exports", help="Collector exports root"),
    processed: Path = typer.Option(
        DEFAULT_PROCESSED, "--processed", help="Collector processed-text dir (fallback source)"
    ),
    index_dir: Path = typer.Option(DEFAULT_INDEX_DIR, "--index-dir"),
    run_id: str = typer.Option(
        "", "--run-id", help="Use a specific collector run; latest if empty"
    ),
    model: str = typer.Option(DEFAULT_MODEL, "--model"),
    batch_size: int = typer.Option(64, "--batch-size"),
    hash_fallback: bool = typer.Option(
        False, "--hash-fallback", help="Use deterministic HashEmbedder (offline, smoke only)"
    ),
) -> None:
    """Build the vector index from a collector export run."""
    embedder = _make_embedder(model, hash_fallback=hash_fallback)
    try:
        summary = build_index(
            exports_root=exports,
            processed_dir=processed,
            index_dir=index_dir,
            embedder=embedder,
            run_id=run_id or None,
            batch_size=batch_size,
        )
    except FileNotFoundError as exc:
        console.print(f"[red]config error:[/red] {exc}")
        raise typer.Exit(EXIT_CONFIG)
    table = Table(title=f"Index built at {index_dir}")
    table.add_column("Metric")
    table.add_column("Value")
    table.add_row("run_dir", str(summary.run_dir))
    table.add_row("documents_seen", str(summary.documents_seen))
    table.add_row("documents_indexed", str(summary.documents_indexed))
    table.add_row("chunks_indexed", str(summary.chunks_indexed))
    table.add_row("embedder", summary.embedder_name)
    table.add_row("dimension", str(summary.dimension))
    console.print(table)


@app.command()
def query(
    text: str = typer.Argument(..., help="Free-text query"),
    index_dir: Path = typer.Option(DEFAULT_INDEX_DIR, "--index-dir"),
    top_k: int = typer.Option(5, "--top-k"),
    source: str = typer.Option("", "--source", help="Filter by source_id"),
    classified_type: str = typer.Option("", "--type", help="Filter by classified_type"),
    model: str = typer.Option(DEFAULT_MODEL, "--model"),
    hash_fallback: bool = typer.Option(False, "--hash-fallback"),
    json_out: bool = typer.Option(False, "--json"),
) -> None:
    """Free-text semantic search over the index."""
    embedder = _make_embedder(model, hash_fallback=hash_fallback)
    matcher = Matcher(index_dir, embedder)
    hits = matcher.query(
        text,
        top_k=top_k,
        source_id=source or None,
        classified_type=classified_type or None,
    )
    if json_out:
        out = [
            {
                "score": h.score,
                "chunk_id": h.chunk.chunk_id,
                "tender_id": h.chunk.tender_id,
                "source_id": h.chunk.source_id,
                "classified_type": h.chunk.classified_type,
                "text": h.chunk.text,
            }
            for h in hits
        ]
        console.print_json(data=out)
        return
    table = Table(title=f"Top {len(hits)} matches for: {text!r}")
    table.add_column("Score", justify="right")
    table.add_column("Tender")
    table.add_column("Type")
    table.add_column("Source")
    table.add_column("Excerpt")
    for h in hits:
        excerpt = h.chunk.text[:160].replace("\n", " ")
        table.add_row(
            f"{h.score:.3f}",
            h.chunk.tender_id or "—",
            h.chunk.classified_type or "—",
            h.chunk.source_id or "—",
            excerpt + ("…" if len(h.chunk.text) > 160 else ""),
        )
    console.print(table)


@app.command("match-tender")
def match_tender(
    tender_id: str = typer.Argument(..., help="Source tender_id from the collector DB"),
    index_dir: Path = typer.Option(DEFAULT_INDEX_DIR, "--index-dir"),
    top_k: int = typer.Option(5, "--top-k"),
    source: str = typer.Option("", "--source"),
    model: str = typer.Option(DEFAULT_MODEL, "--model"),
    hash_fallback: bool = typer.Option(False, "--hash-fallback"),
    json_out: bool = typer.Option(False, "--json"),
) -> None:
    """Rank other tenders by semantic similarity to the given tender."""
    embedder = _make_embedder(model, hash_fallback=hash_fallback)
    matcher = Matcher(index_dir, embedder)
    tender_hits = matcher.match_tender(tender_id, top_k_tenders=top_k, source_id=source or None)
    if json_out:
        out = [
            {
                "tender_id": t.tender_id,
                "score": t.score,
                "matching_chunks": [
                    {
                        "score": h.score,
                        "chunk_id": h.chunk.chunk_id,
                        "text_excerpt": h.chunk.text[:160],
                    }
                    for h in t.matching_chunks
                ],
            }
            for t in tender_hits
        ]
        console.print_json(data=out)
        return
    table = Table(title=f"Tenders similar to {tender_id}")
    table.add_column("Avg score", justify="right")
    table.add_column("Tender")
    table.add_column("Top matching chunk excerpt")
    for t in tender_hits:
        top_chunk = t.matching_chunks[0] if t.matching_chunks else None
        excerpt = (top_chunk.chunk.text[:160] if top_chunk else "—").replace("\n", " ")
        table.add_row(f"{t.score:.3f}", t.tender_id, excerpt)
    console.print(table)


@app.command()
def status(index_dir: Path = typer.Option(DEFAULT_INDEX_DIR, "--index-dir")) -> None:
    """Print the index manifest."""
    idx = VectorIndex(index_dir)
    m = idx.load_manifest()
    if m is None:
        console.print(f"[yellow]No index manifest at {index_dir}[/yellow]")
        return
    table = Table(title=f"Index status — {index_dir}")
    table.add_column("Field")
    table.add_column("Value")
    for k, v in m.items():
        table.add_row(k, str(v))
    console.print(table)
    console.print(f"[dim]tender-embeddings v{__version__}[/dim]")


if __name__ == "__main__":
    try:
        app()
    except typer.Exit:
        raise
    except KeyboardInterrupt:
        sys.exit(EXIT_CONFIG)
    except Exception as exc:
        console.print(f"[red]internal error:[/red] {exc}")
        sys.exit(EXIT_INTERNAL)
