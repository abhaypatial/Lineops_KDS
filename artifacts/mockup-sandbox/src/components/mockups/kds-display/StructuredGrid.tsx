import React, { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Allergen = "nuts" | "gluten" | "dairy" | "shellfish" | "eggs" | "soy" | "spicy";
type Station = "grill" | "fryer" | "cold" | "dessert" | "other";
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
  grill:   { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Grill" },
  fryer:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Fryer" },
  cold:    { color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  label: "Cold" },
  dessert: { color: "#a855f7", bg: "rgba(168,85,247,0.12)",  label: "Dessert" },
  other:   { color: "#6b7280", bg: "rgba(107,114,128,0.12)", label: "Other" },
};

const ALLERGEN_META: Record<Allergen, { label: string; color: string; bg: string }> = {
  nuts:      { label: "Nuts",      color: "#f97316", bg: "rgba(249,115,22,0.18)" },
  gluten:    { label: "Gluten",    color: "#eab308", bg: "rgba(234,179,8,0.18)" },
  dairy:     { label: "Dairy",     color: "#60a5fa", bg: "rgba(96,165,250,0.18)" },
  shellfish: { label: "Shellfish", color: "#f43f5e", bg: "rgba(244,63,94,0.18)" },
  eggs:      { label: "Eggs",      color: "#fde68a", bg: "rgba(253,230,138,0.18)" },
  soy:       { label: "Soy",       color: "#86efac", bg: "rgba(134,239,172,0.18)" },
  spicy:     { label: "🌶 Spicy",  color: "#ef4444", bg: "rgba(239,68,68,0.18)" },
};

const ORDER_TYPE_META: Record<OrderType, { label: string; color: string }> = {
  "dine-in":  { label: "Dine-in",  color: "#6b7280" },
  "takeout":  { label: "Takeout",  color: "#3b82f6" },
  "bar":      { label: "Bar",      color: "#a855f7" },
  "delivery": { label: "Delivery", color: "#f59e0b" },
};

// Returns semantic color for a modifier string
function modifierColor(mod: string): { text: string; dot: string } | null {
  const lower = mod.toLowerCase();
  const isRemoval = /^(no |without |remove |hold |no$)/.test(lower);
  const isAddition = /^(extra |add |with |double |more )/.test(lower);
  if (isRemoval)  return { text: "#fca5a5", dot: "#ef4444" };
  if (isAddition) return { text: "#86efac", dot: "#22c55e" };
  return null; // neutral
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timerColor(sec: number, priority: Priority) {
  if (priority === "RUSH") return "#ef4444";
  if (priority === "VIP")  return "#f59e0b";
  if (sec >= 900) return "#ef4444";
  if (sec >= 540) return "#f59e0b";
  return "#ffffff";
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_ORDERS: Order[] = [
  {
    id: "1", number: "101", customer: "Table 5", type: "dine-in", priority: "RUSH", elapsedSec: 932,
    note: "Allergy: customer has nut allergy at table",
    items: [
      { id: "i1", qty: 1, name: "Smash Burger",  station: "grill",  modifiers: ["No onions", "Extra cheese"],  allergens: ["nuts", "gluten", "dairy"] },
      { id: "i2", qty: 1, name: "Truffle Fries",  station: "fryer",  modifiers: ["Light salt"],                allergens: ["gluten"] },
    ],
  },
  {
    id: "2", number: "105", customer: "Table 7", type: "dine-in", priority: "normal", elapsedSec: 487,
    items: [
      { id: "i3", qty: 1, name: "BBQ Ribs",       station: "grill",  modifiers: ["Extra sauce"] },
      { id: "i4", qty: 1, name: "Coleslaw",        station: "cold" },
      { id: "i5", qty: 1, name: "Onion Rings",     station: "fryer" },
    ],
  },
  {
    id: "3", number: "108", customer: "Bar 3", type: "bar", priority: "normal", elapsedSec: 88,
    items: [
      { id: "i6", qty: 2, name: "Caesar Salad",   station: "cold",   modifiers: ["Dressing on side"],          allergens: ["dairy", "eggs"] },
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
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AllergenBadge({ allergen }: { allergen: Allergen }) {
  const m = ALLERGEN_META[allergen];
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}55` }}
    >
      ⚠ {m.label}
    </span>
  );
}

function ModifierLine({ mod }: { mod: string }) {
  const semantic = modifierColor(mod);
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: semantic?.dot ?? "#6b7280" }}
      />
      <span
        className="text-xs leading-tight"
        style={{ color: semantic?.text ?? "rgba(255,255,255,0.45)" }}
      >
        {mod}
      </span>
    </div>
  );
}

function ItemRow({
  item,
  done,
  onToggle,
  showAllergens,
}: {
  item: OrderItem;
  done: boolean;
  onToggle: () => void;
  showAllergens: boolean;
}) {
  const sm = STATION_META[item.station];
  return (
    <div
      className="flex flex-col gap-1 cursor-pointer group"
      onClick={onToggle}
      style={{ opacity: done ? 0.4 : 1, transition: "opacity 0.2s" }}
    >
      <div className="flex items-start gap-2.5">
        {/* Station color dot + qty */}
        <div
          className="flex items-center justify-center text-[10px] font-black rounded shrink-0 mt-0.5 w-5 h-5"
          style={{ background: sm.color, color: "#000" }}
          title={sm.label}
        >
          {item.qty}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="font-semibold leading-tight"
              style={{
                color: done ? "#6b7280" : "#f5f5f5",
                textDecoration: done ? "line-through" : "none",
                fontSize: 14,
              }}
            >
              {item.name}
            </span>
            {/* Station tag */}
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider opacity-70"
              style={{ background: sm.bg, color: sm.color }}
            >
              {sm.label}
            </span>
          </div>

          {/* Modifiers */}
          {item.modifiers && item.modifiers.length > 0 && (
            <div className="flex flex-col gap-0.5 mt-1 pl-0">
              {item.modifiers.map((mod, i) => <ModifierLine key={i} mod={mod} />)}
            </div>
          )}

          {/* Allergens */}
          {showAllergens && item.allergens && item.allergens.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.allergens.map(a => <AllergenBadge key={a} allergen={a} />)}
            </div>
          )}
        </div>

        {/* Done checkmark */}
        <div
          className="shrink-0 w-4 h-4 rounded border mt-0.5 flex items-center justify-center"
          style={{
            borderColor: done ? sm.color : "rgba(255,255,255,0.15)",
            background: done ? sm.color : "transparent",
          }}
        >
          {done && <span className="text-black text-[9px] font-black">✓</span>}
        </div>
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
  const [orders, setOrders] = useState(SEED_ORDERS);
  const [activeTab, setActiveTab] = useState("All Stations");
  const [focusedId, setFocusedId] = useState(orders[0]?.id ?? null);
  const [doneItems, setDoneItems] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Settings
  const [spotlightMode, setSpotlightMode] = useState(true);
  const [showAllergens, setShowAllergens] = useState(true);
  const [showStationColors, setShowStationColors] = useState(true);
  const [showModifierColors, setShowModifierColors] = useState(true);
  const [showOrderType, setShowOrderType] = useState(true);
  const [showNotes, setShowNotes] = useState(true);

  function bump(id: string) {
    setOrders(prev => {
      const next = prev.filter(o => o.id !== id);
      if (focusedId === id) setFocusedId(next[0]?.id ?? null);
      return next;
    });
    // Clear done items for this order
    setDoneItems(prev => {
      const next = new Set(prev);
      orders.find(o => o.id === id)?.items.forEach(it => next.delete(it.id));
      return next;
    });
  }

  function toggleItem(itemId: string) {
    setDoneItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  // Filter by station tab
  const stationFilter = TAB_STATION[activeTab];
  const visibleOrders = stationFilter
    ? orders.filter(o => o.items.some(it => it.station === stationFilter))
    : orders;

  const focusedOrder = visibleOrders.find(o => o.id === focusedId) ?? visibleOrders[0] ?? null;
  const gridOrders = spotlightMode ? visibleOrders.filter(o => o.id !== focusedOrder?.id) : visibleOrders;

  const tabColor = TAB_COLORS[activeTab] ?? "#ffffff";

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans select-none" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-white/[0.08] shrink-0 bg-[#0d0d10]">
        <div className="flex items-center gap-1.5">
          {TABS.map(tab => {
            const isActive = activeTab === tab;
            const c = TAB_COLORS[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={
                  isActive
                    ? { background: c, color: tab === "All Stations" ? "#000" : "#fff" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)" }
                }
              >
                {!isActive && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />}
                {tab}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-white/40 text-xs">
            <span className="text-white font-semibold">{visibleOrders.length}</span> active
          </span>

          {/* Settings toggle */}
          <button
            onClick={() => setSettingsOpen(s => !s)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: settingsOpen ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)", color: settingsOpen ? "#fff" : "rgba(255,255,255,0.4)" }}
            title="Display settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {settingsOpen && (
        <div className="border-b border-white/[0.08] bg-[#111114] px-4 py-3 flex flex-wrap gap-4 items-center">
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mr-2">Display</span>
          {[
            { label: "Spotlight first", value: spotlightMode, set: setSpotlightMode },
            { label: "Allergens",        value: showAllergens,      set: setShowAllergens },
            { label: "Station colors",   value: showStationColors,  set: setShowStationColors },
            { label: "Modifier colors",  value: showModifierColors, set: setShowModifierColors },
            { label: "Order type",       value: showOrderType,      set: setShowOrderType },
            { label: "Notes",            value: showNotes,          set: setShowNotes },
          ].map(({ label, value, set }) => (
            <button
              key={label}
              onClick={() => set((v: boolean) => !v)}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className="w-8 h-4 rounded-full flex items-center transition-all px-0.5"
                style={{ background: value ? tabColor : "rgba(255,255,255,0.1)" }}
              >
                <span
                  className="w-3 h-3 rounded-full bg-white transition-all"
                  style={{ transform: value ? "translateX(16px)" : "translateX(0)" }}
                />
              </span>
              <span style={{ color: value ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)" }}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <main className="flex-1 overflow-y-auto p-4">
        {visibleOrders.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-24">
            <p className="text-white/20 text-lg">All clear</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* SPOTLIGHT — first order */}
          {spotlightMode && focusedOrder && (
            <SpotlightCard
              order={focusedOrder}
              doneItems={doneItems}
              onToggleItem={toggleItem}
              onBump={() => bump(focusedOrder.id)}
              showAllergens={showAllergens}
              showStationColors={showStationColors}
              showModifierColors={showModifierColors}
              showOrderType={showOrderType}
              showNotes={showNotes}
              tabColor={tabColor}
            />
          )}

          {/* GRID — remaining orders */}
          {gridOrders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gridOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isFocused={!spotlightMode && order.id === focusedId}
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
        </div>
      </main>

      {/* Bump Bar */}
      <footer className="h-10 border-t border-white/[0.08] bg-[#0d0d10] flex items-center px-4 shrink-0 gap-6">
        {[
          { keys: ["SPACE"], label: "Bump Order" },
          { keys: ["R"],     label: "Recall" },
          { keys: ["↑", "↓"], label: "Navigate" },
          { keys: ["S"],     label: "Settings" },
        ].map(({ keys, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex gap-1">
              {keys.map(k => (
                <kbd key={k} className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-white/15 bg-white/[0.07] text-white/60">{k}</kbd>
              ))}
            </div>
            <span className="text-[10px] text-white/35 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </footer>
    </div>
  );
}

// ─── Spotlight Card ───────────────────────────────────────────────────────────

function SpotlightCard({
  order, doneItems, onToggleItem, onBump,
  showAllergens, showStationColors, showModifierColors, showOrderType, showNotes, tabColor,
}: {
  order: Order; doneItems: Set<string>; onToggleItem: (id: string) => void; onBump: () => void;
  showAllergens: boolean; showStationColors: boolean; showModifierColors: boolean;
  showOrderType: boolean; showNotes: boolean; tabColor: string;
}) {
  const pColor = order.priority === "RUSH" ? "#ef4444" : order.priority === "VIP" ? "#f59e0b" : tabColor;
  const tColor = timerColor(order.elapsedSec, order.priority);
  const typeMeta = ORDER_TYPE_META[order.type];
  const allDone = order.items.every(it => doneItems.has(it.id));

  return (
    <div
      className="rounded-xl overflow-hidden border relative"
      style={{
        background: "#111116",
        borderColor: `${pColor}55`,
        boxShadow: `0 0 40px ${pColor}18`,
      }}
    >
      {/* Priority stripe */}
      <div style={{ height: 3, background: pColor }} />

      <div className="flex">
        {/* Left accent bar */}
        <div className="w-1 shrink-0" style={{ background: `${pColor}33` }} />

        <div className="flex-1 p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white/40 text-xs font-semibold tracking-wide">{order.customer}</span>
                {showOrderType && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider"
                    style={{ color: typeMeta.color, borderColor: `${typeMeta.color}44`, background: `${typeMeta.color}12` }}>
                    {typeMeta.label}
                  </span>
                )}
                {order.priority !== "normal" && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                    style={{ background: `${pColor}22`, color: pColor, border: `1px solid ${pColor}44` }}>
                    {order.priority}
                  </span>
                )}
              </div>
              <span className="font-black text-white leading-none" style={{ fontSize: 52, letterSpacing: "-0.03em" }}>
                #{order.number}
              </span>
            </div>
            <div className="flex flex-col items-end gap-2 mt-1">
              <span className="font-mono font-black" style={{ fontSize: 36, lineHeight: 1, color: tColor }}>
                {fmtTime(order.elapsedSec)}
              </span>
              <button
                onClick={onBump}
                className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                style={{ background: `${pColor}22`, color: pColor, border: `1px solid ${pColor}44` }}
              >
                Bump ↵
              </button>
            </div>
          </div>

          {/* Note */}
          {showNotes && order.note && (
            <div className="mb-4 px-3 py-2 rounded-lg text-xs border flex items-center gap-2"
              style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.25)", color: "#fbbf24" }}>
              <span className="shrink-0">📋</span>
              {order.note}
            </div>
          )}

          {/* Items — 2-col when many items */}
          <div className={`grid gap-3 ${order.items.length >= 3 ? "grid-cols-2" : "grid-cols-1"}`}>
            {order.items.map(item => (
              <div key={item.id} className="border rounded-lg p-3"
                style={{
                  borderColor: doneItems.has(item.id) ? "rgba(255,255,255,0.04)" : (showStationColors ? `${STATION_META[item.station].color}33` : "rgba(255,255,255,0.08)"),
                  background: doneItems.has(item.id) ? "rgba(255,255,255,0.02)" : (showStationColors ? STATION_META[item.station].bg : "rgba(255,255,255,0.04)"),
                }}>
                <ItemRow
                  item={item}
                  done={doneItems.has(item.id)}
                  onToggle={() => onToggleItem(item.id)}
                  showAllergens={showAllergens}
                />
              </div>
            ))}
          </div>

          {allDone && (
            <div className="mt-3 text-center text-xs text-white/30">All items ready — bump to complete</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order, isFocused, doneItems, onToggleItem, onBump, onFocus,
  showAllergens, showStationColors, showModifierColors, showOrderType, showNotes,
}: {
  order: Order; isFocused: boolean; doneItems: Set<string>; onToggleItem: (id: string) => void;
  onBump: () => void; onFocus: () => void;
  showAllergens: boolean; showStationColors: boolean; showModifierColors: boolean;
  showOrderType: boolean; showNotes: boolean;
}) {
  const pColor = order.priority === "RUSH" ? "#ef4444" : order.priority === "VIP" ? "#f59e0b" : "transparent";
  const tColor = timerColor(order.elapsedSec, order.priority);
  const typeMeta = ORDER_TYPE_META[order.type];

  return (
    <div
      className="flex flex-col bg-[#111116] rounded-xl overflow-hidden border cursor-pointer transition-all"
      style={{
        borderColor: isFocused ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)",
        boxShadow: isFocused ? "0 0 0 1px rgba(255,255,255,0.08)" : "none",
      }}
      onClick={onFocus}
    >
      {/* Top stripe */}
      <div style={{ height: 2, background: pColor !== "transparent" ? pColor : "rgba(255,255,255,0.05)" }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-white/40 text-[10px] font-semibold tracking-wide">{order.customer}</span>
              {showOrderType && (
                <span className="text-[8px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider"
                  style={{ color: typeMeta.color, borderColor: `${typeMeta.color}44`, background: `${typeMeta.color}12` }}>
                  {typeMeta.label}
                </span>
              )}
              {order.priority !== "normal" && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                  style={{ background: `${pColor}22`, color: pColor }}>
                  {order.priority}
                </span>
              )}
            </div>
            <span className="font-bold text-white text-3xl leading-none tracking-tight">#{order.number}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: tColor }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-mono text-sm tabular-nums font-semibold" style={{ color: tColor }}>{fmtTime(order.elapsedSec)}</span>
          </div>
        </div>

        {/* Note */}
        {showNotes && order.note && (
          <div className="text-[10px] px-2 py-1.5 rounded border flex items-center gap-1.5"
            style={{ background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.2)", color: "#fbbf24" }}>
            <span>📋</span> {order.note}
          </div>
        )}

        {/* Items */}
        <div className="flex flex-col gap-3 flex-1">
          {order.items.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx > 0 && <div className="h-px bg-white/[0.05]" />}
              <ItemRow
                item={item}
                done={doneItems.has(item.id)}
                onToggle={() => { onToggleItem(item.id); }}
                showAllergens={showAllergens}
              />
            </React.Fragment>
          ))}
        </div>

        {/* Bump button */}
        <button
          onClick={e => { e.stopPropagation(); onBump(); }}
          className="mt-2 h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all active:scale-95"
          style={{
            background: pColor !== "transparent" ? `${pColor}15` : "rgba(255,255,255,0.04)",
            borderColor: pColor !== "transparent" ? `${pColor}40` : "rgba(255,255,255,0.1)",
            color: pColor !== "transparent" ? pColor : "rgba(255,255,255,0.4)",
          }}
        >
          Bump
        </button>
      </div>
    </div>
  );
}
