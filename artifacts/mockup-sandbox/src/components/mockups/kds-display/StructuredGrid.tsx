import React, { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Allergen  = "nuts" | "gluten" | "dairy" | "shellfish" | "eggs" | "soy" | "spicy";
type Station   = "grill" | "fryer" | "cold" | "dessert" | "other";
type Priority  = "normal" | "RUSH" | "VIP";
type OrderType = "dine-in" | "takeout" | "bar" | "delivery";
type KdsMode   = "multi" | "single" | "expo";
type Density   = "compact" | "normal" | "comfortable";
type FontSize  = "sm" | "md" | "lg";

type OrderItem = {
  id: string; qty: number; name: string; station: Station;
  modifiers?: string[]; allergens?: Allergen[];
};
type Order = {
  id: string; number: string; customer: string; type: OrderType;
  priority: Priority; elapsedSec: number; items: OrderItem[]; note?: string;
};

type Config = {
  mode: KdsMode;
  singleStation: Station;
  numCols: number;          // 1–4
  featuredSpan: number;     // 1–numCols
  density: Density;
  fontSize: FontSize;
  featuredFirst: boolean;
  // header fields
  showOrderNumber: boolean;
  showCustomerName: boolean;
  showOrderType: boolean;
  // card content
  showNotes: boolean;
  showAllergens: boolean;
  showStationColors: boolean;
  showModifierColors: boolean;
  showItemCompletion: boolean;
  showUrgencyBar: boolean;
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const STATION_META: Record<Station, { color: string; bg: string; label: string }> = {
  grill:   { color: "#ef4444", bg: "rgba(239,68,68,0.13)",   label: "Grill"   },
  fryer:   { color: "#f59e0b", bg: "rgba(245,158,11,0.13)",  label: "Fryer"   },
  cold:    { color: "#3b82f6", bg: "rgba(59,130,246,0.13)",  label: "Cold"    },
  dessert: { color: "#a855f7", bg: "rgba(168,85,247,0.13)",  label: "Dessert" },
  other:   { color: "#6b7280", bg: "rgba(107,114,128,0.13)", label: "Other"   },
};
const ALLERGEN_META: Record<Allergen, { label: string; color: string; bg: string }> = {
  nuts:      { label: "Nuts",     color: "#f97316", bg: "rgba(249,115,22,0.18)"  },
  gluten:    { label: "Gluten",   color: "#eab308", bg: "rgba(234,179,8,0.18)"   },
  dairy:     { label: "Dairy",    color: "#60a5fa", bg: "rgba(96,165,250,0.18)"  },
  shellfish: { label: "Shellfish",color: "#f43f5e", bg: "rgba(244,63,94,0.18)"   },
  eggs:      { label: "Eggs",     color: "#fbbf24", bg: "rgba(251,191,36,0.18)"  },
  soy:       { label: "Soy",      color: "#86efac", bg: "rgba(134,239,172,0.18)" },
  spicy:     { label: "🌶 Spicy", color: "#ef4444", bg: "rgba(239,68,68,0.18)"  },
};
const ORDER_TYPE_META: Record<OrderType, { label: string; color: string }> = {
  "dine-in":  { label: "Dine-in",  color: "#6b7280" },
  "takeout":  { label: "Takeout",  color: "#3b82f6" },
  "bar":      { label: "Bar",      color: "#a855f7" },
  "delivery": { label: "Delivery", color: "#f59e0b" },
};
const STATION_ORDER: Station[] = ["grill", "fryer", "cold", "dessert", "other"];

const DENSITY_PAD: Record<Density, string> = { compact: "p-2.5", normal: "p-4", comfortable: "p-5" };
const DENSITY_GAP: Record<Density, number> = { compact: 8, normal: 16, comfortable: 20 };
const FONT_SIZE: Record<FontSize, { num: number; meta: number; timer: number; featured: number }> = {
  sm: { num: 22, meta: 9,  timer: 12, featured: 32 },
  md: { num: 30, meta: 10, timer: 14, featured: 40 },
  lg: { num: 38, meta: 11, timer: 17, featured: 50 },
};

const WARN_SEC = 540; const ALERT_SEC = 900; const NEW_SEC = 60;

function urgencyRank(o: Order) {
  const p = o.priority === "RUSH" ? 0 : o.priority === "VIP" ? 1 : 2;
  return p * 100_000 - o.elapsedSec;
}
function fmtTime(sec: number) {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}
function timerColor(sec: number, p: Priority) {
  if (p === "RUSH") return "#ef4444";
  if (p === "VIP")  return "#f59e0b";
  if (sec >= ALERT_SEC) return "#ef4444";
  if (sec >= WARN_SEC)  return "#f59e0b";
  return "#ffffff";
}
function urgencyPct(sec: number, p: Priority) {
  if (p === "RUSH") return 1;
  if (p === "VIP")  return Math.min(sec / WARN_SEC, 1);
  return Math.min(sec / ALERT_SEC, 1);
}
function progressColor(pct: number, p: Priority) {
  if (p === "RUSH") return "#ef4444";
  if (p === "VIP")  return "#f59e0b";
  if (pct >= 1) return "#ef4444";
  if (pct >= 0.6) return "#f59e0b";
  return "#22c55e";
}
function modColor(mod: string) {
  const l = mod.toLowerCase();
  if (/^(no |without |remove |hold )/.test(l)) return { text: "#fca5a5", dot: "#ef4444" };
  if (/^(extra |add |with |double |more )/.test(l)) return { text: "#86efac", dot: "#22c55e" };
  return null;
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

const SEED: Order[] = [
  {
    id:"1", number:"101", customer:"Table 5",   type:"dine-in",  priority:"RUSH",   elapsedSec:932,
    note:"⚠ Nut allergy at table",
    items:[
      {id:"i1",qty:1,name:"Smash Burger",  station:"grill",  modifiers:["No onions","Extra cheese"], allergens:["nuts","gluten","dairy"]},
      {id:"i2",qty:1,name:"Truffle Fries", station:"fryer",  modifiers:["Light salt"],               allergens:["gluten"]},
    ],
  },
  {
    id:"2", number:"105", customer:"Table 7",   type:"dine-in",  priority:"normal",  elapsedSec:487,
    items:[
      {id:"i3",qty:1,name:"BBQ Ribs",      station:"grill",  modifiers:["Extra sauce"]},
      {id:"i4",qty:1,name:"Coleslaw",      station:"cold"},
      {id:"i5",qty:1,name:"Onion Rings",   station:"fryer"},
    ],
  },
  {
    id:"3", number:"108", customer:"Bar 3",     type:"bar",      priority:"normal",  elapsedSec:88,
    items:[
      {id:"i6",qty:2,name:"Caesar Salad",  station:"cold",   modifiers:["Dressing on side"],         allergens:["dairy","eggs"]},
      {id:"i7",qty:1,name:"Grilled Chicken",station:"grill", modifiers:["Add lemon","No skin"]},
    ],
  },
  {
    id:"4", number:"109", customer:"To Go #12", type:"takeout",  priority:"VIP",     elapsedSec:445,
    note:"VIP member — priority packaging",
    items:[
      {id:"i8",qty:1,name:"NY Strip",      station:"grill",  modifiers:["Medium rare","No sauce"],   allergens:["soy"]},
      {id:"i9",qty:1,name:"Crème Brûlée",  station:"dessert"},
    ],
  },
  {
    id:"5", number:"112", customer:"Table 2",   type:"dine-in",  priority:"normal",  elapsedSec:22,
    items:[
      {id:"i10",qty:2,name:"Fish & Chips", station:"fryer",  modifiers:["Extra tartar"]},
    ],
  },
];

// ─── Small helpers ────────────────────────────────────────────────────────────

function AllergenBadge({ a }: { a: Allergen }) {
  const m = ALLERGEN_META[a];
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}55` }}>
      ⚠ {m.label}
    </span>
  );
}

function ModLine({ mod, showColors }: { mod: string; showColors: boolean }) {
  const sem = showColors ? modColor(mod) : null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sem?.dot ?? "#6b7280" }} />
      <span className="text-xs leading-tight" style={{ color: sem?.text ?? "rgba(255,255,255,0.42)" }}>{mod}</span>
    </div>
  );
}

function UrgencyBar({ sec, priority }: { sec: number; priority: Priority }) {
  const pct = urgencyPct(sec, priority);
  return (
    <div className="h-0.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: progressColor(pct, priority) }} />
    </div>
  );
}

function BumpToast({ number, onDone }: { number: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2"
      style={{ background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.35)", color:"#86efac", boxShadow:"0 4px 24px rgba(0,0,0,0.4)", animation:"fadeSlideIn 0.2s ease" }}>
      ✓ Bumped #{number}
    </div>
  );
}

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <span className="font-mono text-xs text-white/30 tabular-nums">
      {t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

// ─── Item Row ─────────────────────────────────────────────────────────────────

function ItemRow({ item, done, onToggle, cfg }: {
  item: OrderItem; done: boolean; onToggle: () => void; cfg: Config;
}) {
  const sm = STATION_META[item.station];
  return (
    <div className="flex flex-col gap-1 cursor-pointer" onClick={onToggle}
      style={{ opacity: done ? 0.35 : 1, transition: "opacity 0.18s" }}>
      <div className="flex items-start gap-2">
        <div className="flex items-center justify-center text-[10px] font-black rounded shrink-0 mt-0.5 w-5 h-5"
          style={{ background: cfg.showStationColors ? sm.color : "#374151", color:"#000" }}
          title={sm.label}>
          {item.qty}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-semibold leading-tight"
              style={{ color: done ? "#6b7280" : "#f0f0f0", textDecoration: done ? "line-through" : "none", fontSize: FONT_SIZE[cfg.fontSize].meta + 4 }}>
              {item.name}
            </span>
            {cfg.showStationColors && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider opacity-75"
                style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
            )}
          </div>
          {item.modifiers && item.modifiers.length > 0 && (
            <div className="flex flex-col gap-0.5 mt-0.5">
              {item.modifiers.map((m, i) => <ModLine key={i} mod={m} showColors={cfg.showModifierColors} />)}
            </div>
          )}
          {cfg.showAllergens && item.allergens && item.allergens.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.allergens.map(a => <AllergenBadge key={a} a={a} />)}
            </div>
          )}
        </div>
        {cfg.showItemCompletion && (
          <div className="shrink-0 w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition-colors"
            style={{ borderColor: done ? sm.color : "rgba(255,255,255,0.15)", background: done ? sm.color : "transparent" }}>
            {done && <span className="text-black text-[9px] font-black">✓</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Expo Station Ring ────────────────────────────────────────────────────────

function ExpoStationBar({ order, doneItems }: { order: Order; doneItems: Set<string> }) {
  const byStation = STATION_ORDER.filter(s => order.items.some(it => it.station === s));
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {byStation.map(s => {
        const stationItems = order.items.filter(it => it.station === s);
        const doneCt = stationItems.filter(it => doneItems.has(it.id)).length;
        const allDone = doneCt === stationItems.length;
        const sm = STATION_META[s];
        return (
          <div key={s} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: allDone ? sm.color : "rgba(255,255,255,0.1)", border: `1px solid ${sm.color}66` }} />
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: allDone ? sm.color : "rgba(255,255,255,0.25)" }}>
              {sm.label}
            </span>
            <span className="text-[9px] text-white/20">{doneCt}/{stationItems.length}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, featured, doneItems, onToggleItem, onBump, onFocus, cfg }: {
  order: Order; featured: boolean; doneItems: Set<string>;
  onToggleItem: (id: string) => void; onBump: () => void; onFocus: () => void; cfg: Config;
}) {
  const hasPrio  = order.priority !== "normal";
  const pColor   = order.priority === "RUSH" ? "#ef4444" : order.priority === "VIP" ? "#f59e0b" : "rgba(255,255,255,0.06)";
  const tColor   = timerColor(order.elapsedSec, order.priority);
  const typeMeta = ORDER_TYPE_META[order.type];
  const doneCount = order.items.filter(it => doneItems.has(it.id)).length;
  const allDone   = doneCount === order.items.length;
  const isNew     = order.elapsedSec < NEW_SEC;
  const fs        = FONT_SIZE[cfg.fontSize];
  const actualSpan = featured ? Math.min(cfg.featuredSpan, cfg.numCols) : 1;
  const itemCols   = featured && actualSpan >= 2 && order.items.length >= 3 ? 2 : 1;

  // In single-station mode, filter items to show only selected station
  const visibleItems = cfg.mode === "single"
    ? order.items.filter(it => it.station === cfg.singleStation)
    : order.items;

  if (cfg.mode === "single" && visibleItems.length === 0) return null;

  return (
    <div className={`flex flex-col rounded-xl overflow-hidden border cursor-pointer transition-all ${DENSITY_PAD[cfg.density].replace("p-", "")}`}
      style={{
        gridColumn: `span ${actualSpan}`,
        background: "#111116",
        borderColor: featured ? (hasPrio ? `${pColor}66` : "rgba(255,255,255,0.18)") : (hasPrio ? `${pColor}33` : "rgba(255,255,255,0.06)"),
        boxShadow: featured && hasPrio ? `0 0 28px ${pColor}18` : "none",
      }}
      onClick={onFocus}>

      {/* Top stripe */}
      <div style={{ height: featured ? 3 : 2, background: hasPrio ? pColor : "rgba(255,255,255,0.05)" }} />

      <div className={DENSITY_PAD[cfg.density]} style={{ display:"flex", flexDirection:"column", gap: DENSITY_GAP[cfg.density], flex:1 }}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Meta row */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {cfg.showCustomerName && (
                <span className="text-white/45 font-semibold tracking-wide truncate"
                  style={{ fontSize: fs.meta }}>{order.customer}</span>
              )}
              {cfg.showOrderType && (
                <span className="px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wider shrink-0"
                  style={{ fontSize: 8, color: typeMeta.color, borderColor: `${typeMeta.color}44`, background: `${typeMeta.color}12` }}>
                  {typeMeta.label}
                </span>
              )}
              {hasPrio && (
                <span className="font-bold px-1.5 py-0.5 rounded uppercase shrink-0"
                  style={{ fontSize: 9, background: `${pColor}22`, color: pColor }}>{order.priority}</span>
              )}
              {isNew && (
                <span className="font-black px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0"
                  style={{ fontSize: 8, background:"rgba(34,197,94,0.15)", color:"#86efac", border:"1px solid rgba(34,197,94,0.3)", animation:"pulse 1.4s ease-in-out infinite" }}>
                  NEW
                </span>
              )}
            </div>

            {/* Order number */}
            {cfg.showOrderNumber && (
              <span className="font-black text-white leading-none tracking-tight"
                style={{ fontSize: featured ? fs.featured : fs.num }}>
                #{order.number}
              </span>
            )}
          </div>

          {/* Right: timer + item count + bump */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: tColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span className="font-mono tabular-nums font-bold" style={{ fontSize: fs.timer, color: tColor }}>
                {fmtTime(order.elapsedSec)}
              </span>
            </div>
            <span className="text-[9px] text-white/25 font-medium">{doneCount}/{order.items.length} items</span>
            <button
              onClick={e => { e.stopPropagation(); onBump(); }}
              className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-all active:scale-95"
              style={{
                background: hasPrio ? `${pColor}18` : "rgba(255,255,255,0.05)",
                borderColor: hasPrio ? `${pColor}44` : "rgba(255,255,255,0.1)",
                color: hasPrio ? pColor : "rgba(255,255,255,0.38)",
              }}>
              {cfg.mode === "expo" ? "Fire →" : "Bump ↵"}
            </button>
          </div>
        </div>

        {/* ── Note ── */}
        {cfg.showNotes && order.note && (
          <div className="text-[10px] px-2.5 py-1.5 rounded-lg border flex items-center gap-2 leading-snug"
            style={{ background:"rgba(245,158,11,0.07)", borderColor:"rgba(245,158,11,0.22)", color:"#fbbf24" }}>
            <span className="shrink-0">📋</span>{order.note}
          </div>
        )}

        {/* ── Items ── */}
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${itemCols},1fr)`, gap:"10px 16px", flex:1 }}>
          {visibleItems.map((item, idx) => (
            <div key={item.id}
              style={{ borderTop: idx > 0 && itemCols === 1 ? "1px solid rgba(255,255,255,0.05)" : "none", paddingTop: idx > 0 && itemCols === 1 ? 8 : 0 }}>
              <ItemRow item={item} done={doneItems.has(item.id)} onToggle={() => onToggleItem(item.id)} cfg={cfg} />
            </div>
          ))}
        </div>

        {/* ── Expo station completion bar ── */}
        {cfg.mode === "expo" && (
          <div className="border-t border-white/[0.06] pt-2">
            <ExpoStationBar order={order} doneItems={doneItems} />
          </div>
        )}

        {allDone && (
          <p className="text-center text-[10px] text-white/22 tracking-wide">All ready — {cfg.mode === "expo" ? "fire" : "bump"} to complete</p>
        )}

        {/* ── Urgency bar ── */}
        {cfg.showUrgencyBar && <UrgencyBar sec={order.elapsedSec} priority={order.priority} />}
      </div>
    </div>
  );
}

