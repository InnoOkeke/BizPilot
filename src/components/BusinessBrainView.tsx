import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import type { BusinessProfile, CatalogItem, FaqItem } from "../types";
import type { AnnaRuntimeInstance } from "../lib/annaClient";
import { invokeExecuta } from "../lib/annaClient";
import { generateId } from "../lib/format";

interface BusinessBrainViewProps {
  anna: AnnaRuntimeInstance;
  profile: BusinessProfile | null;
  onSave: (profile: BusinessProfile) => Promise<void>;
}

const EMPTY_PROFILE: BusinessProfile = {
  business_name: "",
  currency: "USD",
  tax_rate: 0,
  contact_email: "",
  contact_phone: "",
  address: "",
  payment_instructions: "",
  catalog: [],
  faqs: [],
};

export function BusinessBrainView({ anna, profile, onSave }: BusinessBrainViewProps) {
  const [draft, setDraft] = useState<BusinessProfile>(profile ?? EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const addCatalogItem = () => {
    const next: CatalogItem = {
      id: generateId("cat"),
      name: "",
      unit_price: 0,
      unit: "unit",
      description: "",
    };
    setDraft((prev) => ({ ...prev, catalog: [...prev.catalog, next] }));
  };

  const updateCatalogItem = (id: string, patch: Partial<CatalogItem>) => {
    setDraft((prev) => ({
      ...prev,
      catalog: prev.catalog.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const removeCatalogItem = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      catalog: prev.catalog.filter((item) => item.id !== id),
    }));
  };

  const addFaq = () => {
    const next: FaqItem = {
      id: generateId("faq"),
      question: "",
      answer: "",
    };
    setDraft((prev) => ({ ...prev, faqs: [...prev.faqs, next] }));
  };

  const updateFaq = (id: string, patch: Partial<FaqItem>) => {
    setDraft((prev) => ({
      ...prev,
      faqs: prev.faqs.map((faq) => (faq.id === id ? { ...faq, ...patch } : faq)),
    }));
  };

  const removeFaq = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      faqs: prev.faqs.filter((faq) => faq.id !== id),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(false);
    setSaving(true);
    try {
      const validated = await invokeExecuta<BusinessProfile>(anna, "validate_business_profile", {
        ...draft,
        tax_rate: Number(draft.tax_rate),
        catalog: draft.catalog.map((c) => ({ ...c, unit_price: Number(c.unit_price) })),
      });
      await onSave(validated);
      setDraft(validated);
      setSavedNotice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save business profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Brain</h1>
          <p className="page-subtitle">
            Verified company details, pricing catalog, and FAQs used to ground every AI reply and invoice.
          </p>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Save size={15} />
          {saving ? "Validating & Saving..." : "Save Profile"}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}
      {savedNotice && (
        <div className="alert" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
          <span>Business profile validated and saved to Anna AI OS storage.</span>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">Company & Billing Defaults</h2>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="biz-name">Business Name *</label>
            <input
              id="biz-name"
              required
              value={draft.business_name}
              onChange={(e) => setDraft({ ...draft, business_name: e.target.value })}
              placeholder="e.g., Northstar Design Studio"
            />
          </div>
          <div className="field">
            <label htmlFor="biz-currency">Currency (ISO 4217) *</label>
            <input
              id="biz-currency"
              required
              maxLength={3}
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
              placeholder="USD"
            />
          </div>
          <div className="field">
            <label htmlFor="biz-tax">Default Tax Rate (%)</label>
            <input
              id="biz-tax"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={draft.tax_rate}
              onChange={(e) => setDraft({ ...draft, tax_rate: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: 14 }}>
          <div className="field">
            <label htmlFor="biz-email">Contact Email</label>
            <input
              id="biz-email"
              type="email"
              value={draft.contact_email}
              onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })}
              placeholder="billing@company.com"
            />
          </div>
          <div className="field">
            <label htmlFor="biz-phone">Contact Phone</label>
            <input
              id="biz-phone"
              value={draft.contact_phone}
              onChange={(e) => setDraft({ ...draft, contact_phone: e.target.value })}
              placeholder="+1 555 0100"
            />
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: 14 }}>
          <div className="field">
            <label htmlFor="biz-address">Business Address</label>
            <textarea
              id="biz-address"
              rows={2}
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="biz-payment">Payment Instructions (Shown on Invoices)</label>
            <textarea
              id="biz-payment"
              rows={2}
              value={draft.payment_instructions}
              onChange={(e) => setDraft({ ...draft, payment_instructions: e.target.value })}
              placeholder="Bank transfer / payment link instructions"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 className="card-title" style={{ margin: 0 }}>Products & Services Catalog</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addCatalogItem}>
            <Plus size={14} />
            Add Item
          </button>
        </div>
        {draft.catalog.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
            No catalog items yet. Add items so BizPilot AI quotes accurate prices.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {draft.catalog.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 2fr auto",
                  gap: 10,
                  alignItems: "end",
                }}
              >
                <div className="field">
                  <label>Item Name *</label>
                  <input
                    required
                    value={item.name}
                    onChange={(e) => updateCatalogItem(item.id, { name: e.target.value })}
                    placeholder="Service or product"
                  />
                </div>
                <div className="field">
                  <label>Unit Price *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={item.unit_price}
                    onChange={(e) => updateCatalogItem(item.id, { unit_price: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>Unit</label>
                  <input
                    value={item.unit}
                    onChange={(e) => updateCatalogItem(item.id, { unit: e.target.value })}
                    placeholder="hour / unit"
                  />
                </div>
                <div className="field">
                  <label>Description</label>
                  <input
                    value={item.description}
                    onChange={(e) => updateCatalogItem(item.id, { description: e.target.value })}
                    placeholder="Optional details"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  aria-label="Remove catalog item"
                  onClick={() => removeCatalogItem(item.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 className="card-title" style={{ margin: 0 }}>Customer FAQs & Policies</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addFaq}>
            <Plus size={14} />
            Add FAQ
          </button>
        </div>
        {draft.faqs.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
            No FAQs added yet. Add delivery, turnaround, or refund policies to ground customer Q&A.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {draft.faqs.map((faq) => (
              <div
                key={faq.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.5fr auto",
                  gap: 10,
                  alignItems: "start",
                }}
              >
                <div className="field">
                  <label>Question *</label>
                  <input
                    required
                    value={faq.question}
                    onChange={(e) => updateFaq(faq.id, { question: e.target.value })}
                    placeholder="e.g., What is your turnaround time?"
                  />
                </div>
                <div className="field">
                  <label>Verified Answer *</label>
                  <textarea
                    required
                    rows={2}
                    value={faq.answer}
                    onChange={(e) => updateFaq(faq.id, { answer: e.target.value })}
                    placeholder="Exact policy or answer"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ marginTop: 22 }}
                  aria-label="Remove FAQ"
                  onClick={() => removeFaq(faq.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
