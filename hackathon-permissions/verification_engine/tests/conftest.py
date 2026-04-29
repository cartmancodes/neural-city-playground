import os
from pathlib import Path
import pytest


@pytest.fixture
def tmp_output_dir(tmp_path, monkeypatch):
    out = tmp_path / "output"
    out.mkdir()
    monkeypatch.setenv("OUTPUT_DIR", str(out))
    return out


def pytest_collection_modifyitems(config, items):
    if os.environ.get("RUN_LIVE_TESTS") != "1":
        skip_live = pytest.mark.skip(reason="live tests require RUN_LIVE_TESTS=1")
        for item in items:
            if "live" in item.keywords:
                item.add_marker(skip_live)
