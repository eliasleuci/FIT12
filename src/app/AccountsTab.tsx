"use client";

import { useMemo, useState } from "react";
import { Wallet, Banknote, ArrowRightLeft, AlertCircle, Save, Search } from "lucide-react";

type Sale = {
  id: string;
  type: string;
  total: number;
  customerName: string | null;
  createdAt: string;
  paidCash: number;
  paidTransfer: number;
  paymentNote: string | null;
  paymentUpdatedAt: string | null;
};

type Draft = { cash: string; transfer: string; note: string };
type Status = "pagado" | "parcial" | "debe" | "sin_registrar";

const STATUS_LABEL: Record<Status, string> = {
  pagado: "Pagado",
  parcial: "Pago parcial",
  debe: "Debe",
  sin_registrar: "Sin registrar",
};

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  pagado: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  parcial: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  debe: { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
  sin_registrar: { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const getStatus = (sale: Sale): Status => {
  if (!sale.paymentUpdatedAt) return "sin_registrar";
  const paid = round2(sale.paidCash + sale.paidTransfer);
  if (paid >= round2(sale.total)) return "pagado";
  if (paid <= 0) return "debe";
  return "parcial";
};

const getBalance = (sale: Sale) => Math.max(0, round2(sale.total - sale.paidCash - sale.paidTransfer));

const toDraft = (sale: Sale): Draft => ({
  cash: sale.paidCash ? String(sale.paidCash) : "",
  transfer: sale.paidTransfer ? String(sale.paidTransfer) : "",
  note: sale.paymentNote || "",
});

type Props = {
  sales: Sale[];
  onSaleUpdated: (sale: Sale) => void;
  formatCurrency: (value: number | null | undefined) => string;
  dateFilter: React.ReactNode;
};

export default function AccountsTab({ sales, onSaleUpdated, formatCurrency, dateFilter }: Props) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");

  const summary = useMemo(() => {
    return sales.reduce(
      (acc, s) => {
        acc.total += s.total;
        acc.cash += s.paidCash;
        acc.transfer += s.paidTransfer;
        acc.pending += getBalance(s);
        return acc;
      },
      { total: 0, cash: 0, transfer: 0, pending: 0 }
    );
  }, [sales]);

  const visibleSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (statusFilter !== "all" && getStatus(s) !== statusFilter) return false;
      if (term && !(s.customerName || "consumidor final").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [sales, statusFilter, search]);

  const getDraft = (sale: Sale) => drafts[sale.id] ?? toDraft(sale);

  const updateDraft = (sale: Sale, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [sale.id]: { ...getDraft(sale), ...patch } }));
  };

  const isDirty = (sale: Sale) => {
    const d = drafts[sale.id];
    if (!d) return false;
    const original = toDraft(sale);
    return d.cash !== original.cash || d.transfer !== original.transfer || d.note !== original.note;
  };

  const save = async (sale: Sale, override?: Partial<Draft>) => {
    const draft = { ...getDraft(sale), ...override };
    const cash = parseFloat(draft.cash.replace(",", ".")) || 0;
    const transfer = parseFloat(draft.transfer.replace(",", ".")) || 0;

    if (cash < 0 || transfer < 0) {
      alert("Los montos no pueden ser negativos");
      return;
    }
    if (round2(cash + transfer) > round2(sale.total) &&
      !confirm(`Lo cobrado ($${formatCurrency(cash + transfer)}) supera el total de la venta ($${formatCurrency(sale.total)}). ¿Guardar igual?`)) {
      return;
    }

    setSavingId(sale.id);
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidCash: cash, paidTransfer: transfer, paymentNote: draft.note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      onSaleUpdated(data);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[sale.id];
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingId(null);
    }
  };

  const inputStyle: React.CSSProperties = { padding: "0.35rem 0.5rem", width: "110px", fontSize: "0.85rem" };
  const quickBtn: React.CSSProperties = {
    padding: "0.3rem 0.55rem", fontSize: "0.75rem", borderRadius: "0.4rem", cursor: "pointer",
    border: "1px solid rgba(148,163,184,0.3)", background: "transparent", color: "var(--text-secondary)", whiteSpace: "nowrap",
  };

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div className="glass card" style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1.2rem 2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <Wallet size={24} style={{ color: "var(--primary-color)" }} />
          <h2 style={{ margin: 0 }}>Estado de Cuentas</h2>
        </div>
        {dateFilter}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.2rem" }}>
        <div className="glass card stats-card">
          <div className="stats-icon" style={{ background: "rgba(59,130,246,0.1)", color: "var(--primary-color)" }}><Wallet size={24} /></div>
          <div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Total vendido</p>
            <h3>${formatCurrency(summary.total)}</h3>
          </div>
        </div>
        <div className="glass card stats-card">
          <div className="stats-icon" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}><Banknote size={24} /></div>
          <div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Cobrado en efectivo</p>
            <h3 style={{ color: "#10b981" }}>${formatCurrency(summary.cash)}</h3>
          </div>
        </div>
        <div className="glass card stats-card">
          <div className="stats-icon" style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa" }}><ArrowRightLeft size={24} /></div>
          <div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Cobrado por transferencia</p>
            <h3 style={{ color: "#60a5fa" }}>${formatCurrency(summary.transfer)}</h3>
          </div>
        </div>
        <div className="glass card stats-card">
          <div className="stats-icon" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}><AlertCircle size={24} /></div>
          <div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Pendiente de cobro</p>
            <h3 style={{ color: "#ef4444" }}>${formatCurrency(summary.pending)}</h3>
          </div>
        </div>
      </div>

      <div className="glass card">
        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginBottom: "1.2rem", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search size={16} style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            <input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "2.2rem", width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {(["all", "debe", "parcial", "pagado", "sin_registrar"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  ...quickBtn,
                  fontSize: "0.8rem",
                  padding: "0.4rem 0.8rem",
                  background: statusFilter === s ? "var(--primary-color)" : "transparent",
                  color: statusFilter === s ? "white" : "var(--text-secondary)",
                }}
              >
                {s === "all" ? "Todas" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="table-container scroll-container" style={{ maxHeight: "600px" }}>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Efectivo</th>
                <th>Transferencia</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Nota</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleSales.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-secondary)" }}>No hay ventas para mostrar</td></tr>
              )}
              {visibleSales.map((sale) => {
                const draft = getDraft(sale);
                const status = getStatus(sale);
                const dirty = isDirty(sale);
                const saving = savingId === sale.id;
                return (
                  <tr key={sale.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(sale.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>{sale.customerName || "Consumidor Final"}</td>
                    <td style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>${formatCurrency(sale.total)}</td>
                    <td>
                      <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={draft.cash}
                        onChange={(e) => updateDraft(sale, { cash: e.target.value })} style={inputStyle} />
                    </td>
                    <td>
                      <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={draft.transfer}
                        onChange={(e) => updateDraft(sale, { transfer: e.target.value })} style={inputStyle} />
                    </td>
                    <td style={{ fontWeight: "bold", whiteSpace: "nowrap", color: getBalance(sale) > 0 ? "#ef4444" : "#10b981" }}>
                      ${formatCurrency(getBalance(sale))}
                    </td>
                    <td>
                      <span style={{ background: STATUS_STYLE[status].bg, color: STATUS_STYLE[status].color, padding: "0.2rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "bold", whiteSpace: "nowrap" }}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td>
                      <input placeholder="Ej: paga el viernes" value={draft.note}
                        onChange={(e) => updateDraft(sale, { note: e.target.value })} style={{ ...inputStyle, width: "160px" }} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                        <button style={quickBtn} disabled={saving} title="Marcar pagado todo en efectivo"
                          onClick={() => save(sale, { cash: String(sale.total), transfer: "" })}>Todo efectivo</button>
                        <button style={quickBtn} disabled={saving} title="Marcar pagado todo por transferencia"
                          onClick={() => save(sale, { cash: "", transfer: String(sale.total) })}>Todo transf.</button>
                        <button style={quickBtn} disabled={saving} title="Marcar que no pagó nada"
                          onClick={() => save(sale, { cash: "", transfer: "" })}>Debe</button>
                        <button
                          disabled={!dirty || saving}
                          onClick={() => save(sale)}
                          style={{
                            ...quickBtn,
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            background: dirty ? "var(--primary-color)" : "transparent",
                            color: dirty ? "white" : "var(--text-secondary)",
                            opacity: dirty && !saving ? 1 : 0.5,
                            cursor: dirty && !saving ? "pointer" : "default",
                          }}
                        >
                          <Save size={13} /> {saving ? "..." : "Guardar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
