"use client";

import { useState } from "react";
import { CreditCard, CheckCircle2, XCircle, RotateCcw, Loader2, ChevronDown, Plus } from "lucide-react";
import {
  listPayments,
  getPaymentAnalytics,
  createPayment,
  refundPayment,
  retryPayment,
  checkPaymentStatus,
  listPaymentWebhookEvents,
  type CreatePaymentInput,
} from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { FilterSelect } from "@/components/admin/FilterControls";
import { FormField } from "@/components/admin/FormField";
import { Badge, paymentStatusTone, paymentWebhookOutcomeTone } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton, StatCardsSkeleton, Skeleton } from "@/components/admin/Skeleton";
import { StatCard } from "@/components/admin/StatCard";
import type { Payment, PaymentProviderId, PaymentStatus, PaymentWebhookOutcome } from "@/lib/services/payments";

const PAGE_SIZE = 20;
const PAYMENT_STATUSES: PaymentStatus[] = ["created", "pending", "succeeded", "failed", "refunded", "partially_refunded"];
const PAYMENT_PROVIDERS: PaymentProviderId[] = ["razorpay", "stripe", "cashfree", "phonepe", "paypal"];
const WEBHOOK_OUTCOMES: PaymentWebhookOutcome[] = ["processed", "processing", "duplicate", "signature_invalid", "unrecognized", "error"];

