---
name: merchbase
description: >
  Use for MerchBase sales questions, Amazon Merch sales trends, MerchBase
  Integration health, and when to present the MerchBase sales chart.
---

# MerchBase

Managed by Tavern Runtime. Do not edit this skill directory; Runtime refreshes
it on startup. For durable agent-managed skill changes, create or update a
separate skill in your normal skills directory.

MerchBase is a Tavern Integration. Tavern Runtime owns its settings, health,
secrets, and read-oriented data actions.

## Tools

Use the `merchbase` toolset. These are the agent-facing MerchBase tools:

| Tool | Use |
| --- | --- |
| `merchbase_status` | Read masked Integration settings and health. |
| `merchbase_sales_summary` | Sales totals for a range. |
| `merchbase_sales_records` | Paginated sale rows for inspection. |
| `merchbase_sales_series` | Time series for trend reasoning. |
| `merchbase_sales_breakdown` | Grouped sales totals by marketplace, ASIN, product type, fit, color, or facet. |
| `merchbase_products_search` | Search products by text or filters. |
| `merchbase_products_list` | List products by status or marketplace. |
| `merchbase_products_get` | Get a product by ASIN and marketplace. |
| `merchbase_products_metadata` | Read product metadata. |
| `merchbase_product_catalog`, `merchbase_product_catalog_options`, `merchbase_product_catalog_product` | Read catalog metadata. |
| `merchbase_designs_list`, `merchbase_designs_get`, `merchbase_design_facets_get` | Read designs and design facets. |

Common sales fields:

| Field | Use |
| --- | --- |
| `range` | MerchBase range such as `10d`, `30d`, or a supported explicit range. |
| `bucket` | `day`, `week`, or `month`. |
| `marketplace` | Optional marketplace filter such as `US`. |
| `asin`, `productType`, `color`, `fit`, `facet`, `facetName` | Optional product filters. |

## Rich Responses

When answering in Tavern and the user wants sales trends over a date range,
prefer the `MerchBaseSalesChart` Rich Response. It fetches live sales data
itself through Runtime and includes the date range selector.

For "today" or current sales requests, keep trend context: use the default
10-day chart range unless the user explicitly asks for a one-day chart.

Do not fetch sales data just to fill chart props. The chart props are query
intent, such as `rangeDays`, `endDate`, `marketplace`, or product filters.

Fetch sales data yourself only when you need to reason about the values, cite
numbers in prose, compare periods, or answer without a Rich Response.

## Boundaries

- Do not run sync, ripcord, ingestion, account switching, setup repair, or
  secret-changing flows.
- Do not read or change API keys. MerchBase credentials live in Settings ->
  Integrations.
- If MerchBase is disabled or unhealthy, say that and direct the user to
  Settings -> Integrations.
