import fs from 'node:fs/promises';
import path from 'node:path';
import { tavernRenderBarChartToolName, tavernRenderLineChartToolName } from '@tavern/api';

const PLUGIN_NAME = 'tavern-messenger-platform';

export function tavernMessengerPluginName() {
    return PLUGIN_NAME;
}

export function tavernMessengerPluginSource() {
    return PLUGIN_SOURCE;
}

export async function ensureTavernMessengerPlugin() {
    const pluginDir = await tavernMessengerPluginDir();
    await fs.mkdir(pluginDir, { recursive: true });
    await Promise.all([
        fs.writeFile(path.join(pluginDir, 'plugin.yaml'), PLUGIN_MANIFEST),
        fs.writeFile(path.join(pluginDir, '__init__.py'), PLUGIN_SOURCE),
    ]);
}

async function tavernMessengerPluginDir() {
    const { HERMES_HOME } = await import('../config');
    return path.join(HERMES_HOME, 'plugins', 'platforms', 'tavern-messenger');
}

const PLUGIN_MANIFEST = `name: ${PLUGIN_NAME}
label: Tavern
kind: platform
version: 1.0.0
description: Tavern Runtime messenger platform for Hermes cron delivery.
requires_env:
  - name: TAVERN_RUNTIME_URL
    description: Tavern Runtime base URL.
    prompt: Tavern Runtime URL
    password: false
  - name: TAVERN_HOME_CHAT
    description: Default Tavern chat id for Hermes cron delivery.
    prompt: Tavern chat id
    password: false
`;

