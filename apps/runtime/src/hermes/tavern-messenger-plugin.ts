import fs from 'node:fs/promises';
import path from 'node:path';
import { HERMES_HOME } from '../config';

const PLUGIN_NAME = 'tavern-messenger-platform';
const PLUGIN_DIR = path.join(HERMES_HOME, 'plugins', 'platforms', 'tavern-messenger');

export function tavernMessengerPluginName() {
    return PLUGIN_NAME;
}

export async function ensureTavernMessengerPlugin() {
    await fs.mkdir(PLUGIN_DIR, { recursive: true });
    await Promise.all([
        fs.writeFile(path.join(PLUGIN_DIR, 'plugin.yaml'), PLUGIN_MANIFEST),
        fs.writeFile(path.join(PLUGIN_DIR, '__init__.py'), PLUGIN_SOURCE),
    ]);
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
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import BasePlatformAdapter, SendResult


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
