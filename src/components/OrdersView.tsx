import { useState } from "react";
import { Copy, PackagePlus, Sparkles } from "lucide-react";
import type { BusinessProfile, OrderRecord, OrderStatus } from "../types";
import type { AnnaRuntimeInstance } from "../lib/annaClient";
import { completeWithAnnaText, invokeExecuta } from "../lib/annaClient";
import { formatMoney, formatShortDate, generateId, nextOrderNumber } from "../lib/format";

interface OrdersViewProps {
  anna: AnnaRuntimeInstance;
  profile: BusinessProfile | null;
  orders: OrderRecord[];
  onSaveOrders: (orders: OrderRecord[]) => Promise<void>;
  onGoToSettings: () => void;
}

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: "in_progress",
  in_progress: "ready",
  ready: "completed",
  completed: null,
  cancelled: null,
};

function orderPillClass(status: OrderStatus): string {
  switch (status) {
    case "completed":
      return "pill-success";
    case "ready":
      return "pill-info";
    case "in_progress":
      return "pill-warning";
    case "cancelled":
      return "pill-danger";
    default:
      return "pill-neutral";
  }
}

export function OrdersView({
  anna,
  profile,
  orders,
  onSaveOrders,
  onGoToSettings,
}: OrdersViewProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [summary, setSummary] = useState("");
  const [total, setTotal] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [draftedUpdate, setDraftedUpdate] = useState<{ orderNumber: string; text: string } | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);

  if (!profile) {
    return (
      <div className="card empty-state">
        <h3>Configure Your Business Brain First</h3>
        <p>Set up your business profile before tracking customer orders.</p>
        <button type="button" className="btn btn-primary" onClick={onGoToSettings}>
          Set Up Business Brain
        </button>
      </div>
    );
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const now = new Date().toISOString();
    const newOrder: OrderRecord = {
      id: generateId("ord"),
      order_number: nextOrderNumber(orders.length),
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      summary: summary.trim(),
      total: Number(total) || 0,
      currency: profile.currency,
      status: "pending",
      notes: notes.trim(),
      created_at: now,
      updated_at: now,
    };
    await onSaveOrders([newOrder, ...orders]);
    setCustomerName("");
    setCustomerEmail("");
    setSummary("");
    setTotal(0);
    setNotes("");
  };

  const handleAdvance = async (order: OrderRecord, target: OrderStatus) => {
    setError(null);
    try {
      const res = await invokeExecuta<{ status: OrderStatus }>(anna, "transition_order_status", {
        current_status: order.status,
        target_status: target,
      });
      const now = new Date().toISOString();
      await onSaveOrders(
        orders.map((o) => (o.id === order.id ? { ...o, status: res.status, updated_at: now } : o))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order status transition failed.");
    }
  };

  const handleDraftUpdate = async (order: OrderRecord) => {
    setError(null);
    setDraftingId(order.id);
    try {
      const systemPrompt =
        `You are drafting a concise, polite customer order status update for ${profile.business_name}. ` +
        `Use ONLY the provided order details.`;
      const userPrompt =
        `Order: ${order.order_number}\nCustomer: ${order.customer_name}\nStatus: ${order.status}\n` +
        `Summary: ${order.summary}\nNotes: ${order.notes || "None"}`;
      const text = await completeWithAnnaText(anna, systemPrompt, userPrompt);
      setDraftedUpdate({ orderNumber: order.order_number, text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draft status message.");
    } finally {
      setDraftingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Track fulfillment stages and generate verified customer updates.</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">New Order</h2>
        <form onSubmit={handleCreateOrder}>
          <div className="grid-3" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Customer Name *</label>
              <input
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
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
            <div className="field">
              <label>Order Total ({profile.currency})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Order Summary *</label>
              <input
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g., 20 custom tote bags"
              />
            </div>
            <div className="field">
              <label>Fulfillment Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Delivery address or pickup time"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            <PackagePlus size={15} />
            Create Order
          </button>
        </form>
      </div>

      {draftedUpdate && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 className="card-title" style={{ margin: 0 }}>
              Drafted Customer Update ({draftedUpdate.orderNumber})
            </h2>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigator.clipboard.writeText(draftedUpdate.text)}
            >
              <Copy size={13} />
              Copy
            </button>
          </div>
          <div
            style={{
              whiteSpace: "pre-wrap",
              padding: 12,
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-subtle)",
            }}
          >
            {draftedUpdate.text}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">Order Pipeline ({orders.length})</h2>
        {orders.length === 0 ? (
          <div className="empty-state">
            <h3>No Active Orders</h3>
            <p>Create an order above or convert a paid invoice from Quotes & Invoices.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const next = NEXT_STATUS[order.status];
                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.order_number}</strong>
                      </td>
                      <td>{order.customer_name}</td>
                      <td>{order.summary}</td>
                      <td>
                        <span className={`pill ${orderPillClass(order.status)}`}>
                          {order.status.replace("_", " ")}
                        </span>
                      </td>
                      <td>{formatMoney(order.total, order.currency)}</td>
                      <td>{formatShortDate(order.updated_at)}</td>
                      <td>
                        <div className="row-actions">
                          {next && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleAdvance(order, next)}
                            >
                              Move to {next.replace("_", " ")}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={draftingId === order.id}
                            onClick={() => handleDraftUpdate(order)}
                          >
                            <Sparkles size={13} />
                            {draftingId === order.id ? "Drafting..." : "Draft Update"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
