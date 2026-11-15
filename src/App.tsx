import { useCallback, useEffect, useState } from "react";
import { BellRing, FileText, MessageSquare, Package, Settings } from "lucide-react";
import type { BizPilotState, BusinessProfile, DocumentRecord, LineItem, NavTab, OrderRecord } from "./types";
import {
  connectToAnna,
  loadWorkspaceState,
  saveWorkspaceState,
  type AnnaRuntimeInstance,
} from "./lib/annaClient";
import { generateId, nextOrderNumber } from "./lib/format";
import { RuntimeGate } from "./components/RuntimeGate";
import { FrontDeskView } from "./components/FrontDeskView";
import { DocumentsView } from "./components/DocumentsView";
import { OrdersView } from "./components/OrdersView";
import { FollowUpsView } from "./components/FollowUpsView";
import { BusinessBrainView } from "./components/BusinessBrainView";

export function App() {
  const [anna, setAnna] = useState<AnnaRuntimeInstance | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>("front-desk");
  const [state, setState] = useState<BizPilotState>({
    profile: null,
    documents: [],
    orders: [],
  });
  const [quotePrefill, setQuotePrefill] = useState<{
    customerName: string;
    items: LineItem[];
    notes: string;
  } | null>(null);

  const init = useCallback(async () => {
    setLoading(true);
    setConnectError(null);
    try {
      const runtime = await connectToAnna();
      const loaded = await loadWorkspaceState(runtime);
      setAnna(runtime);
      setState(loaded);
      if (!loaded.profile) {
        setActiveTab("settings");
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to connect to Anna AI OS.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  const persistState = async (next: BizPilotState) => {
    if (!anna) throw new Error("Anna AI OS runtime is not connected.");
    await saveWorkspaceState(anna, next);
    setState(next);
  };

  const handleSaveProfile = async (profile: BusinessProfile) => {
    await persistState({ ...state, profile });
  };

  const handleSaveDocuments = async (documents: DocumentRecord[]) => {
    await persistState({ ...state, documents });
  };

  const handleSaveOrders = async (orders: OrderRecord[]) => {
    await persistState({ ...state, orders });
  };

  const handleCreateOrderFromInvoice = async (doc: DocumentRecord) => {
    const now = new Date().toISOString();
    const summary = doc.items.map((i) => `${i.quantity}x ${i.description}`).join(", ");
    const order: OrderRecord = {
      id: generateId("ord"),
      order_number: nextOrderNumber(state.orders.length),
      customer_name: doc.customer_name,
      customer_email: doc.customer_email,
      summary,
      total: doc.total,
      currency: doc.currency,
      status: "pending",
      notes: `From invoice ${doc.doc_number}`,
      source_invoice_number: doc.doc_number,
      created_at: now,
      updated_at: now,
    };
    await handleSaveOrders([order, ...state.orders]);
    setActiveTab("orders");
  };

  if (loading) {
    return (
      <div className="gate-screen">
        <div className="card gate-card">
          <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>Connecting to Anna AI OS...</h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>
            Loading your encrypted BizPilot AI workspace.
          </p>
        </div>
      </div>
    );
  }

  if (connectError || !anna) {
    return <RuntimeGate message={connectError ?? "Host connection unavailable."} onRetry={init} />;
  }

  const pendingFollowupCount = state.documents.filter(
    (d) => (d.doc_type === "quote" && d.status === "sent") || (d.doc_type === "invoice" && (d.status === "sent" || d.status === "overdue"))
  ).length;

  const navItems: Array<{ id: NavTab; label: string; icon: typeof MessageSquare; badge?: number }> = [
    { id: "front-desk", label: "Front Desk", icon: MessageSquare },
    { id: "documents", label: "Quotes & Invoices", icon: FileText, badge: state.documents.length || undefined },
    { id: "orders", label: "Orders", icon: Package, badge: state.orders.length || undefined },
    { id: "follow-ups", label: "Follow-Ups", icon: BellRing, badge: pendingFollowupCount || undefined },
    { id: "settings", label: "Business Brain", icon: Settings },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-title">BizPilot AI</div>
            <div className="brand-sub">
              {state.profile ? state.profile.business_name : "Setup Required"}
            </div>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${activeTab === item.id ? "active" : ""}`}
                onClick={() => setActiveTab(item.id)}
              >
                <span className="nav-item-left">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && <span className="nav-badge">{item.badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Anna AI OS Native</div>
          <div style={{ color: "var(--text-muted)" }}>
            Executa tools active for both UI &amp; AI agents.
          </div>
        </div>
      </aside>

      <main className="main-area">
        {activeTab === "front-desk" && (
          <FrontDeskView
            anna={anna}
            profile={state.profile}
            orders={state.orders}
            onGoToSettings={() => setActiveTab("settings")}
            onCreateQuoteFromInquiry={(customerName, items, notes) => {
              setQuotePrefill({ customerName, items, notes });
              setActiveTab("documents");
            }}
          />
        )}
        {activeTab === "documents" && (
          <DocumentsView
            anna={anna}
            profile={state.profile}
            documents={state.documents}
            prefill={quotePrefill}
            onClearPrefill={() => setQuotePrefill(null)}
            onSaveDocuments={handleSaveDocuments}
            onCreateOrderFromInvoice={handleCreateOrderFromInvoice}
            onGoToSettings={() => setActiveTab("settings")}
          />
        )}
        {activeTab === "orders" && (
          <OrdersView
            anna={anna}
            profile={state.profile}
            orders={state.orders}
            onSaveOrders={handleSaveOrders}
            onGoToSettings={() => setActiveTab("settings")}
          />
        )}
        {activeTab === "follow-ups" && (
          <FollowUpsView
            anna={anna}
            profile={state.profile}
            documents={state.documents}
            onGoToSettings={() => setActiveTab("settings")}
          />
        )}
        {activeTab === "settings" && (
          <BusinessBrainView
            anna={anna}
            profile={state.profile}
            onSave={handleSaveProfile}
          />
        )}
      </main>
    </div>
  );
}