const PLUGIN_SOURCE = `import json
import math
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import BasePlatformAdapter, SendResult
from tools.registry import tool_error, tool_result


_CHART_NUMBER_PATTERN = re.compile(r"^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?$")
_ROOT_KEYS = {"title", "xKey", "series", "data"}
_SERIES_KEYS = {"key", "label"}


TAVERN_RENDER_BAR_CHART_SCHEMA = {
    "name": "${tavernRenderBarChartToolName}",
    "description": "Use when the user asks to see prepared categorical data as a simple vertical bar chart in chat. Series values should be finite nonnegative JSON numbers; numeric strings are normalized.",
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "required": ["title", "xKey", "series", "data"],
        "properties": {
            "title": {
                "type": "string",
                "minLength": 1,
                "maxLength": 160,
                "description": "Chart title.",
            },
            "xKey": {
                "type": "string",
                "minLength": 1,
                "maxLength": 80,
                "description": "Data key for x-axis labels.",
            },
            "series": {
                "type": "array",
                "minItems": 1,
                "maxItems": 4,
                "description": "1-4 numeric series; each key's row value must be a finite nonnegative JSON number or numeric string.",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["key", "label"],
                    "properties": {
                        "key": {"type": "string", "minLength": 1, "maxLength": 80},
                        "label": {"type": "string", "minLength": 1, "maxLength": 120},
                    },
                },
            },
            "data": {
                "type": "array",
                "minItems": 1,
                "maxItems": 50,
                "description": "1-50 rows. xKey is the label; series values are finite nonnegative numbers or numeric strings.",
                "items": {
                    "type": "object",
                    "additionalProperties": {
                        "type": ["string", "number", "boolean", "null"]
                    },
                },
            },
        },
    },
}

TAVERN_RENDER_LINE_CHART_SCHEMA = {
    "name": "${tavernRenderLineChartToolName}",
    "description": "Use when the user asks to see prepared numeric data as a simple trend chart in chat. Series values should be finite JSON numbers; numeric strings are normalized.",
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "required": ["title", "xKey", "series", "data"],
        "properties": {
            "title": {
                "type": "string",
                "minLength": 1,
                "maxLength": 160,
                "description": "Chart title.",
            },
            "xKey": {
                "type": "string",
                "minLength": 1,
                "maxLength": 80,
                "description": "Data key for x-axis labels.",
            },
            "series": {
                "type": "array",
                "minItems": 1,
                "maxItems": 4,
                "description": "1-4 numeric series; each key's row value must be a finite JSON number or numeric string.",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["key", "label"],
                    "properties": {
                        "key": {"type": "string", "minLength": 1, "maxLength": 80},
                        "label": {"type": "string", "minLength": 1, "maxLength": 120},
                    },
                },
            },
            "data": {
                "type": "array",
                "minItems": 1,
                "maxItems": 50,
                "description": "1-50 rows. xKey is the label; series values are finite numbers or numeric strings.",
                "items": {
                    "type": "object",
                    "additionalProperties": {
                        "type": ["string", "number", "boolean", "null"]
                    },
                },
            },
        },
    },
}


def _runtime_url(extra: Dict[str, Any]) -> str:
    return (os.getenv("TAVERN_RUNTIME_URL") or extra.get("runtime_url") or "").rstrip("/")


def _token(extra: Dict[str, Any]) -> str:
    return os.getenv("TAVERN_RUNTIME_TOKEN") or extra.get("token") or ""


def check_requirements() -> bool:
    return bool(os.getenv("TAVERN_RUNTIME_URL"))


def validate_config(config) -> bool:
    extra = getattr(config, "extra", {}) or {}
    return bool(_runtime_url(extra))


def is_connected(config) -> bool:
    return validate_config(config)


def _is_text(value: Any, max_len: int) -> bool:
    return isinstance(value, str) and 0 < len(value.strip()) <= max_len


def _is_json_primitive(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, float, bool))


def _coerce_chart_number(value: Any, *, allow_negative: bool = False) -> Optional[float]:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(value) and (allow_negative or value >= 0):
        return float(value)
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped:
        return None
    if not _CHART_NUMBER_PATTERN.fullmatch(stripped):
        return None
    try:
        numeric = float(stripped)
    except ValueError:
        return None
    return numeric if math.isfinite(numeric) and (allow_negative or numeric >= 0) else None


def _validate_tavern_chart(args: Any, *, allow_negative: bool) -> Optional[str]:
    value_message = (
        "finite number or numeric string"
        if allow_negative
        else "finite nonnegative number or numeric string"
    )
    if not isinstance(args, dict):
        return "Input must be an object."
    unsupported = set(args.keys()) - _ROOT_KEYS
    if unsupported:
        return "Input contains unsupported fields."
    if not _is_text(args.get("title"), 160):
        return "title must be a non-empty string."
    x_key = args.get("xKey")
    if not _is_text(x_key, 80):
        return "xKey must be a non-empty string."

    series = args.get("series")
    if not isinstance(series, list) or not (1 <= len(series) <= 4):
        return "series must contain 1 to 4 entries."
    series_keys = []
    for item in series:
        if not isinstance(item, dict):
            return "Each series entry must be an object."
        unsupported = set(item.keys()) - _SERIES_KEYS
        if unsupported:
            return "Series entries contain unsupported fields."
        key = item.get("key")
        if not _is_text(key, 80):
            return "Each series entry needs a non-empty key."
        if not _is_text(item.get("label"), 120):
            return "Each series entry needs a non-empty label."
        series_keys.append(key)
    if len(set(series_keys)) != len(series_keys):
        return "Series keys must be unique."

    data = args.get("data")
    if not isinstance(data, list) or not (1 <= len(data) <= 50):
        return "data must contain 1 to 50 rows."
    for index, row in enumerate(data):
        if not isinstance(row, dict):
            return f"data[{index}] must be an object."
        for field, value in row.items():
            if not _is_json_primitive(value):
                return f"data[{index}].{field} must be a JSON primitive."
        x_value = row.get(x_key)
        if not isinstance(x_value, (str, int, float)) or isinstance(x_value, bool):
            return f"data[{index}].{x_key} must be a string or number."
        for key in series_keys:
            if _coerce_chart_number(row.get(key), allow_negative=allow_negative) is None:
                return f"data[{index}].{key} must be a {value_message}."

    return None


def _validate_tavern_render_bar_chart(args: Any) -> Optional[str]:
    return _validate_tavern_chart(args, allow_negative=False)


def _validate_tavern_render_line_chart(args: Any) -> Optional[str]:
    return _validate_tavern_chart(args, allow_negative=True)


def _handle_tavern_render_bar_chart(args: Any, **_kwargs) -> str:
    error = _validate_tavern_render_bar_chart(args)
    if error:
        return tool_error(error)
    return tool_result({"status": "rendered"})


def _handle_tavern_render_line_chart(args: Any, **_kwargs) -> str:
    error = _validate_tavern_render_line_chart(args)
    if error:
        return tool_error(error)
    return tool_result({"status": "rendered"})


def _env_enablement() -> Optional[dict]:
    runtime_url = os.getenv("TAVERN_RUNTIME_URL", "").strip()
    home_chat = os.getenv("TAVERN_HOME_CHAT", "").strip()
    if not runtime_url:
        return None
    seed = {"runtime_url": runtime_url}
    token = os.getenv("TAVERN_RUNTIME_TOKEN", "").strip()
    if token:
        seed["token"] = token
    if home_chat:
        seed["home_channel"] = {
            "chat_id": home_chat,
            "name": os.getenv("TAVERN_HOME_CHAT_NAME", home_chat),
        }
    return seed


def _post_delivery(
    runtime_url: str,
    token: str,
    chat_id: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if not runtime_url:
        return {"error": "TAVERN_RUNTIME_URL is not configured"}
    if not chat_id:
        return {"error": "Tavern chat id is required"}
    payload = {
        "chatId": chat_id,
        "content": content,
        "metadata": metadata or {},
    }
    request = urllib.request.Request(
        runtime_url + "/cron/deliveries",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            **({"Authorization": "Bearer " + token} if token else {}),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {"success": True}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        return {"error": f"Tavern Runtime HTTP {exc.code}: {detail}"}
    except Exception as exc:
        return {"error": f"Tavern Runtime delivery failed: {exc}"}


class TavernAdapter(BasePlatformAdapter):
    def __init__(self, config: PlatformConfig):
        super().__init__(config=config, platform=Platform("tavern"))
        self._extra = config.extra or {}
        self._runtime_url = _runtime_url(self._extra)
        self._token = _token(self._extra)

    async def connect(self) -> bool:
        if not self._runtime_url:
            return False
        self._mark_connected()
        return True

    async def disconnect(self) -> None:
        self._mark_disconnected()

    async def send(self, chat_id: str, content: str, reply_to=None, metadata=None) -> SendResult:
        result = _post_delivery(
            self._runtime_url,
            self._token,
            chat_id,
            content,
            metadata if isinstance(metadata, dict) else None,
        )
        if result.get("success"):
            return SendResult(success=True, message_id=result.get("message_id"), raw_response=result)
        return SendResult(success=False, error=result.get("error") or "Tavern delivery failed")

    async def get_chat_info(self, chat_id: str) -> Dict[str, Any]:
        return {"name": chat_id, "type": "channel"}


async def _standalone_send(
    pconfig,
    chat_id: str,
    message: str,
    *,
    thread_id: Optional[str] = None,
    media_files=None,
    force_document: bool = False,
) -> Dict[str, Any]:
    extra = getattr(pconfig, "extra", {}) or {}
    metadata = {"thread_id": thread_id} if thread_id else {}
    return _post_delivery(_runtime_url(extra), _token(extra), chat_id, message, metadata)


def register(ctx) -> None:
    ctx.register_tool(
        name="${tavernRenderBarChartToolName}",
        toolset="tavern",
        schema=TAVERN_RENDER_BAR_CHART_SCHEMA,
        handler=_handle_tavern_render_bar_chart,
        description="Render prepared categorical data as a simple vertical bar chart in chat.",
        emoji="📊",
    )
    ctx.register_tool(
        name="${tavernRenderLineChartToolName}",
        toolset="tavern",
        schema=TAVERN_RENDER_LINE_CHART_SCHEMA,
        handler=_handle_tavern_render_line_chart,
        description="Render prepared numeric data as a simple trend chart in chat.",
        emoji="📈",
    )
    ctx.register_platform(
        name="tavern",
        label="Tavern",
        adapter_factory=lambda cfg: TavernAdapter(cfg),
        check_fn=check_requirements,
        validate_config=validate_config,
        is_connected=is_connected,
        required_env=["TAVERN_RUNTIME_URL", "TAVERN_HOME_CHAT"],
        env_enablement_fn=_env_enablement,
        cron_deliver_env_var="TAVERN_HOME_CHAT",
        standalone_sender_fn=_standalone_send,
        allow_update_command=False,
        max_message_length=0,
        pii_safe=True,
        platform_hint="You are delivering into a Tavern chat. Use plain text unless the chat context asks otherwise.",
    )
`;
