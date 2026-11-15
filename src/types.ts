export type NavTab = "front-desk" | "documents" | "orders" | "follow-ups" | "settings";

export interface CatalogItem {
  id: string;
  name: string;
  unit_price: number;
  unit: string;
  description: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface BusinessProfile {
  business_name: string;
  currency: string;
  tax_rate: number;
  contact_email: string;
  contact_phone: string;
  address: string;
  payment_instructions: string;
  catalog: CatalogItem[];
  faqs: FaqItem[];
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
}

export type DocumentType = "quote" | "invoice";
export type QuoteStatus = "draft" | "sent" | "accepted" | "declined";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export interface DocumentRecord {
  id: string;
  doc_number: string;
  doc_type: DocumentType;
  status: QuoteStatus | InvoiceStatus;
  customer_name: string;
  customer_email: string;
  currency: string;
  tax_rate: number;
  discount_amount: number;
  items: LineItem[];
  subtotal: number;
  tax_amount: number;
  total: number;
  due_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = "pending" | "in_progress" | "ready" | "completed" | "cancelled";

export interface OrderRecord {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  summary: string;
  total: number;
  currency: string;
  status: OrderStatus;
  notes: string;
  source_invoice_number?: string;
  created_at: string;
  updated_at: string;
}

export interface FollowupCandidate {
  id: string;
  doc_number: string;
  doc_type: DocumentType;
  status: string;
  customer_name: string;
  customer_email: string;
  total: number;
  currency: string;
  age_days: number;
  priority: "high" | "normal";
}

export interface CustomerInquiryResult {
  reply: string;
  intent: "question" | "quote_request" | "order_status" | "follow_up";
  suggested_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
}

export interface BizPilotState {
  profile: BusinessProfile | null;
  documents: DocumentRecord[];
  orders: OrderRecord[];
}