// ─── Settings Drawer ──────────────────────────────────────────────────────────

function SliderRow({ label, min, max, value, onChange, fmt }: {
  label: string; min: number; max: number; value: number;
  onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/60">{label}</span>
        <span className="text-xs font-mono font-semibold text-white/80">{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: "#f59e0b" }} />
    </div>
  );
}

function Toggle({ label, value, onChange, accent = "#f59e0b" }: {
  label: string; value: boolean; onChange: (v: boolean) => void; accent?: string;
}) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-center justify-between w-full py-1">
      <span className="text-xs text-white/60">{label}</span>
      <span className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all shrink-0"
        style={{ background: value ? accent : "rgba(255,255,255,0.1)" }}>
        <span className="w-3 h-3 rounded-full bg-white transition-all"
          style={{ transform: value ? "translateX(16px)" : "translateX(0)" }} />
      </span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 pb-1 border-b border-white/[0.06]">{title}</p>
      {children}
    </div>
  );
}

function SettingsDrawer({ cfg, setCfg, totalOrders, doneTotal, itemTotal }: {
  cfg: Config; setCfg: React.Dispatch<React.SetStateAction<Config>>;
  totalOrders: number; doneTotal: number; itemTotal: number;
}) {
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg(c => ({ ...c, [k]: v }));

  const MODE_OPTS: { id: KdsMode; label: string; desc: string }[] = [
    { id: "multi",  label: "Multi-Station", desc: "All items, filter by station" },
    { id: "single", label: "Single Station", desc: "One station's items only" },
    { id: "expo",   label: "Expo",          desc: "Full orders, fire control" },
  ];

  return (
    <div className="w-64 shrink-0 bg-[#0d0d12] border-l border-white/[0.07] flex flex-col overflow-y-auto">
      {/* Drawer header */}
      <div className="px-4 py-3 border-b border-white/[0.07]">
        <p className="text-xs font-bold text-white/70 tracking-wider uppercase">Display Settings</p>
        <p className="text-[10px] text-white/30 mt-0.5">Changes apply instantly to all cards</p>
      </div>

      {/* Live stats */}
      <div className="px-4 py-3 border-b border-white/[0.07] grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-black text-white leading-none">{totalOrders}</p>
          <p className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Orders</p>
        </div>
        <div>
          <p className="text-lg font-black leading-none" style={{ color: doneTotal === itemTotal ? "#22c55e" : "#f59e0b" }}>{doneTotal}</p>
          <p className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Done</p>
        </div>
        <div>
          <p className="text-lg font-black text-white/40 leading-none">{itemTotal}</p>
          <p className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Total</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-5 overflow-y-auto">

        {/* ── Mode ── */}
        <Section title="KDS Mode">
          <div className="flex flex-col gap-1.5">
            {MODE_OPTS.map(opt => (
              <button key={opt.id} onClick={() => set("mode", opt.id)}
                className="flex flex-col text-left px-3 py-2 rounded-lg border transition-all"
                style={{
                  background: cfg.mode === opt.id ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)",
                  borderColor: cfg.mode === opt.id ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.07)",
                }}>
                <span className="text-xs font-bold" style={{ color: cfg.mode === opt.id ? "#f59e0b" : "rgba(255,255,255,0.7)" }}>{opt.label}</span>
                <span className="text-[10px] text-white/30 mt-0.5">{opt.desc}</span>
              </button>
            ))}
          </div>
          {cfg.mode === "single" && (
            <div className="flex flex-col gap-1 mt-1">
              <p className="text-[10px] text-white/40 mb-1">Active station</p>
              <div className="grid grid-cols-2 gap-1">
                {STATION_ORDER.map(s => {
                  const sm = STATION_META[s];
                  const active = cfg.singleStation === s;
                  return (
                    <button key={s} onClick={() => set("singleStation", s)}
                      className="px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-all"
                      style={{
                        background: active ? `${sm.color}22` : "rgba(255,255,255,0.03)",
                        borderColor: active ? `${sm.color}66` : "rgba(255,255,255,0.07)",
                        color: active ? sm.color : "rgba(255,255,255,0.4)",
                      }}>
                      {sm.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        {/* ── Layout ── */}
        <Section title="Layout">
          <SliderRow label="Grid columns" min={1} max={4} value={cfg.numCols} onChange={v => { set("numCols", v); if (cfg.featuredSpan > v) set("featuredSpan", v); }} />
          <SliderRow label="Featured card span" min={1} max={cfg.numCols} value={Math.min(cfg.featuredSpan, cfg.numCols)} onChange={v => set("featuredSpan", v)} />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-white/60">Card density</span>
            <div className="flex gap-1">
              {(["compact","normal","comfortable"] as Density[]).map(d => (
                <button key={d} onClick={() => set("density", d)}
                  className="flex-1 py-1 rounded text-[10px] font-semibold capitalize border transition-all"
                  style={{
                    background: cfg.density === d ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                    borderColor: cfg.density === d ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.07)",
                    color: cfg.density === d ? "#f59e0b" : "rgba(255,255,255,0.4)",
                  }}>{d.slice(0,3)}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-white/60">Font size</span>
            <div className="flex gap-1">
              {([["sm","S"],["md","M"],["lg","L"]] as [FontSize,string][]).map(([id,lbl]) => (
                <button key={id} onClick={() => set("fontSize", id)}
                  className="flex-1 py-1 rounded text-xs font-bold border transition-all"
                  style={{
                    background: cfg.fontSize === id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                    borderColor: cfg.fontSize === id ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.07)",
                    color: cfg.fontSize === id ? "#f59e0b" : "rgba(255,255,255,0.4)",
                  }}>{lbl}</button>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Header fields ── */}
        <Section title="Header Fields">
          <Toggle label="Order number"  value={cfg.showOrderNumber}  onChange={v => set("showOrderNumber",  v)} />
          <Toggle label="Customer name" value={cfg.showCustomerName} onChange={v => set("showCustomerName", v)} />
          <Toggle label="Order type"    value={cfg.showOrderType}    onChange={v => set("showOrderType",    v)} />
          <Toggle label="Featured first (wider)" value={cfg.featuredFirst} onChange={v => set("featuredFirst", v)} />
        </Section>

        {/* ── Card content ── */}
        <Section title="Card Content">
          <Toggle label="Order notes"       value={cfg.showNotes}          onChange={v => set("showNotes",          v)} />
          <Toggle label="Allergen badges"   value={cfg.showAllergens}      onChange={v => set("showAllergens",      v)} />
          <Toggle label="Station colors"    value={cfg.showStationColors}  onChange={v => set("showStationColors",  v)} />
          <Toggle label="Modifier colors"   value={cfg.showModifierColors} onChange={v => set("showModifierColors", v)} />
          <Toggle label="Item checkboxes"   value={cfg.showItemCompletion} onChange={v => set("showItemCompletion", v)} />
          <Toggle label="Urgency progress"  value={cfg.showUrgencyBar}     onChange={v => set("showUrgencyBar",     v)} />
        </Section>

      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const STATION_TABS = ["All", "Grill", "Cold", "Fryer", "Dessert"];
const STATION_TAB_MAP: Record<string, Station | null> = { All: null, Grill:"grill", Cold:"cold", Fryer:"fryer", Dessert:"dessert" };
const STATION_TAB_COLOR: Record<string, string> = { All:"#fff", Grill:"#ef4444", Cold:"#3b82f6", Fryer:"#f59e0b", Dessert:"#a855f7" };

const DEFAULT_CFG: Config = {
  mode: "multi", singleStation: "grill",
  numCols: 3, featuredSpan: 2,
  density: "normal", fontSize: "md",
  featuredFirst: true,
  showOrderNumber: true, showCustomerName: true, showOrderType: true,
  showNotes: true, showAllergens: true, showStationColors: true,
  showModifierColors: true, showItemCompletion: true, showUrgencyBar: true,
};

export function StructuredGrid() {
  const [orders, setOrders]   = useState(() => [...SEED].sort((a, b) => urgencyRank(a) - urgencyRank(b)));
  const [activeTab, setTab]   = useState("All");
  const [focusedId, setFocus] = useState(orders[0]?.id ?? null);
  const [doneItems, setDone]  = useState<Set<string>>(new Set());
  const [cfg, setCfg]         = useState<Config>(DEFAULT_CFG);
  const [showSettings, setShowSettings] = useState(true);
  const [toast, setToast]     = useState<{ number: string } | null>(null);

  const bump = useCallback((id: string) => {
    const bumped = orders.find(o => o.id === id);
    setOrders(prev => { const next = prev.filter(o => o.id !== id); if (focusedId === id) setFocus(next[0]?.id ?? null); return next; });
    setDone(prev => { const next = new Set(prev); bumped?.items.forEach(it => next.delete(it.id)); return next; });
    if (bumped) setToast({ number: bumped.number });
  }, [orders, focusedId]);

  const toggleItem = (itemId: string) => setDone(prev => { const next = new Set(prev); next.has(itemId) ? next.delete(itemId) : next.add(itemId); return next; });

  // Filter by station tab (only for multi mode)
  const stationFilter = cfg.mode === "multi" ? STATION_TAB_MAP[activeTab] : null;
  const visibleOrders = stationFilter
    ? orders.filter(o => o.items.some(it => it.station === stationFilter))
    : orders;

  const focusedOrder = visibleOrders.find(o => o.id === focusedId) ?? visibleOrders[0] ?? null;
  const doneTotal    = orders.reduce((sum, o) => sum + o.items.filter(it => doneItems.has(it.id)).length, 0);
  const itemTotal    = orders.reduce((sum, o) => sum + o.items.length, 0);

  return (
    <div className="h-screen bg-[#0a0a0b] text-white flex flex-col select-none overflow-hidden"
      style={{ fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* ── Header ── */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-white/[0.07] shrink-0 bg-[#0d0d10]">
        {/* Station tabs — only in multi mode */}
        <div className="flex items-center gap-1">
          {cfg.mode === "multi" ? STATION_TABS.map(tab => {
            const active = activeTab === tab;
            const c = STATION_TAB_COLOR[tab];
            return (
              <button key={tab} onClick={() => setTab(tab)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                style={active ? { background:c, color:tab==="All"?"#000":"#fff" } : { background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.5)" }}>
                {!active && <span className="w-1.5 h-1.5 rounded-full" style={{ background:c }} />}
                {tab}
              </button>
            );
          }) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                {cfg.mode === "single" ? `${STATION_META[cfg.singleStation].label} Station` : "Expo View"}
              </span>
              {cfg.mode === "single" && (
                <span className="w-2 h-2 rounded-full" style={{ background: STATION_META[cfg.singleStation].color }} />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Clock />
          <span className="text-white/30 text-[11px]">
            <span className="text-white font-semibold">{visibleOrders.length}</span> orders ·{" "}
            <span style={{ color: doneTotal === itemTotal && itemTotal > 0 ? "#22c55e" : "rgba(255,255,255,0.5)" }}>{doneTotal}/{itemTotal}</span> items
          </span>
          <button onClick={() => setShowSettings(s => !s)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ background: showSettings ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", color: showSettings ? "#f59e0b" : "rgba(255,255,255,0.38)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Body (grid + settings drawer) ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Grid ── */}
        <main className="flex-1 overflow-y-auto p-4">
          {visibleOrders.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-3 text-white/10">✓</div>
                <p className="text-white/20 text-sm tracking-wide">All clear — kitchen idle</p>
              </div>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cfg.numCols}, minmax(0, 1fr))`,
              gap: DENSITY_GAP[cfg.density],
              alignItems: "start",
            }}>
              {visibleOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  featured={cfg.featuredFirst && order.id === focusedOrder?.id}
                  doneItems={doneItems}
                  onToggleItem={toggleItem}
                  onBump={() => bump(order.id)}
                  onFocus={() => setFocus(order.id)}
                  cfg={cfg}
                />
              ))}
            </div>
          )}
        </main>

        {/* ── Settings drawer ── */}
        {showSettings && (
          <SettingsDrawer cfg={cfg} setCfg={setCfg} totalOrders={visibleOrders.length} doneTotal={doneTotal} itemTotal={itemTotal} />
        )}
      </div>

      {/* ── Bump bar ── */}
      <footer className="h-9 border-t border-white/[0.07] bg-[#0d0d10] flex items-center px-4 shrink-0 gap-5">
        {[{keys:["SPACE"],label:cfg.mode==="expo"?"Fire":"Bump"},{keys:["R"],label:"Recall"},{keys:["↑","↓"],label:"Navigate"}].map(({keys,label})=>(
          <div key={label} className="flex items-center gap-1.5">
            <div className="flex gap-1">
              {keys.map(k=><kbd key={k} className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-white/[0.13] bg-white/[0.06] text-white/50">{k}</kbd>)}
            </div>
            <span className="text-[10px] text-white/28 uppercase tracking-wider">{label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3">
          {doneTotal > 0 && <span className="text-[10px] text-white/25">{doneTotal} item{doneTotal!==1?"s":""} marked done this session</span>}
        </div>
      </footer>

      {toast && <BumpToast number={toast.number} onDone={() => setToast(null)} />}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateX(-50%) translateY(6px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        input[type=range]::-webkit-slider-runnable-track { height:4px; border-radius:2px; background:rgba(255,255,255,0.1); }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:#f59e0b; margin-top:-5px; cursor:pointer; }
      `}</style>
    </div>
  );
}
