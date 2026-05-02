import React, { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Allergen = "nuts" | "gluten" | "dairy" | "shellfish" | "eggs" | "soy" | "spicy";
type Station  = "grill" | "fryer" | "cold" | "dessert" | "other";
type Priority = "normal" | "RUSH" | "VIP";
type OrderType = "dine-in" | "takeout" | "bar" | "delivery";

type OrderItem = {
  id: string;
  qty: number;
  name: string;
  station: Station;
  modifiers?: string[];
  allergens?: Allergen[];
};

type Order = {
  id: string;
  number: string;
  customer: string;
  type: OrderType;
  priority: Priority;
  elapsedSec: number;
  items: OrderItem[];
  note?: string;
};

// ─── Config ───────────────────────────────────────────────────────────────────

const STATION_META: Record<Station, { color: string; bg: string; label: string }> = {
  grill:   { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Grill"   },
  fryer:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Fryer"   },
  cold:    { color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  label: "Cold"    },
  dessert: { color: "#a855f7", bg: "rgba(168,85,247,0.12)",  label: "Dessert" },
  other:   { color: "#6b7280", bg: "rgba(107,114,128,0.12)", label: "Other"   },
};

const ALLERGEN_META: Record<Allergen, { label: string; color: string; bg: string }> = {
  nuts:      { label: "Nuts",      color: "#f97316", bg: "rgba(249,115,22,0.18)"  },
  gluten:    { label: "Gluten",    color: "#eab308", bg: "rgba(234,179,8,0.18)"   },
  dairy:     { label: "Dairy",     color: "#60a5fa", bg: "rgba(96,165,250,0.18)"  },
  shellfish: { label: "Shellfish", color: "#f43f5e", bg: "rgba(244,63,94,0.18)"   },
  eggs:      { label: "Eggs",      color: "#fbbf24", bg: "rgba(251,191,36,0.18)"  },
  soy:       { label: "Soy",       color: "#86efac", bg: "rgba(134,239,172,0.18)" },
  spicy:     { label: "🌶 Spicy",  color: "#ef4444", bg: "rgba(239,68,68,0.18)"  },
};

const ORDER_TYPE_META: Record<OrderType, { label: string; color: string }> = {
  "dine-in":  { label: "Dine-in",  color: "#6b7280" },
  "takeout":  { label: "Takeout",  color: "#3b82f6" },
  "bar":      { label: "Bar",      color: "#a855f7" },
  "delivery": { label: "Delivery", color: "#f59e0b" },
};

// Warning threshold in seconds — orders past this turn amber then red
const WARN_SEC  = 540;  // 9 min
const ALERT_SEC = 900;  // 15 min
const NEW_SEC   = 60;   // under 1 min = "NEW"

function urgencyRank(o: Order): number {
  // Lower = more urgent (sorts first)
  const p = o.priority === "RUSH" ? 0 : o.priority === "VIP" ? 1 : 2;
  return p * 100_000 - o.elapsedSec;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timerColor(sec: number, priority: Priority): string {
  if (priority === "RUSH") return "#ef4444";
  if (priority === "VIP")  return "#f59e0b";
  if (sec >= ALERT_SEC)    return "#ef4444";
  if (sec >= WARN_SEC)     return "#f59e0b";
  return "#ffffff";
}

/** % of elapsed toward ALERT_SEC, clamped 0–1 */
function urgencyPct(sec: number, priority: Priority): number {
  if (priority === "RUSH") return 1;
  if (priority === "VIP")  return Math.min(sec / WARN_SEC, 1);
  return Math.min(sec / ALERT_SEC, 1);
}

function progressColor(pct: number, priority: Priority): string {
  if (priority === "RUSH") return "#ef4444";
  if (priority === "VIP")  return "#f59e0b";
  if (pct >= 1)   return "#ef4444";
  if (pct >= 0.6) return "#f59e0b";
  return "#22c55e";
}

function modColor(mod: string): { text: string; dot: string } | null {
  const l = mod.toLowerCase();
  if (/^(no |without |remove |hold )/.test(l)) return { text: "#fca5a5", dot: "#ef4444" };
  if (/^(extra |add |with |double |more )/.test(l)) return { text: "#86efac", dot: "#22c55e" };
  return null;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED: Order[] = [
  {
    id: "1", number: "101", customer: "Table 5", type: "dine-in", priority: "RUSH", elapsedSec: 932,
    note: "⚠ Nut allergy at table",
    items: [
      { id: "i1", qty: 1, name: "Smash Burger",   station: "grill",  modifiers: ["No onions", "Extra cheese"], allergens: ["nuts", "gluten", "dairy"] },
      { id: "i2", qty: 1, name: "Truffle Fries",   station: "fryer",  modifiers: ["Light salt"],               allergens: ["gluten"] },
    ],
  },
  {
    id: "2", number: "105", customer: "Table 7", type: "dine-in", priority: "normal", elapsedSec: 487,
    items: [
      { id: "i3", qty: 1, name: "BBQ Ribs",        station: "grill",  modifiers: ["Extra sauce"] },
      { id: "i4", qty: 1, name: "Coleslaw",         station: "cold"   },
      { id: "i5", qty: 1, name: "Onion Rings",      station: "fryer"  },
    ],
  },
  {
    id: "3", number: "108", customer: "Bar 3", type: "bar", priority: "normal", elapsedSec: 88,
    items: [
      { id: "i6", qty: 2, name: "Caesar Salad",    station: "cold",   modifiers: ["Dressing on side"],         allergens: ["dairy", "eggs"] },
      { id: "i7", qty: 1, name: "Grilled Chicken", station: "grill",  modifiers: ["Add lemon", "No skin"] },
    ],
  },
  {
    id: "4", number: "109", customer: "To Go #12", type: "takeout", priority: "VIP", elapsedSec: 445,
    note: "VIP member — priority packaging",
    items: [
      { id: "i8", qty: 1, name: "NY Strip",        station: "grill",  modifiers: ["Medium rare", "No sauce"],  allergens: ["soy"] },
      { id: "i9", qty: 1, name: "Crème Brûlée",    station: "dessert" },
    ],
  },
  {
    id: "5", number: "112", customer: "Table 2", type: "dine-in", priority: "normal", elapsedSec: 22,
    items: [
      { id: "i10", qty: 2, name: "Fish & Chips",   station: "fryer",  modifiers: ["Extra tartar"] },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AllergenBadge({ a }: { a: Allergen }) {
  const m = ALLERGEN_META[a];
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}55` }}
    >
      ⚠ {m.label}
    </span>
  );
}

function ModLine({ mod, showColors }: { mod: string; showColors: boolean }) {
  const sem = showColors ? modColor(mod) : null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sem?.dot ?? "#6b7280" }} />
      <span className="text-xs leading-tight" style={{ color: sem?.text ?? "rgba(255,255,255,0.45)" }}>{mod}</span>
    </div>
  );
}

function ItemRow({
  item, done, onToggle, showAllergens, showStationColors, showModifierColors,
}: {
  item: OrderItem; done: boolean; onToggle: () => void;
  showAllergens: boolean; showStationColors: boolean; showModifierColors: boolean;
}) {
  const sm = STATION_META[item.station];
  return (
    <div
      className="flex flex-col gap-1 cursor-pointer"
      onClick={onToggle}
      style={{ opacity: done ? 0.38 : 1, transition: "opacity 0.18s" }}
    >
      <div className="flex items-start gap-2.5">
        {/* Qty badge — station-colored */}
        <div
          className="flex items-center justify-center text-[10px] font-black rounded shrink-0 mt-0.5 w-5 h-5"
          style={{ background: showStationColors ? sm.color : "#374151", color: "#000" }}
          title={sm.label}
        >
          {item.qty}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span
              className="font-semibold leading-tight"
              style={{ color: done ? "#6b7280" : "#f5f5f5", textDecoration: done ? "line-through" : "none", fontSize: 14 }}
            >
              {item.name}
            </span>
            {showStationColors && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{ background: sm.bg, color: sm.color, opacity: 0.8 }}
              >
                {sm.label}
              </span>
            )}
          </div>

          {item.modifiers && item.modifiers.length > 0 && (
            <div className="flex flex-col gap-0.5 mt-1">
              {item.modifiers.map((m, i) => <ModLine key={i} mod={m} showColors={showModifierColors} />)}
            </div>
          )}

          {showAllergens && item.allergens && item.allergens.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.allergens.map(a => <AllergenBadge key={a} a={a} />)}
            </div>
          )}
        </div>

        {/* Check box */}
        <div
          className="shrink-0 w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition-colors"
          style={{
            borderColor: done ? sm.color : "rgba(255,255,255,0.15)",
            background:   done ? sm.color : "transparent",
          }}
        >
          {done && <span className="text-black text-[9px] font-black">✓</span>}
        </div>
      </div>
    </div>
  );
}

/** Thin progress bar at card bottom showing time urgency */
function UrgencyBar({ sec, priority }: { sec: number; priority: Priority }) {
  const pct = urgencyPct(sec, priority);
  const color = progressColor(pct, priority);
  return (
    <div className="h-0.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.round(pct * 100)}%`, background: color }}
      />
    </div>
  );
}

/** Brief "✓ Bumped #XXX" toast */
function BumpToast({ number, onDone }: { number: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2"
      style={{
        background: "rgba(34,197,94,0.15)",
        border: "1px solid rgba(34,197,94,0.35)",
        color: "#86efac",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        animation: "fadeSlideIn 0.2s ease",
      }}
    >
      <span style={{ fontSize: 11 }}>✓</span> Bumped #{number}
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order, featured, doneItems, onToggleItem, onBump, onFocus,
  showAllergens, showStationColors, showModifierColors, showOrderType, showNotes,
}: {
  order: Order;
  featured: boolean;
  doneItems: Set<string>;
  onToggleItem: (id: string) => void;
  onBump: () => void;
  onFocus: () => void;
  showAllergens: boolean;
  showStationColors: boolean;
  showModifierColors: boolean;
  showOrderType: boolean;
  showNotes: boolean;
}) {
  const pColor  = order.priority === "RUSH" ? "#ef4444" : order.priority === "VIP" ? "#f59e0b" : "rgba(255,255,255,0.06)";
  const hasPrio = order.priority !== "normal";
  const tColor  = timerColor(order.elapsedSec, order.priority);
  const typeMeta = ORDER_TYPE_META[order.type];
  const doneCount = order.items.filter(it => doneItems.has(it.id)).length;
  const allDone   = doneCount === order.items.length;
  const isNew     = order.elapsedSec < NEW_SEC;

  // Items split into 2 cols on the featured wide card when many items
  const itemCols = featured && order.items.length >= 3 ? 2 : 1;

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden border cursor-pointer transition-all relative"
      style={{
        gridColumn: featured ? "span 2" : "span 1",
        background: "#111116",
        borderColor: featured
          ? (hasPrio ? `${pColor}66` : "rgba(255,255,255,0.15)")
          : (hasPrio ? `${pColor}33` : "rgba(255,255,255,0.06)"),
        boxShadow: featured && hasPrio ? `0 0 28px ${pColor}18` : "none",
      }}
      onClick={onFocus}
    >
      {/* Top stripe */}
      <div style={{ height: featured ? 3 : 2, background: hasPrio ? pColor : "rgba(255,255,255,0.05)" }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className="text-white/40 text-[10px] font-semibold tracking-wide truncate">{order.customer}</span>
              {showOrderType && (
                <span
                  className="text-[8px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wider shrink-0"
                  style={{ color: typeMeta.color, borderColor: `${typeMeta.color}44`, background: `${typeMeta.color}12` }}
                >
                  {typeMeta.label}
                </span>
              )}
              {hasPrio && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0"
                  style={{ background: `${pColor}22`, color: pColor }}
                >
                  {order.priority}
                </span>
              )}
              {isNew && (
                <span
                  className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0"
                  style={{
                    background: "rgba(34,197,94,0.15)",
                    color: "#86efac",
                    border: "1px solid rgba(34,197,94,0.3)",
                    animation: "pulse 1.4s ease-in-out infinite",
                  }}
                >
                  NEW
                </span>
              )}
            </div>

            {/* Order number */}
            <span
              className="font-black text-white leading-none tracking-tight"
              style={{ fontSize: featured ? 42 : 30 }}
            >
              #{order.number}
            </span>
          </div>

          {/* Right side — timer + item count + bump */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: tColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span
                className="font-mono tabular-nums font-bold"
                style={{ fontSize: featured ? 18 : 14, color: tColor }}
              >
                {fmtTime(order.elapsedSec)}
              </span>
            </div>

            {/* Item count chip */}
            <span className="text-[9px] text-white/30 font-medium">
              {doneCount}/{order.items.length} items
            </span>

            <button
              onClick={e => { e.stopPropagation(); onBump(); }}
              className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-all active:scale-95"
              style={{
                background: hasPrio ? `${pColor}18` : "rgba(255,255,255,0.05)",
                borderColor: hasPrio ? `${pColor}44` : "rgba(255,255,255,0.1)",
                color: hasPrio ? pColor : "rgba(255,255,255,0.4)",
              }}
            >
              Bump ↵
            </button>
          </div>
        </div>

        {/* ── Note ── */}
        {showNotes && order.note && (
          <div
            className="text-[10px] px-2.5 py-1.5 rounded-lg border flex items-center gap-2"
            style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.22)", color: "#fbbf24" }}
          >
            <span className="shrink-0">📋</span>
            <span className="leading-snug">{order.note}</span>
          </div>
        )}

        {/* ── Items ── */}
        <div
          className="flex-1"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${itemCols}, 1fr)`,
            gap: "10px 16px",
          }}
        >
          {order.items.map((item, idx) => (
            <div
              key={item.id}
              className="flex flex-col"
              style={{ borderTop: idx > 0 && itemCols === 1 ? "1px solid rgba(255,255,255,0.05)" : "none", paddingTop: idx > 0 && itemCols === 1 ? 10 : 0 }}
            >
              <ItemRow
                item={item}
                done={doneItems.has(item.id)}
                onToggle={() => onToggleItem(item.id)}
                showAllergens={showAllergens}
                showStationColors={showStationColors}
                showModifierColors={showModifierColors}
              />
            </div>
          ))}
        </div>

        {allDone && (
          <p className="text-center text-[10px] text-white/25 tracking-wide">All items ready — bump to complete</p>
        )}

        {/* ── Urgency progress bar ── */}
        <UrgencyBar sec={order.elapsedSec} priority={order.priority} />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS = ["All Stations", "Grill", "Cold Prep", "Fryer", "Dessert"];
const TAB_COLORS: Record<string, string> = {
  "All Stations": "#ffffff", Grill: "#ef4444", "Cold Prep": "#3b82f6", Fryer: "#f59e0b", Dessert: "#a855f7",
};
const TAB_STATION: Record<string, Station | null> = {
  "All Stations": null, Grill: "grill", "Cold Prep": "cold", Fryer: "fryer", Dessert: "dessert",
};

export function StructuredGrid() {
  const [orders, setOrders]         = useState(() => [...SEED].sort((a, b) => urgencyRank(a) - urgencyRank(b)));
  const [activeTab, setActiveTab]   = useState("All Stations");
  const [focusedId, setFocusedId]   = useState(orders[0]?.id ?? null);
  const [doneItems, setDoneItems]   = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast]           = useState<{ number: string } | null>(null);

  // Settings
  const [featuredFirst,      setFeaturedFirst]      = useState(true);
  const [showAllergens,      setShowAllergens]      = useState(true);
  const [showStationColors,  setShowStationColors]  = useState(true);
  const [showModifierColors, setShowModifierColors] = useState(true);
  const [showOrderType,      setShowOrderType]      = useState(true);
  const [showNotes,          setShowNotes]          = useState(true);

  function bump(id: string) {
    const bumped = orders.find(o => o.id === id);
    setOrders(prev => {
      const next = prev.filter(o => o.id !== id);
      if (focusedId === id) setFocusedId(next[0]?.id ?? null);
      return next;
    });
    setDoneItems(prev => {
      const next = new Set(prev);
      bumped?.items.forEach(it => next.delete(it.id));
      return next;
    });
    if (bumped) setToast({ number: bumped.number });
  }

  function toggleItem(itemId: string) {
    setDoneItems(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }

  const stationFilter  = TAB_STATION[activeTab];
  const visibleOrders  = stationFilter
    ? orders.filter(o => o.items.some(it => it.station === stationFilter))
    : orders;

  const focusedOrder   = visibleOrders.find(o => o.id === focusedId) ?? visibleOrders[0] ?? null;
  const tabColor       = TAB_COLORS[activeTab] ?? "#ffffff";

  const SETTINGS = [
    { label: "Featured first",   value: featuredFirst,      set: setFeaturedFirst },
    { label: "Allergens",        value: showAllergens,      set: setShowAllergens },
    { label: "Station colors",   value: showStationColors,  set: setShowStationColors },
    { label: "Modifier colors",  value: showModifierColors, set: setShowModifierColors },
    { label: "Order type",       value: showOrderType,      set: setShowOrderType },
    { label: "Notes",            value: showNotes,          set: setShowNotes },
  ];

  return (
    <div
      className="min-h-screen bg-[#0a0a0b] text-white flex flex-col select-none"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Header ── */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-white/[0.07] shrink-0 bg-[#0d0d10]">
        <div className="flex items-center gap-1.5">
          {TABS.map(tab => {
            const active = activeTab === tab;
            const c = TAB_COLORS[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={
                  active
                    ? { background: c, color: tab === "All Stations" ? "#000" : "#fff" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }
                }
              >
                {!active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />}
                {tab}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-white/35 text-xs">
            <span className="text-white font-semibold mr-0.5">{visibleOrders.length}</span> active
          </span>
          <button
            onClick={() => setSettingsOpen(s => !s)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: settingsOpen ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)", color: settingsOpen ? "#fff" : "rgba(255,255,255,0.38)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Settings panel ── */}
      {settingsOpen && (
        <div className="border-b border-white/[0.07] bg-[#111114] px-4 py-2.5 flex flex-wrap gap-5 items-center">
          <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.18em]">Display</span>
          {SETTINGS.map(({ label, value, set }) => (
            <button
              key={label}
              onClick={() => set((v: boolean) => !v)}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
                style={{ background: value ? tabColor : "rgba(255,255,255,0.1)" }}
              >
                <span
                  className="w-3 h-3 rounded-full bg-white transition-all"
                  style={{ transform: value ? "translateX(16px)" : "translateX(0)" }}
                />
              </span>
              <span style={{ color: value ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)" }}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Grid ── */}
      <main className="flex-1 overflow-y-auto p-4">
        {visibleOrders.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="text-4xl mb-3 text-white/10">✓</div>
              <p className="text-white/20 text-sm tracking-wide">All clear — kitchen idle</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 items-start">
            {visibleOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                featured={featuredFirst && order.id === focusedOrder?.id}
                doneItems={doneItems}
                onToggleItem={toggleItem}
                onBump={() => bump(order.id)}
                onFocus={() => setFocusedId(order.id)}
                showAllergens={showAllergens}
                showStationColors={showStationColors}
                showModifierColors={showModifierColors}
                showOrderType={showOrderType}
                showNotes={showNotes}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Bump bar ── */}
      <footer className="h-10 border-t border-white/[0.07] bg-[#0d0d10] flex items-center px-4 shrink-0 gap-6">
        {[
          { keys: ["SPACE"],    label: "Bump" },
          { keys: ["R"],        label: "Recall" },
          { keys: ["↑", "↓"],  label: "Navigate" },
          { keys: ["S"],        label: "Settings" },
        ].map(({ keys, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex gap-1">
              {keys.map(k => (
                <kbd key={k} className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-white/[0.14] bg-white/[0.06] text-white/55">{k}</kbd>
              ))}
            </div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </footer>

      {/* ── Bump toast ── */}
      {toast && <BumpToast number={toast.number} onDone={() => setToast(null)} />}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateX(-50%) translateY(6px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      `}</style>
    </div>
  );
}
