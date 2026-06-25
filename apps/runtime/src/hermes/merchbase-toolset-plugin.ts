import fs from 'node:fs/promises';
import path from 'node:path';
import { HERMES_HOME } from '../config';
import { resolveRuntimeAssetsRoot } from './managed-vault';

const PLUGIN_NAME = 'merchbase';
const PLUGIN_SKILL_NAME = 'merchbase';

export function merchbaseToolsetPluginName() {
    return PLUGIN_NAME;
}

export function merchbaseToolsetPluginSource() {
    return PLUGIN_SOURCE;
}

export async function ensureManagedMerchbaseToolsetPlugin(
    input: { assetsRoot?: string; hermesHome?: string } = {}
) {
    const assetsRoot = input.assetsRoot ?? resolveRuntimeAssetsRoot();
    const pluginDir = path.join(input.hermesHome ?? HERMES_HOME, 'plugins', 'merchbase');
    const skillSource = path.join(assetsRoot, 'hermes', 'skills', PLUGIN_SKILL_NAME);
    const pluginSkillDir = path.join(pluginDir, 'skills', PLUGIN_SKILL_NAME);
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.mkdir(path.dirname(pluginSkillDir), { recursive: true });
    await fs.rm(pluginSkillDir, { force: true, recursive: true });
    await Promise.all([
        fs.cp(skillSource, pluginSkillDir, {
            errorOnExist: false,
            force: true,
            recursive: true,
            verbatimSymlinks: true,
        }),
        fs.writeFile(path.join(pluginDir, 'plugin.yaml'), PLUGIN_MANIFEST),
        fs.writeFile(path.join(pluginDir, '__init__.py'), PLUGIN_SOURCE),
    ]);
    return { pluginDir, skillPath: path.join(pluginSkillDir, 'SKILL.md') };
}

const PROVIDES_TOOLS = [
    'merchbase_status',
    'merchbase_sales_summary',
    'merchbase_sales_records',
    'merchbase_sales_series',
    'merchbase_sales_breakdown',
    'merchbase_products_list',
    'merchbase_products_search',
    'merchbase_products_get',
    'merchbase_products_metadata',
    'merchbase_product_catalog',
    'merchbase_product_catalog_options',
    'merchbase_product_catalog_product',
    'merchbase_designs_list',
    'merchbase_designs_get',
    'merchbase_design_facets_get',
];

const PLUGIN_MANIFEST = `name: ${PLUGIN_NAME}
label: MerchBase
kind: standalone
version: 1.0.0
description: Tavern Runtime MerchBase toolset for read-only sales, product, catalog, and design queries.
author: Tavern
requires_env:
  - name: TAVERN_RUNTIME_URL
    description: Tavern Runtime base URL.
    prompt: Tavern Runtime URL
    password: false
provides_tools:
${PROVIDES_TOOLS.map((name) => `  - ${name}`).join('\n')}
`;

