export const managedMnemosyneMarker = 'TAVERN_MANAGED_MNEMOSYNE_PLUGIN';

export const managedMnemosynePluginManifest = `name: mnemosyne
version: 1.0.0
description: Local-first Mnemosyne memory provider for managed Tavern Hermes.
pip_dependencies:
  - mnemosyne-hermes
`;

export const managedMnemosynePluginSource = `"""Tavern-managed Mnemosyne memory provider shim."""

from __future__ import annotations

import copy
from typing import Any

from agent.memory_provider import MemoryProvider


TOOL_PREFIX = "mnemosyne_"
PRODUCT_TOOL_PREFIX = "memory_"


def _to_product_tool_name(tool_name: str) -> str:
    if tool_name.startswith(TOOL_PREFIX):
        return PRODUCT_TOOL_PREFIX + tool_name[len(TOOL_PREFIX):]
    return tool_name


def _to_provider_tool_name(tool_name: str) -> str:
    if tool_name.startswith(PRODUCT_TOOL_PREFIX):
        return TOOL_PREFIX + tool_name[len(PRODUCT_TOOL_PREFIX):]
    return tool_name


def _product_description(description: str) -> str:
    return (
        description.replace("mnemosyne_", "memory_")
        .replace("Mnemosyne", "assistant memory")
        .replace("mnemosyne", "assistant memory")
    )


def _product_schema(schema: dict[str, Any]) -> dict[str, Any]:
    next_schema = copy.deepcopy(schema)
    name = next_schema.get("name")
    if isinstance(name, str):
        next_schema["name"] = _to_product_tool_name(name)
    description = next_schema.get("description")
    if isinstance(description, str):
        next_schema["description"] = _product_description(description)
    return next_schema


class UnavailableMnemosyneMemoryProvider(MemoryProvider):
    @property
    def name(self) -> str:
        return "mnemosyne"

    def is_available(self) -> bool:
        return False

    def initialize(self, session_id: str, **kwargs: Any) -> None:
        return None

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        return []

    def handle_tool_call(
        self,
        tool_name: str,
        args: dict[str, Any],
        **kwargs: Any,
    ) -> dict[str, Any]:
        return {"error": "mnemosyne-hermes is not installed in the Hermes Python environment"}

    def get_config_schema(self) -> list[dict[str, Any]]:
        return []

    def save_config(self, values: dict[str, Any], hermes_home: str) -> None:
        return None


class TavernMnemosyneMemoryProvider(MemoryProvider):
    def __init__(self, provider: MemoryProvider) -> None:
        self._provider = provider

    @property
    def name(self) -> str:
        return self._provider.name

    def is_available(self) -> bool:
        return self._provider.is_available()

    def initialize(self, session_id: str, **kwargs: Any) -> None:
        return self._provider.initialize(session_id, **kwargs)

    def system_prompt_block(self) -> str:
        return _product_description(self._provider.system_prompt_block())

    def prefetch(self, query: str, *, session_id: str = "") -> str:
        return self._provider.prefetch(query, session_id=session_id)

    def queue_prefetch(self, query: str, *, session_id: str = "") -> None:
        return self._provider.queue_prefetch(query, session_id=session_id)

    def sync_turn(
        self,
        user_content: str,
        assistant_content: str,
        *,
        session_id: str = "",
        messages: list[dict[str, Any]] | None = None,
    ) -> None:
        return self._provider.sync_turn(
            user_content,
            assistant_content,
            session_id=session_id,
            messages=messages,
        )

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        return [_product_schema(schema) for schema in self._provider.get_tool_schemas()]

    def handle_tool_call(
        self,
        tool_name: str,
        args: dict[str, Any],
        **kwargs: Any,
    ) -> dict[str, Any]:
        return self._provider.handle_tool_call(_to_provider_tool_name(tool_name), args, **kwargs)

    def shutdown(self) -> None:
        return self._provider.shutdown()

    def on_turn_start(self, turn_number: int, message: str, **kwargs: Any) -> None:
        return self._provider.on_turn_start(turn_number, message, **kwargs)

    def on_session_end(self, messages: list[dict[str, Any]]) -> None:
        return self._provider.on_session_end(messages)

    def on_session_switch(
        self,
        new_session_id: str,
        *,
        parent_session_id: str = "",
        reset: bool = False,
        rewound: bool = False,
        **kwargs: Any,
    ) -> None:
        return self._provider.on_session_switch(
            new_session_id,
            parent_session_id=parent_session_id,
            reset=reset,
            rewound=rewound,
            **kwargs,
        )

    def on_pre_compress(self, messages: list[dict[str, Any]]) -> str:
        return self._provider.on_pre_compress(messages)

    def on_delegation(
        self,
        task: str,
        result: str,
        *,
        child_session_id: str = "",
        **kwargs: Any,
    ) -> None:
        return self._provider.on_delegation(
            task,
            result,
            child_session_id=child_session_id,
            **kwargs,
        )

    def get_config_schema(self) -> list[dict[str, Any]]:
        return self._provider.get_config_schema()

    def save_config(self, values: dict[str, Any], hermes_home: str) -> None:
        return self._provider.save_config(values, hermes_home)

    def on_memory_write(
        self,
        action: str,
        target: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        return self._provider.on_memory_write(action, target, content, metadata)


def _provider() -> MemoryProvider:
    try:
        from mnemosyne_hermes import MnemosyneMemoryProvider

        return TavernMnemosyneMemoryProvider(MnemosyneMemoryProvider())
    except Exception:
        return UnavailableMnemosyneMemoryProvider()


def register_memory_provider(ctx) -> None:
    ctx.register_memory_provider(_provider())


def register(ctx) -> None:
    register_memory_provider(ctx)
`;
