from __future__ import annotations

import base64
import time
from dataclasses import dataclass
from typing import Protocol

from anthropic import Anthropic, APIError, RateLimitError


@dataclass
class LlmResponse:
    text: str
    input_tokens: int
    output_tokens: int


class LlmClient(Protocol):
    def extract(self, system: str, user: str) -> LlmResponse: ...
    def transcribe_image_png(self, png_bytes: bytes) -> str: ...


class AnthropicClient:
    def __init__(self, api_key: str, model: str, vision_model: str | None = None,
                 max_retries: int = 3, base_backoff_s: float = 1.0):
        self._client = Anthropic(api_key=api_key)
        self._model = model
        self._vision_model = vision_model or model
        self._max_retries = max_retries
        self._base_backoff = base_backoff_s

    def _call(self, **kwargs):
        for attempt in range(self._max_retries):
            try:
                return self._client.messages.create(**kwargs)
            except (RateLimitError, APIError) as e:
                if attempt == self._max_retries - 1:
                    raise
                time.sleep(self._base_backoff * (2 ** attempt))
        raise RuntimeError("unreachable")

    def extract(self, system: str, user: str) -> LlmResponse:
        msg = self._call(
            model=self._model,
            max_tokens=4096,
            system=[{
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
        return LlmResponse(
            text=text,
            input_tokens=getattr(msg.usage, "input_tokens", 0),
            output_tokens=getattr(msg.usage, "output_tokens", 0),
        )

    def transcribe_image_png(self, png_bytes: bytes) -> str:
        b64 = base64.standard_b64encode(png_bytes).decode("ascii")
        msg = self._call(
            model=self._vision_model,
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                    {"type": "text", "text": "Transcribe the printed text on this page verbatim. Return only the text, no commentary."},
                ],
            }],
        )
        return "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
