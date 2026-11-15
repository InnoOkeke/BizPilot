# Privacy Policy — BizPilot AI

Last updated: November 15, 2026

BizPilot AI is an Anna AI OS application. It operates strictly within the Anna AI OS runtime and does not operate external tracking servers or sell user data.

## Data Storage & Processing

- **Workspace Data:** Business profiles, product catalogs, FAQs, quotes, invoices, and orders are stored in your isolated per-user Anna AI OS storage (`anna.storage`).
- **AI Inference:** Customer Q&A, invoice drafting, status updates, and follow-up suggestions are processed through Anna AI OS (`anna.llm.complete`) under your active Anna account permissions.
- **Executa Tooling:** Deterministic calculations, profile validation, and status transitions run inside the BizPilot AI Executa plugin (`tool-leprof-bizpilot-ai-tools-a9tswjax`) without retaining external copies of your business records.

## Third-Party Access

BizPilot AI declares zero external network origins (`external_origins: []`) in its Anna AI OS manifest and does not transmit your business data to third-party analytics or advertising services.

## Contact

For privacy or support inquiries, please open an issue on the project's support page.
