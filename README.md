# BizPilot AI

An AI-native small business operations workspace built for **Anna AI OS**.

## Features

- **Front Desk (Customer Q&A):** Answers customer inquiries grounded strictly in your verified catalog, FAQs, and order history, with one-click quote creation.
- **Quotes & Invoices:** Natural-language AI drafting and manual line-item builder backed by deterministic `Decimal` calculations, state-machine validation, quote-to-invoice conversion, and print/PDF export.
- **Orders:** Structured order pipeline (`pending` → `in_progress` → `ready` → `completed` / `cancelled`) with AI-drafted customer status updates.
- **Follow-Ups:** Surfaces sent quotes and unpaid or overdue invoices for human-in-the-loop follow-up review.
- **Business Brain:** Centralized company profile, ISO 4217 currency, tax rate, product/service catalog, and FAQ knowledge base.

## Architecture

- **Frontend (`src/` → `bundle/`):** React, TypeScript, and Vite compiled into a self-contained static SPA with `external_origins: []` and host light/dark theme synchronization via `AnnaAppRuntime`.
- **Executa Plugin (`executas/bizpilot-ai/`):** Python stdio JSON-RPC 2.0 plugin (`tool-leprof-bizpilot-ai-tools-a9tswjax`) exposing schema-validated tools for both the UI and other Anna AI agents.

## Development & Verification

```powershell
# Run Python Executa unit tests
python -m unittest discover -s executas/bizpilot-ai/tests -v

# Type-check and build the static SPA bundle
npm run build

# Validate Anna AI OS manifest and bundle
npx @anna-ai/cli validate

# Run local Anna AI OS dev harness
npx @anna-ai/cli dev --slug bizpilot-ai
```
