import { useEffect, useState } from "react";
import { ArrowRightLeft, FileCheck2, Plus, Printer, Sparkles, Trash2 } from "lucide-react";
import type { BusinessProfile, DocumentRecord, DocumentType, LineItem } from "../types";
import type { AnnaRuntimeInstance } from "../lib/annaClient";
import { completeWithAnnaJson, invokeExecuta } from "../lib/annaClient";
import { formatMoney, formatShortDate, generateId, nextDocumentNumber } from "../lib/format";

interface DocumentsViewProps {
  anna: AnnaRuntimeInstance;
  profile: BusinessProfile | null;
  documents: DocumentRecord[];
  prefill?: { customerName: string; items: LineItem[]; notes: string } | null;
  onClearPrefill: () => void;
  onSaveDocuments: (docs: DocumentRecord[]) => Promise<void>;
  onCreateOrderFromInvoice: (doc: DocumentRecord) => Promise<void>;
  onGoToSettings: () => void;
}

interface CalculatedDoc {
  doc_type: DocumentType;
  currency: string;
  items: LineItem[];
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
}

interface ParsedAiDoc {
  doc_type?: DocumentType;
  customer_name?: string;
  customer_email?: string;
  due_date?: string;
  notes?: string;
  items?: LineItem[];
}

function statusPillClass(status: string): string {
  switch (status) {
    case "paid":
    case "accepted":
      return "pill-success";
    case "sent":
      return "pill-info";
    case "overdue":
    case "declined":
    case "void":
      return "pill-danger";
    default:
      return "pill-neutral";
  }
}

