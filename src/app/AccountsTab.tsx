"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Wallet, Banknote, ArrowRightLeft, AlertCircle, Search, ChevronDown } from "lucide-react";
import styles from "./AccountsTab.module.css";

type Sale = {
  id: string;
  type: string;
  total: number;
  customerName: string | null;
  createdAt: string;
  paidCash: number;
  paidTransfer: number;
  paymentNote: string | null;
  paymentStatus: Status | null;
  paymentUpdatedAt: string | null;
};

type Draft = { cash: string; transfer: string; note: string };
type Status = "pagado" | "parcial" | "debe" | "sin_registrar";
type SaveState = "saving" | "saved" | "error";

const STATUS_LABEL: Record<Status, string> = {
  pagado: "Pagado",
  parcial: "Parcial",
  debe: "Debe",
  sin_registrar: "Sin registrar",
};

const STATUS_COLOR: Record<Status, string> = {
  pagado: "#10b981",
  parcial: "#f59e0b",
  debe: "#ef4444",
  sin_registrar: "#94a3b8",
};

const FILTERS = ["all", "debe", "parcial", "pagado", "sin_registrar"] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

// Accepts "1.500,50" (es-AR), "1500,5", "1500.50" and "1.500".
const parseAmount = (value: string) => {
  const s = value.replace(/[\s$]/g, "");
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d*\.\d{1,2}$/.test(s)) normalized = s;
  else normalized = s.replace(/\./g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

const toInput = (n: number) => (n ? String(n).replace(".", ",") : "");

const STATUS_OPTIONS: Status[] = ["pagado", "parcial", "debe", "sin_registrar"];

const getAutoStatus = (sale: Sale): Status => {
  if (!sale.paymentUpdatedAt) return "sin_registrar";
  const paid = round2(sale.paidCash + sale.paidTransfer);
  if (paid >= round2(sale.total)) return "pagado";
  if (paid <= 0) return "debe";
  return "parcial";
};

// A status chosen by hand wins over the one derived from the amounts.
const getStatus = (sale: Sale): Status => sale.paymentStatus ?? getAutoStatus(sale);

const getBalance = (sale: Sale) =>
  sale.paymentStatus === "pagado" ? 0 : Math.max(0, round2(sale.total - sale.paidCash - sale.paidTransfer));

const toDraft = (sale: Sale): Draft => ({
  cash: toInput(sale.paidCash),
  transfer: toInput(sale.paidTransfer),
  note: sale.paymentNote || "",
});

const sameDraft = (a: Draft, b: Draft) =>
  parseAmount(a.cash) === parseAmount(b.cash) &&
  parseAmount(a.transfer) === parseAmount(b.transfer) &&
  a.note.trim() === b.note.trim();

type Props = {
  sales: Sale[];
  onSaleUpdated: (sale: Sale) => void;
  formatCurrency: (value: number | null | undefined) => string;
  dateFilter: React.ReactNode;
};

export default function AccountsTab({ sales, onSaleUpdated, formatCurrency, dateFilter }: Props) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  const summary = useMemo(() => {
    const acc = { total: 0, cash: 0, transfer: 0, pending: 0, counts: { all: sales.length, pagado: 0, parcial: 0, debe: 0, sin_registrar: 0 } };
    for (const s of sales) {
      acc.total += s.total;
      acc.cash += s.paidCash;
      acc.transfer += s.paidTransfer;
      acc.pending += getBalance(s);
      acc.counts[getStatus(s)]++;
    }
    return acc;
  }, [sales]);

  const visibleSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (statusFilter !== "all" && getStatus(s) !== statusFilter) return false;
      if (term && !`${s.customerName || "consumidor final"} ${s.paymentNote || ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [sales, statusFilter, search]);

  const getDraft = (sale: Sale) => drafts[sale.id] ?? toDraft(sale);

  const updateDraft = (sale: Sale, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [sale.id]: { ...getDraft(sale), ...patch } }));
  };

  const setRowState = (id: string, state: SaveState | null) => {
    clearTimeout(timers.current[id]);
    setSaveState((prev) => {
      const next = { ...prev };
      if (state) next[id] = state;
      else delete next[id];
      return next;
    });
    if (state === "saved") {
      timers.current[id] = setTimeout(() => setRowState(id, null), 2000);
    }
  };

  const save = async (sale: Sale) => {
    const draft = drafts[sale.id];
    if (!draft || sameDraft(draft, toDraft(sale))) return;

    const cash = parseAmount(draft.cash);
    const transfer = parseAmount(draft.transfer);

    if (cash < 0 || transfer < 0) {
      alert("Los montos no pueden ser negativos");
      return;
    }
    if (
      round2(cash + transfer) > round2(sale.total) &&
      !confirm(`Lo cobrado ($${formatCurrency(cash + transfer)}) supera el total de la venta ($${formatCurrency(sale.total)}). ¿Guardar igual?`)
    ) {
      return;
    }

    if (await patchSale(sale, { paidCash: cash, paidTransfer: transfer, paymentNote: draft.note })) {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[sale.id];
        return next;
      });
    }
  };

  const patchSale = async (sale: Sale, body: Record<string, unknown>) => {
    setRowState(sale.id, "saving");
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      onSaleUpdated(data);
      setRowState(sale.id, "saved");
      return true;
    } catch (err) {
      setRowState(sale.id, "error");
      alert(err instanceof Error ? err.message : "Error al guardar");
      return false;
    }
  };

  // Save once focus leaves the whole sale, not on every field change.
  const handleRowBlur = (sale: Sale) => (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    save(sale);
  };

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  const kpis = [
    { label: "Total vendido", value: summary.total, color: "var(--text-primary)", icon: <Wallet size={16} /> },
    { label: "Efectivo", value: summary.cash, color: "#10b981", icon: <Banknote size={16} /> },
    { label: "Transferencia", value: summary.transfer, color: "#60a5fa", icon: <ArrowRightLeft size={16} /> },
    { label: "Pendiente", value: summary.pending, color: "#ef4444", icon: <AlertCircle size={16} /> },
  ];

  return (
    <div className={`animate-in ${styles.wrapper}`}>
      <div className={`glass card ${styles.header}`}>
        <h2 className={styles.title}>
          <Wallet size={22} style={{ color: "var(--primary-color)" }} /> Estado de Cuentas
        </h2>
        {dateFilter}
      </div>

      <div className={styles.kpis}>
        {kpis.map((k) => (
          <div key={k.label} className={`glass card ${styles.kpi}`}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon} style={{ color: k.color }}>{k.icon}</span>
              {k.label}
            </div>
            <p className={styles.kpiValue} style={{ color: k.color }}>${formatCurrency(k.value)}</p>
          </div>
        ))}
      </div>

      <div className="glass card">
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="search"
              placeholder="Buscar cliente o nota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar cliente"
            />
          </div>
          <div className={styles.chips} role="tablist" aria-label="Filtrar por estado">
            {FILTERS.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={statusFilter === f}
                onClick={() => setStatusFilter(f)}
                className={`${styles.chip} ${statusFilter === f ? styles.chipActive : ""}`}
              >
                {f === "all" ? "Todas" : STATUS_LABEL[f]}
                <span className={styles.chipCount}>{summary.counts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        {(search || statusFilter !== "all") && (
          <p className={styles.resultInfo}>
            {visibleSales.length} de {sales.length} ventas
          </p>
        )}

        <div className={styles.list}>
          <div className={styles.headRow} aria-hidden>
            <span>Fecha</span>
            <span>Cliente</span>
            <span>Total</span>
            <span>Efectivo</span>
            <span>Transferencia</span>
            <span>Saldo</span>
            <span>Estado</span>
            <span>Nota</span>
            <span></span>
          </div>

          {visibleSales.length === 0 && <div className={styles.empty}>No hay ventas para mostrar</div>}

          {visibleSales.map((sale) => {
            const draft = getDraft(sale);
            const status = getStatus(sale);
            const balance = getBalance(sale);
            const rowState = saveState[sale.id];
            const customer = sale.customerName || "Consumidor Final";

            return (
              <div
                key={sale.id}
                className={styles.row}
                style={{ "--status-color": STATUS_COLOR[status] } as React.CSSProperties}
                onBlur={handleRowBlur(sale)}
              >
                <span className={styles.date}>
                  {new Date(sale.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                </span>
                <span className={styles.customer} title={customer}>{customer}</span>
                <span className={styles.total}>${formatCurrency(sale.total)}</span>

                <label className={`${styles.field} ${styles.cash}`}>
                  <span className={styles.fieldLabel}>Efectivo</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={draft.cash}
                    onChange={(e) => updateDraft(sale, { cash: e.target.value })}
                    onKeyDown={blurOnEnter}
                    aria-label={`Efectivo de ${customer}`}
                  />
                </label>
                <label className={`${styles.field} ${styles.transfer}`}>
                  <span className={styles.fieldLabel}>Transferencia</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={draft.transfer}
                    onChange={(e) => updateDraft(sale, { transfer: e.target.value })}
                    onKeyDown={blurOnEnter}
                    aria-label={`Transferencia de ${customer}`}
                  />
                </label>

                <span className={styles.balance}>
                  <span className={styles.balanceLabel}>Saldo</span>
                  <span className={balance > 0 ? styles.balanceDue : styles.balanceOk}>${formatCurrency(balance)}</span>
                </span>

                <span className={styles.statusCell}>
                  <span className={styles.statusSelectWrap}>
                    <select
                      className={styles.statusSelect}
                      value={status}
                      onChange={(e) => patchSale(sale, { paymentStatus: e.target.value === "auto" ? null : e.target.value })}
                      aria-label={`Estado de ${customer}`}
                      title={sale.paymentStatus ? "Estado elegido a mano" : "Estado automático según lo cobrado"}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o} value={o}>{STATUS_LABEL[o]}</option>
                      ))}
                      {sale.paymentStatus && (
                        <option value="auto">↺ Automático ({STATUS_LABEL[getAutoStatus(sale)]})</option>
                      )}
                    </select>
                    <ChevronDown size={13} className={styles.statusChevron} />
                  </span>
                </span>

                <label className={`${styles.field} ${styles.note}`}>
                  <span className={styles.fieldLabel}>Nota</span>
                  <input
                    type="text"
                    placeholder="Agregar nota…"
                    value={draft.note}
                    onChange={(e) => updateDraft(sale, { note: e.target.value })}
                    onKeyDown={blurOnEnter}
                    aria-label={`Nota de ${customer}`}
                  />
                </label>

                <span
                  className={`${styles.saved} ${rowState === "saved" ? styles.savedOk : ""} ${rowState === "error" ? styles.savedError : ""}`}
                  aria-live="polite"
                >
                  {rowState === "saving" && "Guardando…"}
                  {rowState === "saved" && "✓ Guardado"}
                  {rowState === "error" && "Error"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
