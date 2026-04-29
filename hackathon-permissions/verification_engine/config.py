from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Load .env.local if present (overrides regular env). Idempotent.
_ROOT = Path(__file__).resolve().parent
load_dotenv(_ROOT / ".env.local", override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    extraction_model: str = Field(default="claude-opus-4-7", alias="EXTRACTION_MODEL")
    vision_model: str = Field(default="claude-opus-4-7", alias="VISION_MODEL")
    window_pages: int = Field(default=8, alias="WINDOW_PAGES", ge=1)
    window_overlap_pages: int = Field(default=1, alias="WINDOW_OVERLAP_PAGES", ge=0)
    output_dir: Path = Field(default=Path("./output"), alias="OUTPUT_DIR")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
