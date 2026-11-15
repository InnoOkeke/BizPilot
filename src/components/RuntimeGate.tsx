import { AlertCircle, RefreshCw } from "lucide-react";

interface RuntimeGateProps {
  message: string;
  onRetry: () => void;
}

export function RuntimeGate({ message, onRetry }: RuntimeGateProps) {
  return (
    <div className="gate-screen">
      <div className="card gate-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--danger)" }}>
          <AlertCircle size={36} />
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Anna AI OS Runtime Required</h2>
        <p style={{ margin: "0 0 16px", color: "var(--text-secondary)", fontSize: 13 }}>
          BizPilot AI relies on Anna AI OS for authenticated storage, Executa tool execution, and
          LLM inference. It cannot run outside the Anna host environment.
        </p>
        <div className="alert alert-error" style={{ textAlign: "left", marginBottom: 16 }}>
          <span>{message}</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          <RefreshCw size={15} />
          Retry Connection
        </button>
      </div>
    </div>
  );
}
