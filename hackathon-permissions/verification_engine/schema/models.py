from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


RULE_ID_PATTERN = r"^[A-Z][A-Z0-9_]+$"
ASSET_ID_PATTERN = r"^[A-Z][A-Z0-9_]+$"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Rule(StrictModel):
    rule_id: str = Field(pattern=RULE_ID_PATTERN)
    description: str
    required_inputs: dict[str, str]
    python_logic: str
    rule_specific_documents: list[str] = Field(default_factory=list)
    verbatim_chunk: str
    associated_assets: list[str] = Field(default_factory=list)


class Process(StrictModel):
    process_name: str
    associated_rules: list[str] = Field(default_factory=list)
    overall_documents_required: list[str] = Field(default_factory=list)


class VisualAsset(StrictModel):
    asset_id: str = Field(pattern=ASSET_ID_PATTERN)
    asset_type: Literal["Table", "Diagram", "Image"]
    page_number: int = Field(ge=1)
    interpretation: str
    suggested_filename: str


class ExtractionOutput(StrictModel):
    Rules: list[Rule] = Field(default_factory=list)
    Processes: list[Process] = Field(default_factory=list)
    Visual_Assets: list[VisualAsset] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