export function DocumentsView({
  anna,
  profile,
  documents,
  prefill,
  onClearPrefill,
  onSaveDocuments,
  onCreateOrderFromInvoice,
  onGoToSettings,
}: DocumentsViewProps) {
  const [docType, setDocType] = useState<DocumentType>("quote");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [parsingAi, setParsingAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);

  useEffect(() => {
    if (prefill) {
      setDocType("quote");
      setCustomerName(prefill.customerName);
      setItems(prefill.items.length > 0 ? prefill.items : [{ description: "", quantity: 1, unit_price: 0 }]);
      setNotes(prefill.notes);
      onClearPrefill();
    }
  }, [prefill, onClearPrefill]);

  if (!profile) {
    return (
      <div className="card empty-state">
        <h3>Configure Your Business Brain First</h3>
        <p>Set your currency, tax rate, and business details before issuing quotes or invoices.</p>
        <button type="button" className="btn btn-primary" onClick={onGoToSettings}>
          Set Up Business Brain
        </button>
      </div>
    );
  }

  const handleAiDraft = async () => {
    if (!aiPrompt.trim()) return;
    setError(null);
    setParsingAi(true);
    try {
      const catalogText = profile.catalog
        .map((c) => `${c.name}: ${profile.currency} ${c.unit_price} per ${c.unit}`)
        .join("; ");
      const systemPrompt =
        `Extract structured quote/invoice fields for ${profile.business_name} (${profile.currency}). ` +
        `Catalog reference: ${catalogText || "none"}. ` +
        `Return strict JSON with keys: doc_type ('quote'|'invoice'), customer_name, customer_email, due_date (YYYY-MM-DD or ''), notes, ` +
        `items (array of {description, quantity, unit_price}). Never invent catalog prices if they are in the catalog.`;
      const parsed = await completeWithAnnaJson<ParsedAiDoc>(anna, systemPrompt, aiPrompt.trim());
      if (parsed.doc_type === "quote" || parsed.doc_type === "invoice") setDocType(parsed.doc_type);
      if (parsed.customer_name) setCustomerName(parsed.customer_name);
      if (parsed.customer_email) setCustomerEmail(parsed.customer_email);
      if (parsed.due_date) setDueDate(parsed.due_date);
      if (parsed.notes) setNotes(parsed.notes);
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(
          parsed.items.map((it) => ({
            description: String(it.description || ""),
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse natural-language draft.");
    } finally {
      setParsingAi(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const calc = await invokeExecuta<CalculatedDoc>(anna, "calculate_document", {
        doc_type: docType,
        currency: profile.currency,
        tax_rate: profile.tax_rate,
        discount_amount: Number(discountAmount) || 0,
        items: items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
        })),
      });

      const now = new Date().toISOString();
      const sameTypeCount = documents.filter((d) => d.doc_type === docType).length;
      const newDoc: DocumentRecord = {
        id: generateId("doc"),
        doc_number: nextDocumentNumber(docType, sameTypeCount),
        doc_type: calc.doc_type,
        status: "draft",
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        currency: calc.currency,
        tax_rate: calc.tax_rate,
        discount_amount: calc.discount_amount,
        items: calc.items,
        subtotal: calc.subtotal,
        tax_amount: calc.tax_amount,
        total: calc.total,
        due_date: dueDate.trim(),
        notes: notes.trim(),
        created_at: now,
        updated_at: now,
      };

      await onSaveDocuments([newDoc, ...documents]);
      setCustomerName("");
      setCustomerEmail("");
      setDueDate("");
      setDiscountAmount(0);
      setNotes("");
      setItems([{ description: "", quantity: 1, unit_price: 0 }]);
      setAiPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create document.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransition = async (doc: DocumentRecord, targetStatus: string) => {
    setError(null);
    try {
      const res = await invokeExecuta<{ status: DocumentRecord["status"] }>(
        anna,
        "transition_document_status",
        {
          doc_type: doc.doc_type,
          current_status: doc.status,
          target_status: targetStatus,
        }
      );
      const now = new Date().toISOString();
      const updated = documents.map((d) =>
        d.id === doc.id ? { ...d, status: res.status, updated_at: now } : d
      );
      await onSaveDocuments(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status transition rejected.");
    }
  };

  const handleConvertQuote = async (quote: DocumentRecord) => {
    setError(null);
    try {
      await invokeExecuta(anna, "transition_document_status", {
        doc_type: "quote",
        current_status: quote.status,
        convert_to_invoice: true,
      });
      const now = new Date().toISOString();
      const invoiceCount = documents.filter((d) => d.doc_type === "invoice").length;
      const newInvoice: DocumentRecord = {
        ...quote,
        id: generateId("doc"),
        doc_number: nextDocumentNumber("invoice", invoiceCount),
        doc_type: "invoice",
        status: "draft",
        created_at: now,
        updated_at: now,
      };
      const updated = documents.map((d) =>
        d.id === quote.id ? { ...d, status: "accepted" as const, updated_at: now } : d
      );
      await onSaveDocuments([newInvoice, ...updated]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert quote to invoice.");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quotes & Invoices</h1>
          <p className="page-subtitle">
            Precision-calculated quotes and invoices with deterministic tax math and 1-click conversion.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card no-print">
        <h2 className="card-title">Draft with AI or Build Manually</h2>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Describe in plain language (e.g., Invoice Alex (alex@co.com) for 2 logo concepts)"
          />
          <button type="button" className="btn btn-secondary" onClick={handleAiDraft} disabled={parsingAi}>
            <Sparkles size={14} />
            {parsingAi ? "Parsing..." : "Fill with AI"}
          </button>
        </div>

        <form onSubmit={handleCreate}>
          <div className="grid-3" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Document Type</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                <option value="quote">Quote</option>
                <option value="invoice">Invoice</option>
              </select>
            </div>
            <div className="field">
              <label>Customer Name *</label>
              <input
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer or company"
              />
            </div>
            <div className="field">
              <label>Customer Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@domain.com"
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            {items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.5fr 0.8fr 1fr auto",
                  gap: 10,
                  alignItems: "end",
                }}
              >
                <div className="field">
                  <label>Description *</label>
                  <input
                    required
                    value={item.description}
                    onChange={(e) =>
                      setItems(items.map((it, i) => (i === idx ? { ...it, description: e.target.value } : it)))
                    }
                    placeholder="Service or product"
                  />
                </div>
                <div className="field">
                  <label>Qty *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={item.quantity}
                    onChange={(e) =>
                      setItems(items.map((it, i) => (i === idx ? { ...it, quantity: Number(e.target.value) } : it)))
                    }
                  />
                </div>
                <div className="field">
                  <label>Unit Price ({profile.currency}) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={item.unit_price}
                    onChange={(e) =>
                      setItems(items.map((it, i) => (i === idx ? { ...it, unit_price: Number(e.target.value) } : it)))
                    }
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={items.length === 1}
                  aria-label="Remove line item"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="grid-3" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Discount ({profile.currency})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Due / Valid Until Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional terms" />
            </div>
          </div>

          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0 }])}
            >
              <Plus size={14} />
              Add Line Item
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <FileCheck2 size={15} />
              {submitting ? "Calculating..." : `Create ${docType === "quote" ? "Quote" : "Invoice"}`}
            </button>
          </div>
        </form>
      </div>

      <div className="card no-print">
        <h2 className="card-title">Issued Documents ({documents.length})</h2>
        {documents.length === 0 ? (
          <div className="empty-state">
            <h3>No Quotes or Invoices Yet</h3>
            <p>Create your first quote or invoice above. All totals are verified by the BizPilot Executa.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <strong>{doc.doc_number}</strong>
                    </td>
                    <td>
                      <div>{doc.customer_name}</div>
                      {doc.customer_email && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{doc.customer_email}</div>
                      )}
                    </td>
                    <td>
                      <span className={`pill ${statusPillClass(doc.status)}`}>{doc.status}</span>
                    </td>
                    <td>{formatMoney(doc.total, doc.currency)}</td>
                    <td>{formatShortDate(doc.created_at)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setPreviewDoc(doc)}
                        >
                          <Printer size={13} />
                          View / PDF
                        </button>
                        {doc.status === "draft" && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleTransition(doc, "sent")}
                          >
                            Mark Sent
                          </button>
                        )}
                        {doc.doc_type === "quote" && doc.status !== "accepted" && doc.status !== "declined" && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleConvertQuote(doc)}
                          >
                            <ArrowRightLeft size={13} />
                            To Invoice
                          </button>
                        )}
                        {doc.doc_type === "invoice" && (doc.status === "sent" || doc.status === "overdue" || doc.status === "draft") && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleTransition(doc, "paid")}
                          >
                            Mark Paid
                          </button>
                        )}
                        {doc.doc_type === "invoice" && doc.status === "paid" && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onCreateOrderFromInvoice(doc)}
                          >
                            Create Order
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewDoc && (
        <div className="modal-backdrop" onClick={() => setPreviewDoc(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="row-actions no-print" style={{ justifyContent: "space-between", marginBottom: 20 }}>
              <span className={`pill ${statusPillClass(previewDoc.status)}`}>{previewDoc.status}</span>
              <div className="row-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
                  <Printer size={14} />
                  Print / Save PDF
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreviewDoc(null)}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0 }}>{profile.business_name}</h2>
                {profile.address && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{profile.address}</div>}
                {profile.contact_email && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{profile.contact_email}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase" }}>
                  {previewDoc.doc_type}
                </div>
                <div style={{ fontWeight: 600 }}>{previewDoc.doc_number}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Issued: {formatShortDate(previewDoc.created_at)}
                </div>
                {previewDoc.due_date && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Due: {previewDoc.due_date}</div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>
                Bill To
              </div>
              <div style={{ fontWeight: 600 }}>{previewDoc.customer_name}</div>
              {previewDoc.customer_email && <div style={{ fontSize: 13 }}>{previewDoc.customer_email}</div>}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {previewDoc.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.description}</td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.unit_price, previewDoc.currency)}</td>
                    <td>{formatMoney(item.line_total ?? item.quantity * item.unit_price, previewDoc.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Subtotal</span>
                  <span>{formatMoney(previewDoc.subtotal, previewDoc.currency)}</span>
                </div>
                {previewDoc.discount_amount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Discount</span>
                    <span>-{formatMoney(previewDoc.discount_amount, previewDoc.currency)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Tax ({previewDoc.tax_rate}%)</span>
                  <span>{formatMoney(previewDoc.tax_amount, previewDoc.currency)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    fontSize: 16,
                    paddingTop: 8,
                    borderTop: "1px solid var(--border-strong)",
                  }}
                >
                  <span>Total</span>
                  <span>{formatMoney(previewDoc.total, previewDoc.currency)}</span>
                </div>
              </div>
            </div>

            {(previewDoc.notes || profile.payment_instructions) && (
              <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid var(--border-hairline)", fontSize: 12 }}>
                {previewDoc.notes && <div><strong>Notes:</strong> {previewDoc.notes}</div>}
                {profile.payment_instructions && (
                  <div style={{ marginTop: 6 }}>
                    <strong>Payment Instructions:</strong> {profile.payment_instructions}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
