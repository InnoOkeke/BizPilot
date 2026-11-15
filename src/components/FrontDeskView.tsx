import { useState } from "react";
import { Copy, FileText, Send, Sparkles } from "lucide-react";
import type { BusinessProfile, CustomerInquiryResult, LineItem, OrderRecord } from "../types";
import type { AnnaRuntimeInstance } from "../lib/annaClient";
import { completeWithAnnaJson, invokeExecuta } from "../lib/annaClient";

interface FrontDeskViewProps {
  anna: AnnaRuntimeInstance;
  profile: BusinessProfile | null;
  orders: OrderRecord[];
  onGoToSettings: () => void;
  onCreateQuoteFromInquiry: (customerName: string, items: LineItem[], notes: string) => void;
}

export function FrontDeskView({
  anna,
  profile,
  orders,
  onGoToSettings,
  onCreateQuoteFromInquiry,
}: FrontDeskViewProps) {
  const [customerName, setCustomerName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomerInquiryResult | null>(null);
  const [copied, setCopied] = useState(false);

  if (!profile) {
    return (
      <div className="card empty-state">
        <h3>Configure Your Business Brain First</h3>
        <p>
          BizPilot AI never guesses prices or policies. Add your business name, catalog, and FAQs
          to start answering customer questions.
        </p>
        <button type="button" className="btn btn-primary" onClick={onGoToSettings}>
          Set Up Business Brain
        </button>
      </div>
    );
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setError(null);
    setResult(null);
    setCopied(false);
    setLoading(true);
    try {
      const matchingOrders = orders.filter(
        (o) =>
          (customerName.trim() &&
            o.customer_name.toLowerCase().includes(customerName.trim().toLowerCase())) ||
          message.toLowerCase().includes(o.order_number.toLowerCase())
      );

      const promptPayload = await invokeExecuta<{ system_prompt: string; user_message: string }>(
        anna,
        "build_customer_reply_prompt",
        {
          business_name: profile.business_name,
          currency: profile.currency,
          customer_name: customerName.trim(),
          customer_message: message.trim(),
          catalog: profile.catalog,
          faqs: profile.faqs,
          matching_orders: matchingOrders,
        }
      );

      const aiResult = await completeWithAnnaJson<CustomerInquiryResult>(
        anna,
        promptPayload.system_prompt,
        promptPayload.user_message
      );
      setResult(aiResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate customer reply.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.reply) return;
    await navigator.clipboard.writeText(result.reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Front Desk</h1>
          <p className="page-subtitle">
            Answer customer questions grounded in {profile.business_name}&apos;s verified catalog, FAQs, and orders.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleAnalyze}>
          <div className="grid-2" style={{ marginBottom: 14 }}>
            <div className="field">
              <label htmlFor="fd-customer">Customer Name (optional)</label>
              <input
                id="fd-customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g., Sarah Chen"
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="fd-msg">Customer Message *</label>
            <textarea
              id="fd-msg"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Paste the customer's question, quote request, or order inquiry..."
            />
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Sparkles size={15} />
              {loading ? "Drafting Grounded Reply..." : "Draft Reply"}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="row-actions">
              <h2 className="card-title" style={{ margin: 0 }}>Suggested Reply</h2>
              <span className="pill pill-info">{result.intent.replace("_", " ")}</span>
            </div>
            <div className="row-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
                <Copy size={13} />
                {copied ? "Copied" : "Copy Reply"}
              </button>
              {(result.intent === "quote_request" || (result.suggested_items && result.suggested_items.length > 0)) && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    onCreateQuoteFromInquiry(
                      customerName.trim(),
                      result.suggested_items ?? [],
                      `From customer inquiry: ${message.trim().slice(0, 140)}`
                    )
                  }
                >
                  <FileText size={13} />
                  Create Quote
                </button>
              )}
            </div>
          </div>
          <div
            style={{
              whiteSpace: "pre-wrap",
              padding: 14,
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-hairline)",
            }}
          >
            {result.reply}
          </div>
          {result.suggested_items && result.suggested_items.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                Detected Quote Items
              </div>
              <div className="row-actions">
                {result.suggested_items.map((item, idx) => (
                  <span key={idx} className="pill pill-neutral">
                    <Send size={11} style={{ marginRight: 5 }} />
                    {item.quantity}x {item.description} ({profile.currency} {item.unit_price})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
