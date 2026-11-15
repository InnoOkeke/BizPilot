export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function generateId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

export function nextDocumentNumber(docType: "quote" | "invoice", existingCount: number): string {
  const prefix = docType === "quote" ? "QUO" : "INV";
  return `${prefix}-${String(existingCount + 1).padStart(4, "0")}`;
}

export function nextOrderNumber(existingCount: number): string {
  return `ORD-${String(existingCount + 1).padStart(4, "0")}`;
}