function formatAmount(amountInSmallestUnit: number, currency: string): string {
  return `${(amountInSmallestUnit / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/** "Payment Analytics" — the summary cards atop the page, reusing the
 *  same StatCard/DonutStat-adjacent components every other admin
 *  overview already uses (Dashboard, Analytics), not a bespoke chart. */
function PaymentAnalyticsCards() {
  const { data, loading, error, reload } = useAdminData(() => getPaymentAnalytics(), []);

  if (loading) return <StatCardsSkeleton count={4} />;
  if (error || !data) return <ErrorState message={error ?? "Could not load payment analytics."} onRetry={reload} />;

  const succeededTotal = Object.entries(data.succeededByCurrency)
    .map(([currency, amount]) => `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`)
    .join(" · ");
  const refundedTotal = Object.entries(data.refundedByCurrency)
    .map(([currency, amount]) => `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`)
    .join(" · ");

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total Transactions" value={data.totalTransactions} icon={CreditCard} tone="accent" />
      <StatCard label="Succeeded" value={succeededTotal || "—"} sublabel={`${data.byStatus.succeeded} payment${data.byStatus.succeeded === 1 ? "" : "s"}`} icon={CheckCircle2} tone="success" />
      <StatCard label="Failed" value={data.byStatus.failed} icon={XCircle} tone="danger" />
      <StatCard label="Refunded" value={refundedTotal || "—"} sublabel={`${data.byStatus.refunded + data.byStatus.partially_refunded} refund${data.byStatus.refunded + data.byStatus.partially_refunded === 1 ? "" : "s"}`} icon={RotateCcw} tone="warning" />
    </div>
  );
}

/** "Payment Intent" / "Checkout Session" — admin-initiated: a real
 *  hosted checkout link is generated against the selected connected
 *  provider, for the admin to share with the customer. Reuses
 *  FormField/adm-btn exactly like TagsPanel's own inline create form
 *  (Settings page), not a new form component pattern. */
function CreatePaymentForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<PaymentProviderId>("razorpay");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [purpose, setPurpose] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [leadId, setLeadId] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPayment, setCreatedPayment] = useState<Payment | null>(null);

  function resetForm() {
    setAmount("");
    setPurpose("");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setLeadId("");
    setRegistrationId("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const amountInSmallestUnit = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountInSmallestUnit) || amountInSmallestUnit <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    if (!purpose.trim()) {
      setError("Purpose is required.");
      return;
    }

    const input: CreatePaymentInput = {
      provider,
      amountInSmallestUnit,
      currency,
      purpose: purpose.trim(),
      returnUrl: `${window.location.origin}/admin/payments`,
      customerName: customerName.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      leadId: leadId.trim() || undefined,
      registrationId: registrationId.trim() || undefined,
    };

    setSubmitting(true);
    const result = await createPayment(input);
    setSubmitting(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not create payment.");
      return;
    }
    setCreatedPayment(result.data.payment);
    resetForm();
    onCreated();
  }

  return (
    <div className="adm-card p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
        <Plus size={12} />
        {open ? "Cancel" : "Create Payment"}
      </button>

      {createdPayment && (
        <div className="mt-3 space-y-1 rounded-[var(--adm-radius-sm)] border p-3" style={{ borderColor: "var(--adm-accent)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--adm-text)" }}>
            Checkout link created — share this with the customer:
          </p>
          {createdPayment.checkoutUrl ? (
            <a href={createdPayment.checkoutUrl} target="_blank" rel="noreferrer" className="block break-all text-xs" style={{ color: "var(--adm-accent)" }}>
              {createdPayment.checkoutUrl}
            </a>
          ) : (
            <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
              Checkout could not be created — see the payment&apos;s own status below for the reason.
            </p>
          )}
        </div>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
                Provider
              </label>
              <FilterSelect label="Provider" value={provider} onChange={(e) => setProvider(e.target.value as PaymentProviderId)} className="w-full">
                {PAYMENT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </FilterSelect>
            </div>
            <FormField id="payment-amount" label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 25000" />
            <FormField id="payment-currency" label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="INR" />
          </div>
          <FormField id="payment-purpose" label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Full Stack DevOps — Program Fee" className="w-full" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FormField id="payment-customer-name" label="Customer name (optional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <FormField id="payment-customer-email" label="Customer email (optional)" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            <FormField id="payment-customer-phone" label="Customer phone (optional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField id="payment-lead-id" label="Lead ID (optional)" value={leadId} onChange={(e) => setLeadId(e.target.value)} />
            <FormField id="payment-registration-id" label="Registration ID (optional)" value={registrationId} onChange={(e) => setRegistrationId(e.target.value)} />
          </div>
          {error && (
            <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
            {submitting && <Loader2 size={12} className="animate-spin" />}
            Create checkout
          </button>
        </form>
      )}
    </div>
  );
}

/** "Webhook Status" — every inbound provider webhook received,
 *  regardless of outcome. Mirrors Module 6.5's own WebhookDeliveriesPanel
 *  shape (Settings page) applied to payment providers specifically. */
function PaymentWebhookEventsPanel() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [outcome, setOutcome] = useState<PaymentWebhookOutcome | "">("");
  const { data, loading, error, reload } = useAdminData(
    () => (open ? listPaymentWebhookEvents(outcome ? { outcome } : {}, page, 10) : Promise.resolve({ success: true as const, data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 } })),
    [open, page, outcome],
  );

  return (
    <div className="adm-card p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="adm-focus-ring flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
        Webhook Status <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <FilterSelect
            label="Outcome"
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value as PaymentWebhookOutcome | "");
              setPage(1);
            }}
            className="w-56"
          >
            <option value="">All outcomes</option>
            {WEBHOOK_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </FilterSelect>

          {loading && <Skeleton className="h-24 w-full" />}
          {!loading && error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && data && data.items.length === 0 && <EmptyState message="No payment webhooks received yet." />}
          {!loading && !error && data && data.items.length > 0 && (
            <div className="space-y-1.5">
              {data.items.map((event) => (
                <div key={event.id} className="flex items-start justify-between gap-3 border-t py-2 first:border-t-0" style={{ borderColor: "var(--adm-border)" }}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={paymentWebhookOutcomeTone(event.outcome)}>{event.outcome}</Badge>
                      <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                        {event.provider} · {event.eventType}
                      </span>
                    </div>
                    {event.detail && (
                      <p className="mt-0.5 truncate text-xs" style={{ color: "var(--adm-text-secondary)" }} title={event.detail}>
                        {event.detail}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs" style={{ color: "var(--adm-text-muted)" }}>
                    {new Date(event.receivedAt).toLocaleString()}
                  </span>
                </div>
              ))}
              {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPaymentsPage() {
  const { user } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [provider, setProvider] = useState<PaymentProviderId | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<{ id: string; text: string; isError: boolean } | null>(null);

  const filters = { status: status || undefined, provider: provider || undefined };
  const { data, loading, error, forbidden, reload } = useAdminData(() => listPayments(filters, page, PAGE_SIZE), [page, status, provider]);

  function onFilterChange<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  async function handleCheckStatus(id: string) {
    setBusyId(id);
    setRowMessage(null);
    const result = await checkPaymentStatus(id);
    setBusyId(null);
    if (!result.success) setRowMessage({ id, text: result.errors[0]?.message ?? "Check failed.", isError: true });
    reload();
  }

  async function handleRefund(payment: Payment) {
    if (!window.confirm(`Refund the full remaining amount for "${payment.purpose}"?`)) return;
    setBusyId(payment.id);
    setRowMessage(null);
    const result = await refundPayment(payment.id);
    setBusyId(null);
    if (!result.success) setRowMessage({ id: payment.id, text: result.errors[0]?.message ?? "Refund failed.", isError: true });
    reload();
  }

  async function handleRetry(payment: Payment) {
    setBusyId(payment.id);
    setRowMessage(null);
    const result = await retryPayment(payment.id, `${window.location.origin}/admin/payments`);
    setBusyId(null);
    if (!result.success) {
      setRowMessage({ id: payment.id, text: result.errors[0]?.message ?? "Retry failed.", isError: true });
    } else if (result.data.payment.checkoutUrl) {
      setRowMessage({ id: payment.id, text: `New checkout created: ${result.data.payment.checkoutUrl}`, isError: false });
    }
    reload();
  }

  const isAdmin = user?.role === "admin";

  const columns: TableColumn<Payment>[] = [
    { key: "purpose", header: "Purpose", render: (p) => <span className="font-medium">{p.purpose}</span> },
    { key: "amount", header: "Amount", render: (p) => formatAmount(p.amountInSmallestUnit, p.currency) },
    { key: "provider", header: "Provider", render: (p) => <span className="capitalize">{p.provider}</span> },
    { key: "status", header: "Status", render: (p) => <Badge tone={paymentStatusTone(p.status)}>{p.status.replace("_", " ")}</Badge> },
    { key: "lead", header: "Lead / Registration", render: (p) => <span className="text-xs">{p.leadId ?? "—"}{p.registrationId ? ` / ${p.registrationId}` : ""}</span> },
    { key: "createdAt", header: "Created", render: (p) => new Date(p.createdAt).toLocaleString() },
    {
      key: "actions",
      header: "Actions",
      render: (p) => (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap gap-1.5">
            {(p.status === "created" || p.status === "pending") && (
              <button type="button" onClick={() => handleCheckStatus(p.id)} disabled={busyId === p.id} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
                {busyId === p.id && <Loader2 size={11} className="animate-spin" />}
                Check status
              </button>
            )}
            {isAdmin && (p.status === "succeeded" || p.status === "partially_refunded") && (
              <button type="button" onClick={() => handleRefund(p)} disabled={busyId === p.id} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
                Refund
              </button>
            )}
            {isAdmin && p.status === "failed" && (
              <button type="button" onClick={() => handleRetry(p)} disabled={busyId === p.id} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
                Retry
              </button>
            )}
          </div>
          {rowMessage?.id === p.id && (
            <p className="max-w-[220px] break-all text-xs" style={{ color: rowMessage.isError ? "var(--adm-danger)" : "var(--adm-success)" }}>
              {rowMessage.text}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
          Payments
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
          Real transactions across every connected payment provider — checkout, verification, refunds, and retries.
        </p>
      </div>

      <PaymentAnalyticsCards />

      {isAdmin && <CreatePaymentForm onCreated={reload} />}

      <div className="flex flex-wrap gap-3">
        <FilterSelect label="Filter by status" value={status} onChange={(e) => onFilterChange(setStatus)(e.target.value as PaymentStatus | "")}>
          <option value="">All statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Filter by provider" value={provider} onChange={(e) => onFilterChange(setProvider)(e.target.value as PaymentProviderId | "")}>
          <option value="">All providers</option>
          {PAYMENT_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </FilterSelect>
      </div>

      {loading && <TableSkeleton rows={8} columns={columns.length} />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && <ErrorState message={error ?? "Could not load payments."} onRetry={reload} />}
      {!loading &&
        !forbidden &&
        !error &&
        data &&
        (data.items.length === 0 ? (
          <EmptyState message="No payments match these filters." />
        ) : (
          <div className="space-y-4">
            <Table columns={columns} rows={data.items} getRowKey={(p) => p.id} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </div>
        ))}

      <PaymentWebhookEventsPanel />
    </div>
  );
}
