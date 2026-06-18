import fs from 'node:fs/promises';
import path from 'node:path';
import {
    tavernRenderBarChartToolName,
    tavernRenderCalendarEventToolName,
    tavernRenderLineChartToolName,
} from '@tavern/api';

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

const PLUGIN_SOURCE = `import datetime
import json
import math
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import BasePlatformAdapter, SendResult
from tools.registry import tool_error, tool_result


_CHART_NUMBER_PATTERN = re.compile(r"^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?$")
_CALENDAR_DATE_PATTERN = re.compile(r"^\\d{4}-\\d{2}-\\d{2}$")
_CALENDAR_DATETIME_PATTERN = re.compile(r"^(\\d{4}-\\d{2}-\\d{2})T(\\d{2}:\\d{2})")
_CALENDAR_OFFSET_PATTERN = re.compile(r"(?:Z|[+-]\\d{2}:?\\d{2})$", re.IGNORECASE)
_CALENDAR_TIME_PATTERN = re.compile(r"^(?:[01]\\d|2[0-3]):[0-5]\\d$")
_ROOT_KEYS = {"title", "xKey", "series", "data"}
_CALENDAR_ROOT_KEYS = {
    "calendar",
    "description",
    "end",
    "location",
    "notes",
    "start",
    "summary",
    "timezone",
    "title",
}
_CALENDAR_TIME_KEYS = {"date", "dateTime", "timeZone"}
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

TAVERN_RENDER_CALENDAR_EVENT_SCHEMA = {
    "name": "${tavernRenderCalendarEventToolName}",
    "description": "Use when the user asks to see one prepared single-day calendar event in chat. Input is shaped like Google Calendar event data: summary, start, end, location, and description.",
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "required": ["start"],
        "properties": {
            "summary": {
                "type": "string",
                "minLength": 1,
                "maxLength": 160,
                "description": "Google Calendar event summary. Use title only when summary is unavailable.",
            },
            "title": {
                "type": "string",
                "minLength": 1,
                "maxLength": 160,
                "description": "Fallback event title when summary is unavailable.",
            },
            "start": {
                "type": "object",
                "additionalProperties": False,
                "description": "Google Calendar start object. Use date for all-day events or dateTime for timed events.",
                "properties": {
                    "date": {
                        "type": "string",
                        "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$",
                        "description": "All-day event date as YYYY-MM-DD.",
                    },
                    "dateTime": {
                        "type": "string",
                        "description": "Timed event start as an ISO date-time.",
                    },
                    "timeZone": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 80,
                        "description": "IANA time zone from Google Calendar.",
                    },
                },
            },
            "end": {
                "type": "object",
                "additionalProperties": False,
                "description": "Google Calendar end object. All-day end.date is exclusive and must be the next day.",
                "properties": {
                    "date": {
                        "type": "string",
                        "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$",
                        "description": "Exclusive all-day end date as YYYY-MM-DD.",
                    },
                    "dateTime": {
                        "type": "string",
                        "description": "Timed event end as an ISO date-time.",
                    },
                    "timeZone": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 80,
                        "description": "IANA time zone from Google Calendar.",
                    },
                },
            },
            "timezone": {
                "type": "string",
                "minLength": 1,
                "maxLength": 80,
                "description": "Optional fallback IANA time zone or short display label.",
            },
            "location": {
                "type": "string",
                "minLength": 1,
                "maxLength": 160,
                "description": "Optional event location.",
            },
            "calendar": {
                "type": "string",
                "minLength": 1,
                "maxLength": 80,
                "description": "Optional calendar name.",
            },
            "description": {
                "type": "string",
                "minLength": 1,
                "maxLength": 280,
                "description": "Optional short Google Calendar description.",
            },
            "notes": {
                "type": "string",
                "minLength": 1,
                "maxLength": 280,
                "description": "Fallback short note when description is unavailable.",
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


def _is_calendar_date(value: Any) -> bool:
    if not isinstance(value, str) or not _CALENDAR_DATE_PATTERN.fullmatch(value.strip()):
        return False
    year, month, day = [int(part) for part in value.strip().split("-")]
    if month < 1 or month > 12 or day < 1:
        return False
    month_lengths = [31, 29 if _is_leap_year(year) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return day <= month_lengths[month - 1]


def _is_leap_year(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def _is_time(value: Any) -> bool:
    return isinstance(value, str) and bool(_CALENDAR_TIME_PATTERN.fullmatch(value.strip()))


def _minutes(value: str) -> int:
    hour, minute = value.strip().split(":")
    return int(hour) * 60 + int(minute)


def _next_calendar_date(value: str) -> str:
    return (datetime.date.fromisoformat(value.strip()) + datetime.timedelta(days=1)).isoformat()


def _calendar_datetime_parts(value: Any, timezone: Any = None) -> Optional[Dict[str, str]]:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    match = _CALENDAR_DATETIME_PATTERN.match(stripped)
    if not match:
        return None
    date, time = match.groups()
    if not _is_calendar_date(date) or not _is_time(time):
        return None
    if isinstance(timezone, str) and _CALENDAR_OFFSET_PATTERN.search(stripped):
        try:
            local = datetime.datetime.fromisoformat(
                stripped.replace("Z", "+00:00").replace("z", "+00:00")
            ).astimezone(ZoneInfo(timezone))
            return {"date": local.date().isoformat(), "time": local.strftime("%H:%M")}
        except (ValueError, ZoneInfoNotFoundError):
            pass
    return {"date": date, "time": time}


def _validate_calendar_time(value: Any, label: str) -> Optional[str]:
    if not isinstance(value, dict):
        return f"{label} must be an object."
    unsupported = set(value.keys()) - _CALENDAR_TIME_KEYS
    if unsupported:
        return f"{label} contains unsupported fields."
    has_date = "date" in value
    has_date_time = "dateTime" in value
    if has_date == has_date_time:
        return f"{label} needs exactly one of date or dateTime."
    if has_date and not _is_calendar_date(value.get("date")):
        return f"{label}.date must be a real YYYY-MM-DD calendar date."
    if has_date_time and _calendar_datetime_parts(value.get("dateTime"), value.get("timeZone")) is None:
        return f"{label}.dateTime must start with an ISO date and HH:mm time."
    if "timeZone" in value and not _is_text(value.get("timeZone"), 80):
        return f"{label}.timeZone must be a non-empty string."
    return None


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


def _validate_tavern_render_calendar_event(args: Any) -> Optional[str]:
    if not isinstance(args, dict):
        return "Input must be an object."
    unsupported = set(args.keys()) - _CALENDAR_ROOT_KEYS
    if unsupported:
        return "Input contains unsupported fields."
    if "summary" not in args and "title" not in args:
        return "summary or title is required."
    if "summary" in args and not _is_text(args.get("summary"), 160):
        return "summary must be a non-empty string."
    if "title" in args and not _is_text(args.get("title"), 160):
        return "title must be a non-empty string."

    for key, max_len in {
        "calendar": 80,
        "description": 280,
        "location": 160,
        "notes": 280,
        "timezone": 80,
    }.items():
        if key in args and not _is_text(args.get(key), max_len):
            return f"{key} must be a non-empty string."

    start = args.get("start")
    start_error = _validate_calendar_time(start, "start")
    if start_error:
        return start_error

    end = args.get("end")
    if end is not None:
        end_error = _validate_calendar_time(end, "end")
        if end_error:
            return end_error

    if "date" in start:
        if isinstance(end, dict) and "dateTime" in end:
            return "All-day events need end.date or no end."
        if isinstance(end, dict) and end.get("date") != _next_calendar_date(start["date"]):
            return "Multi-day calendar events are not supported."
        return None

    if not isinstance(end, dict) or "dateTime" not in end:
        return "Timed events need end.dateTime."

    timezone = start.get("timeZone") or end.get("timeZone") or args.get("timezone")
    start_parts = _calendar_datetime_parts(start.get("dateTime"), start.get("timeZone") or timezone)
    end_parts = _calendar_datetime_parts(end.get("dateTime"), end.get("timeZone") or timezone)
    if start_parts is None or end_parts is None:
        return "Timed events need ISO dateTime values."
    if start_parts["date"] != end_parts["date"]:
        return "Multi-day calendar events are not supported."
    if _minutes(end_parts["time"]) <= _minutes(start_parts["time"]):
        return "end.dateTime must be later than start.dateTime."

    return None


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


def _handle_tavern_render_calendar_event(args: Any, **_kwargs) -> str:
    error = _validate_tavern_render_calendar_event(args)
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
    ctx.register_tool(
        name="${tavernRenderCalendarEventToolName}",
        toolset="tavern",
        schema=TAVERN_RENDER_CALENDAR_EVENT_SCHEMA,
        handler=_handle_tavern_render_calendar_event,
        description="Render one prepared calendar event in chat.",
        emoji="📅",
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