const PLUGIN_SOURCE = `import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from tools.registry import tool_error, tool_result


TOOLSET = "merchbase"
TIMEOUT_SECONDS = 45
GUIDANCE_SKILL = "merchbase:merchbase"
GUIDANCE_NOTE = f"For MerchBase workflow rules, sales display choices, and widget guidance, load the {GUIDANCE_SKILL} skill with skill_view."


def _runtime_url() -> str:
    return os.getenv("TAVERN_RUNTIME_URL", "").strip().rstrip("/")


def _runtime_token() -> str:
    return os.getenv("TAVERN_RUNTIME_TOKEN", "").strip()


def _check_merchbase_configured() -> bool:
    if not _runtime_url():
        return False
    settings = _runtime_request("/plugins/merchbase/settings")
    return bool(settings.get("enabled") and settings.get("apiKeyConfigured"))


def _clean_args(args: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(args, dict):
        return {}
    return {key: value for key, value in args.items() if value is not None}


def _runtime_request(path: str, *, method: str = "GET", payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    runtime_url = _runtime_url()
    if not runtime_url:
        return {"error": "TAVERN_RUNTIME_URL is not configured."}

    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    token = _runtime_token()
    if token:
        headers["Authorization"] = "Bearer " + token

    request = urllib.request.Request(
        runtime_url + path,
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {"success": True}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:1000]
        return {
            "error": "Tavern Runtime HTTP " + str(exc.code) + ": " + detail,
            "status": exc.code,
        }
    except Exception as exc:
        return {"error": "Tavern Runtime request failed: " + str(exc)}


def _respond(payload: Dict[str, Any]) -> str:
    if isinstance(payload, dict) and payload.get("error"):
        extra = dict(payload)
        message = str(extra.pop("error"))
        return tool_error(message, **extra)
    return tool_result(payload)


def _action(action: str, input_payload: Optional[Dict[str, Any]] = None) -> str:
    return _respond(
        _runtime_request(
            "/plugins/merchbase/action",
            method="POST",
            payload={"action": action, "input": _clean_args(input_payload)},
        )
    )


def _handle_status(args: Dict[str, Any], **_kw) -> str:
    settings = _runtime_request("/plugins/merchbase/settings")
    capability = _runtime_request("/capabilities/plugin.merchbase")
    return _respond({"settings": settings, "capability": capability})


def _handle_sales_summary(args: Dict[str, Any], **_kw) -> str:
    return _action("sales.summary", args)


def _handle_sales_records(args: Dict[str, Any], **_kw) -> str:
    return _action("sales.records", args)


def _handle_sales_series(args: Dict[str, Any], **_kw) -> str:
    return _respond(
        _runtime_request(
            "/plugins/merchbase/sales/series",
            method="POST",
            payload=_clean_args(args),
        )
    )


def _handle_sales_breakdown(args: Dict[str, Any], **_kw) -> str:
    return _action("sales.breakdown", args)


def _handle_products_list(args: Dict[str, Any], **_kw) -> str:
    return _action("products.list", args)


def _handle_products_search(args: Dict[str, Any], **_kw) -> str:
    return _action("products.search", args)


def _handle_products_get(args: Dict[str, Any], **_kw) -> str:
    return _action("products.get", args)


def _handle_products_metadata(args: Dict[str, Any], **_kw) -> str:
    return _action("products.metadata", args)


def _handle_product_catalog(args: Dict[str, Any], **_kw) -> str:
    return _action("products.catalog.get", args)


def _handle_product_catalog_options(args: Dict[str, Any], **_kw) -> str:
    return _action("products.catalog.options", args)


def _handle_product_catalog_product(args: Dict[str, Any], **_kw) -> str:
    return _action("products.catalog.product", args)


def _handle_designs_list(args: Dict[str, Any], **_kw) -> str:
    return _action("designs.list", args)


def _handle_designs_get(args: Dict[str, Any], **_kw) -> str:
    return _action("designs.get", args)


def _handle_design_facets_get(args: Dict[str, Any], **_kw) -> str:
    return _action("designs.facets.get", args)


def _schema(description: str, properties: Optional[Dict[str, Any]] = None, required: Optional[List[str]] = None) -> Dict[str, Any]:
    return {
        "type": "object",
        "description": description + " " + GUIDANCE_NOTE,
        "properties": properties or {},
        "required": required or [],
        "additionalProperties": False,
    }


def _string(description: str) -> Dict[str, Any]:
    return {"type": "string", "description": description}


def _integer(description: str, default: Optional[int] = None) -> Dict[str, Any]:
    schema = {"type": "integer", "description": description, "minimum": 0}
    if default is not None:
        schema["default"] = default
    return schema


FILTER_PROPS = {
    "range": _string("MerchBase range such as 7d, 10d, 30d, or an explicit supported range."),
    "marketplace": _string("Optional marketplace filter such as US."),
    "asin": _string("Optional ASIN filter."),
    "productType": _string("Optional product type filter."),
    "fit": _string("Optional fit filter."),
    "color": _string("Optional color filter."),
    "facet": _string("Optional facet id filter."),
    "facetName": _string("Optional facet name filter."),
}

PAGINATION_PROPS = {
    "limit": _integer("Maximum row count.", 25),
    "offset": _integer("Pagination offset.", 0),
}

SALES_FILTER_SCHEMA = _schema("Read MerchBase sales using optional date and product filters.", FILTER_PROPS)
SALES_RECORDS_SCHEMA = _schema(
    "Read paginated MerchBase sales records.",
    {**FILTER_PROPS, **PAGINATION_PROPS},
)
SALES_SERIES_SCHEMA = _schema(
    "Read a MerchBase sales time series for charting or trend reasoning.",
    {
        **FILTER_PROPS,
        "bucket": {"type": "string", "enum": ["day", "week", "month"], "default": "day"},
    },
)
SALES_BREAKDOWN_SCHEMA = _schema(
    "Read grouped MerchBase sales totals.",
    {
        **FILTER_PROPS,
        **PAGINATION_PROPS,
        "groupBy": {
            "type": "string",
            "enum": ["marketplace", "asin", "productType", "fit", "color", "facet"],
            "description": "Dimension to group sales by.",
        },
        "direction": {"type": "string", "enum": ["asc", "desc"], "default": "desc"},
        "sort": _string("Optional sort field."),
    },
    ["groupBy"],
)
PRODUCT_LIST_SCHEMA = _schema(
    "List MerchBase products.",
    {**PAGINATION_PROPS, "marketplace": _string("Optional marketplace filter."), "status": _string("Optional product status filter.")},
)
PRODUCT_SEARCH_SCHEMA = _schema(
    "Search MerchBase products.",
    {
        **PAGINATION_PROPS,
        "query": _string("Search text."),
        "marketplace": _string("Optional marketplace filter."),
        "facet": _string("Optional facet id filter."),
        "facetName": _string("Optional facet name filter."),
    },
)
PRODUCT_GET_SCHEMA = _schema(
    "Get one MerchBase product by ASIN and marketplace.",
    {"asin": _string("Product ASIN."), "marketplace": _string("Marketplace such as US.")},
    ["asin"],
)
PRODUCT_METADATA_SCHEMA = _schema(
    "Read MerchBase product metadata.",
    {"asin": _string("Optional ASIN."), "marketplace": _string("Optional marketplace filter.")},
)
CATALOG_OPTIONS_SCHEMA = _schema(
    "Read MerchBase catalog options.",
    {"productType": _string("Optional product type filter.")},
)
CATALOG_PRODUCT_SCHEMA = _schema(
    "Read MerchBase catalog metadata for a product type.",
    {"productType": _string("Product type.")},
    ["productType"],
)
DESIGNS_LIST_SCHEMA = _schema(
    "List MerchBase designs.",
    {
        **PAGINATION_PROPS,
        "query": _string("Optional search text."),
        "facet": _string("Optional facet id filter."),
        "facetName": _string("Optional facet name filter."),
    },
)
DESIGN_ID_SCHEMA = _schema(
    "Read a MerchBase design resource by id.",
    {"designId": _string("Design id.")},
    ["designId"],
)


TOOLS = (
    ("merchbase_status", _schema("Read MerchBase Plugin health and masked settings."), _handle_status, "🏷️"),
    ("merchbase_sales_summary", SALES_FILTER_SCHEMA, _handle_sales_summary, "📈"),
    ("merchbase_sales_records", SALES_RECORDS_SCHEMA, _handle_sales_records, "🧾"),
    ("merchbase_sales_series", SALES_SERIES_SCHEMA, _handle_sales_series, "📊"),
    ("merchbase_sales_breakdown", SALES_BREAKDOWN_SCHEMA, _handle_sales_breakdown, "🧮"),
    ("merchbase_products_list", PRODUCT_LIST_SCHEMA, _handle_products_list, "📦"),
    ("merchbase_products_search", PRODUCT_SEARCH_SCHEMA, _handle_products_search, "🔎"),
    ("merchbase_products_get", PRODUCT_GET_SCHEMA, _handle_products_get, "🔖"),
    ("merchbase_products_metadata", PRODUCT_METADATA_SCHEMA, _handle_products_metadata, "🗂️"),
    ("merchbase_product_catalog", _schema("Read the MerchBase product catalog."), _handle_product_catalog, "📚"),
    ("merchbase_product_catalog_options", CATALOG_OPTIONS_SCHEMA, _handle_product_catalog_options, "🧩"),
    ("merchbase_product_catalog_product", CATALOG_PRODUCT_SCHEMA, _handle_product_catalog_product, "🧵"),
    ("merchbase_designs_list", DESIGNS_LIST_SCHEMA, _handle_designs_list, "🎨"),
    ("merchbase_designs_get", DESIGN_ID_SCHEMA, _handle_designs_get, "🖼️"),
    ("merchbase_design_facets_get", DESIGN_ID_SCHEMA, _handle_design_facets_get, "🧱"),
)


def register(ctx) -> None:
    ctx.register_skill(
        "merchbase",
        Path(__file__).parent / "skills" / "merchbase" / "SKILL.md",
        "MerchBase Plugin guidance for tools and sales widgets.",
    )
    for name, schema, handler, emoji in TOOLS:
        ctx.register_tool(
            name=name,
            toolset=TOOLSET,
            schema=schema,
            handler=handler,
            check_fn=_check_merchbase_configured,
            description=schema.get("description", ""),
            emoji=emoji,
        )
`;
