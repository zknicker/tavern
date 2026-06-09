export const managedMnemosyneMarker = 'TAVERN_MANAGED_MNEMOSYNE_PLUGIN';

export const managedMnemosynePluginManifest = `name: mnemosyne
version: 1.0.0
description: Local-first Mnemosyne memory provider for managed Tavern Hermes.
pip_dependencies:
  - mnemosyne-hermes
`;

export const managedMnemosynePluginSource = `"""Tavern-managed Mnemosyne memory provider shim."""

from __future__ import annotations

from typing import Any

from agent.memory_provider import MemoryProvider


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


def _provider() -> MemoryProvider:
    try:
        from mnemosyne_hermes import MnemosyneMemoryProvider

        return MnemosyneMemoryProvider()
    except Exception:
        return UnavailableMnemosyneMemoryProvider()


def register_memory_provider(ctx) -> None:
    ctx.register_memory_provider(_provider())


def register(ctx) -> None:
    register_memory_provider(ctx)
`;
