import { useEffect, useState } from "react";
import { Copy, RefreshCw, Sparkles } from "lucide-react";
import type { BusinessProfile, DocumentRecord, FollowupCandidate } from "../types";
import type { AnnaRuntimeInstance } from "../lib/annaClient";
import { completeWithAnnaText, invokeExecuta } from "../lib/annaClient";
import { formatMoney } from "../lib/format";

interface FollowUpsViewProps {
  anna: AnnaRuntimeInstance;
  profile: BusinessProfile | null;
  documents: DocumentRecord[];
  onGoToSettings: () => void;
}

export function FollowUpsView({ anna, profile, documents, onGoToSettings }: FollowUpsViewProps) {
  const [minAgeDays, setMinAgeDays] = useState(0);
  const [candidates, setCandidates] = useState<FollowupCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scanFollowups = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await invokeExecuta<{ followups: FollowupCandidate[] }>(
        anna,
        "identify_pending_followups",
        {
          documents,
          min_age_days: minAgeDays,
        }
      );
      setCandidates(res.followups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan pending follow-ups.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void scanFollowups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, minAgeDays]);

  if (!profile) {
    return (
      <div className="card empty-state">
        <h3>Configure Your Business Brain First</h3>
        <p>Set up your business profile so follow-up messages reflect your company identity.</p>
        <button type="button" className="btn btn-primary" onClick={onGoToSettings}>
          Set Up Business Brain
        </button>
      </div>
    );
  }

  const handleDraftFollowup = async (item: FollowupCandidate) => {
    setError(null);
    setDraftingId(item.id);
    try {
      const systemPrompt =
        `You are drafting a warm, professional follow-up message for ${profile.business_name}. ` +
        `Keep it concise, polite, and include only the exact document number and amount provided.`;
      const userPrompt =
        `Document: ${item.doc_type.toUpperCase()} ${item.doc_number}\n` +
        `Status: ${item.status}\nCustomer: ${item.customer_name}\n` +
        `Amount: ${item.currency} ${item.total}\nDays since update: ${item.age_days}`;
      const text = await completeWithAnnaText(anna, systemPrompt, userPrompt);
      setDrafts((prev) => ({ ...prev, [item.id]: text }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draft follow-up message.");
    } finally {
      setDraftingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Follow-Ups</h1>
          <p className="page-subtitle">
            Sent quotes and unpaid invoices surfaced for human-in-the-loop follow-up.
          </p>
        </div>
        <div className="row-actions">
          <select
            aria-label="Minimum age in days"
            style={{ width: 170 }}
            value={minAgeDays}
            onChange={(e) => setMinAgeDays(Number(e.target.value))}
          >
            <option value={0}>All pending (0+ days)</option>
            <option value={2}>2+ days old</option>
            <option value={7}>7+ days old</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={scanFollowups} disabled={loading}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        {candidates.length === 0 ? (
          <div className="empty-state">
            <h3>No Pending Follow-Ups</h3>
            <p>
              Quotes or invoices marked <strong>Sent</strong> or <strong>Overdue</strong> will appear here
              automatically.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {candidates.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 16,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-hairline)",
                  background: "var(--bg-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div className="row-actions">
                      <strong>{item.doc_number}</strong>
                      <span className={`pill ${item.priority === "high" ? "pill-danger" : "pill-warning"}`}>
                        {item.priority} priority
                      </span>
                      <span className="pill pill-neutral">{item.age_days}d old</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                      {item.customer_name} • {formatMoney(item.total, item.currency)} ({item.status})
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={draftingId === item.id}
                    onClick={() => handleDraftFollowup(item)}
                  >
                    <Sparkles size={13} />
                    {draftingId === item.id ? "Drafting..." : "Draft Follow-Up"}
                  </button>
                </div>

                {drafts[item.id] && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-hairline)",
                    }}
                  >
                    <div style={{ whiteSpace: "pre-wrap", marginBottom: 10 }}>{drafts[item.id]}</div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigator.clipboard.writeText(drafts[item.id])}
                    >
                      <Copy size={13} />
                      Approve & Copy
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
