"""AI chat service — Ollama backend only."""
from abc import ABC, abstractmethod
from typing import AsyncIterator

from app.config import (
    AI_CONNECT_TIMEOUT,
    AI_READ_TIMEOUT,
    AI_WRITE_TIMEOUT,
    AI_POOL_TIMEOUT,
    AI_DEFAULT_MODEL,
)


class AIBackend(ABC):
    @abstractmethod
    async def stream(self, messages: list[dict], system: str) -> AsyncIterator[str]: ...

    async def aclose(self) -> None:
        """Release underlying resources. Override in subclasses."""


class OllamaBackend(AIBackend):
    def __init__(self, model: str = AI_DEFAULT_MODEL, base_url: str = "http://localhost:11434"):
        import httpx
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(
                connect=AI_CONNECT_TIMEOUT,
                read=AI_READ_TIMEOUT,
                write=AI_WRITE_TIMEOUT,
                pool=AI_POOL_TIMEOUT,
            ),
        )
        self._model = model

    async def stream(self, messages, system):
        import json
        full = [{"role": "system", "content": system}] + messages
        async with self._client.stream("POST", "/api/chat", json={"model": self._model, "messages": full, "stream": True}) as r:
            async for line in r.aiter_lines():
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield content
                if chunk.get("done"):
                    break

    async def aclose(self) -> None:
        await self._client.aclose()


_instance: "OllamaBackend | None" = None


def get_backend(model: str = "") -> AIBackend:
    """Return the shared Ollama backend instance, recreating it if the model changed."""
    global _instance
    resolved_model = model or AI_DEFAULT_MODEL
    if _instance is None or _instance._model != resolved_model:
        _instance = OllamaBackend(resolved_model)
    return _instance


async def close_backend() -> None:
    """Close the shared backend client. Call during app shutdown."""
    global _instance
    if _instance is not None:
        await _instance.aclose()
        _instance = None
