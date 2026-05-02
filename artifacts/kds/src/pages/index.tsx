import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient }          from "@tanstack/react-query";
import { useListOrders, useListStations, useBumpOrder, useListStores } from "@workspace/api-client-react";
import { useKdsWebSocket }                  from "@/hooks/use-kds-websocket";
import { useOrderChime, type ChimeType }    from "@/hooks/use-order-chime";
import { FlaskConical, Maximize2, Minimize2, Zap } from "lucide-react";
import { toast as sonnerToast }             from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Allergen  = "nuts" | "gluten" | "dairy" | "shellfish" | "eggs" | "soy" | "spicy";
type Station   = "grill" | "fryer" | "cold" | "dessert" | "other";
type Priority  = "normal" | "RUSH" | "VIP";
type OrderType = "dine-in" | "takeout" | "bar" | "delivery";
type KdsMode       = "multi" | "single" | "expo";
type Density       = "compact" | "normal" | "comfortable";
type FontSize      = "sm" | "md" | "lg";
type BumpBarPreset  = "keyboard" | "logic-controls" | "pos-x" | "mmf" | "custom";
type StationChime   = ChimeType | "none";
type ExpoSendMode   = "expo_bump" | "all_stations";

type DisplayItem = {
  id: string; qty: number; name: string;
  station: Station; stationId: string;
  modifiers?: string[]; allergens?: Allergen[];
};
type DisplayOrder = {
  id: string; number: string; customer: string;
  type: OrderType; priority: Priority; elapsedSec: number;
  items: DisplayItem[]; note?: string;
};

type KdsConfig = {
  mode: KdsMode; singleStation: Station;
  numCols: number; featuredFirst: boolean; featuredSpan: number | null;
  density: Density; fontSize: FontSize;
  showOrderNumber: boolean; showCustomerName: boolean; showOrderType: boolean;
  showNotes: boolean; showAllergens: boolean; showStationColors: boolean;
  showModifierColors: boolean; showItemCompletion: boolean; showUrgencyBar: boolean;
  soundEnabled: boolean; soundVolume: number; soundChime: ChimeType;
  stationChimes: Record<Station, StationChime>;
  escalationEnabled: boolean;
  escalationWarnChime: ChimeType;
  escalationAlertChime: ChimeType;
  showStats: boolean;
  showFooter: boolean;
  expoSendMode: ExpoSendMode;
  bumpBarEnabled: boolean; bumpBarPreset: BumpBarPreset;
  bumpKey: string; prevKey: string; nextKey: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATION_META: Record<Station, { color: string; bg: string; label: string }> = {
  grill:   { color: "#ef4444", bg: "rgba(239,68,68,0.13)",   label: "Grill"   },
  fryer:   { color: "#f59e0b", bg: "rgba(245,158,11,0.13)",  label: "Fryer"   },
  cold:    { color: "#3b82f6", bg: "rgba(59,130,246,0.13)",  label: "Cold"    },
  dessert: { color: "#a855f7", bg: "rgba(168,85,247,0.13)",  label: "Dessert" },
  other:   { color: "#6b7280", bg: "rgba(107,114,128,0.13)", label: "Other"   },
};
const ALLERGEN_META: Record<Allergen, { label: string; color: string; bg: string }> = {
  nuts:      { label: "Nuts",      color: "#f97316", bg: "rgba(249,115,22,0.18)"  },
  gluten:    { label: "Gluten",    color: "#eab308", bg: "rgba(234,179,8,0.18)"   },
  dairy:     { label: "Dairy",     color: "#60a5fa", bg: "rgba(96,165,250,0.18)"  },
  shellfish: { label: "Shellfish", color: "#f43f5e", bg: "rgba(244,63,94,0.18)"   },
  eggs:      { label: "Eggs",      color: "#fbbf24", bg: "rgba(251,191,36,0.18)"  },
  soy:       { label: "Soy",       color: "#86efac", bg: "rgba(134,239,172,0.18)" },
  spicy:     { label: "🌶 Spicy", color: "#ef4444", bg: "rgba(239,68,68,0.18)"  },
};
const ORDER_TYPE_META: Record<OrderType, { label: string; color: string }> = {
  "dine-in":  { label: "Dine-in",  color: "#6b7280" },
  "takeout":  { label: "Takeout",  color: "#3b82f6" },
  "bar":      { label: "Bar",      color: "#a855f7" },
  "delivery": { label: "Delivery", color: "#f59e0b" },
};
const STATION_ORDER: Station[] = ["grill", "fryer", "cold", "dessert", "other"];
const DENSITY_PAD: Record<Density, string>  = { compact: "p-2.5", normal: "p-4", comfortable: "p-5" };
const DENSITY_GAP: Record<Density, number>  = { compact: 8, normal: 16, comfortable: 20 };
const FONT_SZ: Record<FontSize, { num: number; meta: number; timer: number; featured: number }> = {
  sm: { num: 24, meta: 9,  timer: 12, featured: 34 },
  md: { num: 30, meta: 10, timer: 14, featured: 42 },
  lg: { num: 38, meta: 11, timer: 17, featured: 52 },
};
const WARN_SEC  = 540;
const ALERT_SEC = 900;
const NEW_SEC   = 60;

const DEFAULT_CFG: KdsConfig = {
  mode: "multi", singleStation: "grill",
  numCols: 3, featuredFirst: true, featuredSpan: null,
  density: "normal", fontSize: "md",
  showOrderNumber: true, showCustomerName: true, showOrderType: true,
  showNotes: true, showAllergens: true, showStationColors: true,
  showModifierColors: true, showItemCompletion: true, showUrgencyBar: true,
  soundEnabled: true, soundVolume: 0.7, soundChime: "ding",
  stationChimes: { grill: "ding", fryer: "blip", cold: "bell", dessert: "bell", other: "ding" },
  escalationEnabled: true,
  escalationWarnChime: "chime" as ChimeType,
  escalationAlertChime: "chime" as ChimeType,
  showStats: false,
  showFooter: true,
  expoSendMode: "expo_bump" as ExpoSendMode,
  bumpBarEnabled: false, bumpBarPreset: "keyboard",
  bumpKey: " ", prevKey: "ArrowLeft", nextKey: "ArrowRight",
};

// ─── Bump bar presets ─────────────────────────────────────────────────────────

const BUMP_BAR_KEY_MAP: Record<Exclude<BumpBarPreset,"custom">, { bump: string; prev: string; next: string }> = {
  "keyboard":       { bump: " ",  prev: "ArrowLeft", next: "ArrowRight" },
  "logic-controls": { bump: "F1", prev: "F11",       next: "F12"        },
  "pos-x":          { bump: "1",  prev: "-",         next: "+"          },
  "mmf":            { bump: "F1", prev: "F7",        next: "F8"         },
};
const BUMP_BAR_PRESETS: Record<BumpBarPreset, { label: string; desc: string }> = {
  "keyboard":       { label: "Keyboard (default)",    desc: "Space = bump  ·  ← → = navigate"         },
  "logic-controls": { label: "Logic Controls BB2002", desc: "F1–F10 = bump  ·  F11 / F12 = navigate"  },
  "pos-x":          { label: "POS-X BumpBar",         desc: "1–8 = bump  ·  − / + = navigate"         },
  "mmf":            { label: "MMF Val-u Line",         desc: "F1–F6 = bump  ·  F7 / F8 = navigate"    },
  "custom":         { label: "Custom",                 desc: "Record your own key bindings below"      },
};

// ─── Data helpers ─────────────────────────────────────────────────────────────

function stationNameToSlug(name: string): Station {
  const l = name.toLowerCase();
  if (l.includes("grill") || l.includes("hot") || l.includes("broil") || l.includes("bbq")) return "grill";
  if (l.includes("fry") || l.includes("deep")) return "fryer";
  if (l.includes("cold") || l.includes("salad") || l.includes("prep") || l.includes("chill")) return "cold";
  if (l.includes("dessert") || l.includes("pastry") || l.includes("sweet") || l.includes("bake")) return "dessert";
  return "other";
}

function normalizePriority(p: string): Priority {
  if (p === "rush") return "RUSH";
  if (p === "vip")  return "VIP";
  return "normal";
}

function adaptOrders(
  apiOrders: any[],
  stationSlugMap: Map<string, Station>,
): DisplayOrder[] {
  return apiOrders.map(o => ({
    id:         o.id,
    number:     o.orderNumber,
    customer:   o.tableRef ?? o.customerName ?? "Table",
    type:       "dine-in" as OrderType,
    priority:   normalizePriority(o.priority),
    elapsedSec: o.elapsedSeconds ?? 0,
    items:      (o.items ?? []).map((it: any) => ({
      id:        it.id,
      qty:       it.quantity ?? 1,
      name:      it.name,
      station:   stationSlugMap.get(it.stationId) ?? "other",
      stationId: it.stationId,
      modifiers: it.modifiers ?? [],
      allergens: [] as Allergen[],
    })),
    note: o.notes || undefined,
  }));
}

// ─── Visual helpers ───────────────────────────────────────────────────────────

function urgencyRank(o: DisplayOrder) {
  const p = o.priority === "RUSH" ? 0 : o.priority === "VIP" ? 1 : 2;
  return p * 100_000 - o.elapsedSec;
}
function fmtTime(sec: number) {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}
function timerColor(sec: number, p: Priority) {
  if (p === "RUSH") return "#ef4444";
  if (p === "VIP")  return "#f59e0b";
  return sec >= ALERT_SEC ? "#ef4444" : sec >= WARN_SEC ? "#f59e0b" : "#ffffff";
}
function urgencyPct(sec: number, p: Priority) {
  if (p === "RUSH") return 1;
  if (p === "VIP")  return Math.min(sec / WARN_SEC, 1);
  return Math.min(sec / ALERT_SEC, 1);
}
function progressColor(pct: number, p: Priority) {
  if (p === "RUSH") return "#ef4444";
  if (p === "VIP")  return "#f59e0b";
  return pct >= 1 ? "#ef4444" : pct >= 0.6 ? "#f59e0b" : "#22c55e";
}
function modColor(mod: string) {
  const l = mod.toLowerCase();
  if (/^(no |without |remove |hold )/.test(l)) return { text: "#fca5a5", dot: "#ef4444" };
  if (/^(extra |add |with |double |more )/.test(l)) return { text: "#86efac", dot: "#22c55e" };
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2"
      style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#86efac", boxShadow: "0 4px 24px rgba(0,0,0,0.4)", animation: "fadeSlideIn 0.2s ease" }}>
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

function ExpoStationBar({ order, doneItems }: { order: DisplayOrder; doneItems: Set<string> }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {STATION_ORDER.filter(s => order.items.some(it => it.station === s)).map(s => {
        const stItems = order.items.filter(it => it.station === s);
        const done = stItems.filter(it => doneItems.has(it.id)).length;
        const sm = STATION_META[s];
        return (
          <div key={s} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full"
              style={{ background: done === stItems.length ? sm.color : "rgba(255,255,255,0.1)", border: `1px solid ${sm.color}66` }} />
            <span className="text-[9px] font-semibold uppercase"
              style={{ color: done === stItems.length ? sm.color : "rgba(255,255,255,0.25)" }}>{sm.label}</span>
            <span className="text-[9px] text-white/20">{done}/{stItems.length}</span>
          </div>
        );
      })}
    </div>
  );
}

function ItemRow({ item, done, onToggle, cfg }: {
  item: DisplayItem; done: boolean; onToggle: () => void; cfg: KdsConfig;
}) {
  const sm = STATION_META[item.station];
  const fs = FONT_SZ[cfg.fontSize];
  return (
    <div className="flex flex-col gap-1 cursor-pointer" onClick={onToggle}
      style={{ opacity: done ? 0.35 : 1, transition: "opacity 0.18s" }}>
      <div className="flex items-start gap-2">
        <div className="flex items-center justify-center text-[10px] font-black rounded shrink-0 mt-0.5 w-5 h-5"
          style={{ background: cfg.showStationColors ? sm.color : "#374151", color: "#000" }}>
          {item.qty}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-semibold leading-tight"
              style={{ color: done ? "#6b7280" : "#f0f0f0", textDecoration: done ? "line-through" : "none", fontSize: fs.meta + 4 }}>
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

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, featured, doneItems, onToggleItem, onBump, onFocus, cfg }: {
  order: DisplayOrder; featured: boolean; doneItems: Set<string>;
  onToggleItem: (id: string) => void; onBump: () => void; onFocus: () => void; cfg: KdsConfig;
}) {
  const [elapsed, setElapsed] = useState(order.elapsedSec);
  useEffect(() => {
    setElapsed(order.elapsedSec);
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [order.id, order.elapsedSec]);

  const hasPrio  = order.priority !== "normal";
  const pColor   = order.priority === "RUSH" ? "#ef4444" : order.priority === "VIP" ? "#f59e0b" : "rgba(255,255,255,0.06)";
  const tColor   = timerColor(elapsed, order.priority);
  const typeMeta = ORDER_TYPE_META[order.type];
  const doneCount = order.items.filter(it => doneItems.has(it.id)).length;
  const allDone   = doneCount === order.items.length;
  const isNew          = elapsed < NEW_SEC;
  const escalationLevel = cfg.escalationEnabled
    ? (elapsed >= ALERT_SEC ? 2 : elapsed >= WARN_SEC ? 1 : 0)
    : 0;
  const fs        = FONT_SZ[cfg.fontSize];
  const effectiveSpan = cfg.featuredFirst && featured
    ? (cfg.featuredSpan ?? Math.max(cfg.numCols - 1, 1))
    : 1;
  const itemCols  = featured && effectiveSpan >= 2 && order.items.length >= 3 ? 2 : 1;

  const visibleItems = cfg.mode === "single"
    ? order.items.filter(it => it.station === cfg.singleStation)
    : order.items;

  if (cfg.mode === "single" && visibleItems.length === 0) return null;

  const borderC = escalationLevel === 2
    ? "rgba(239,68,68,0.7)"
    : escalationLevel === 1
      ? "rgba(245,158,11,0.55)"
      : featured
        ? (hasPrio ? `${pColor}66` : "rgba(255,255,255,0.18)")
        : (hasPrio ? `${pColor}33` : "rgba(255,255,255,0.06)");
  const shadowC = escalationLevel === 2
    ? "0 0 22px rgba(239,68,68,0.28)"
    : escalationLevel === 1
      ? "0 0 16px rgba(245,158,11,0.2)"
      : (featured && hasPrio ? `0 0 28px ${pColor}18` : "none");
  const escalAnim = escalationLevel === 2
    ? "alertFlash 0.7s ease-in-out infinite"
    : escalationLevel === 1
      ? "warnPulse 2.5s ease-in-out infinite"
      : "none";

  return (
    <div className="flex flex-col rounded-xl overflow-hidden border cursor-pointer"
      style={{
        gridColumn: `span ${effectiveSpan}`,
        background: "#111116",
        borderColor: borderC,
        boxShadow: shadowC,
        animation: escalAnim,
        transition: "border-color 0.3s",
      }}
      onClick={onFocus}>
      {/* Priority accent bar */}
      <div style={{ height: featured ? 3 : 2, background: hasPrio ? pColor : "rgba(255,255,255,0.05)" }} />

      <div className={DENSITY_PAD[cfg.density]}
        style={{ display: "flex", flexDirection: "column", gap: DENSITY_GAP[cfg.density], flex: 1 }}>

        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {cfg.showCustomerName && (
                <span className="text-white/45 font-semibold tracking-wide truncate" style={{ fontSize: fs.meta }}>
                  {order.customer}
                </span>
              )}
              {cfg.showOrderType && (
                <span className="px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wider shrink-0"
                  style={{ fontSize: 8, color: typeMeta.color, borderColor: `${typeMeta.color}44`, background: `${typeMeta.color}12` }}>
                  {typeMeta.label}
                </span>
              )}
              {hasPrio && (
                <span className="font-bold px-1.5 py-0.5 rounded uppercase shrink-0"
                  style={{ fontSize: 9, background: `${pColor}22`, color: pColor }}>
                  {order.priority}
                </span>
              )}
              {isNew && (
                <span className="font-black px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0"
                  style={{ fontSize: 8, background: "rgba(34,197,94,0.15)", color: "#86efac", border: "1px solid rgba(34,197,94,0.3)", animation: "pulse 1.4s ease-in-out infinite" }}>
                  NEW
                </span>
              )}
            </div>
            {cfg.showOrderNumber && (
              <span className="font-black text-white leading-none tracking-tight"
                style={{ fontSize: featured ? fs.featured : fs.num }}>
                #{order.number}
              </span>
            )}
          </div>

          {/* Timer + bump */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: tColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-mono tabular-nums font-bold" style={{ fontSize: fs.timer, color: tColor }}>{fmtTime(elapsed)}</span>
            </div>
            <span className="text-[9px] text-white/25 font-medium">{doneCount}/{order.items.length}</span>
            <button onClick={e => { e.stopPropagation(); onBump(); }}
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

        {/* Order note */}
        {cfg.showNotes && order.note && (
          <div className="text-[10px] px-2.5 py-1.5 rounded-lg border flex items-center gap-2 leading-snug"
            style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.22)", color: "#fbbf24" }}>
            <span className="shrink-0">📋</span>{order.note}
          </div>
        )}

        {/* Item list */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${itemCols},1fr)`, gap: "10px 16px", flex: 1 }}>
          {visibleItems.map((item, idx) => (
            <div key={item.id}
              style={{ borderTop: idx > 0 && itemCols === 1 ? "1px solid rgba(255,255,255,0.05)" : "none", paddingTop: idx > 0 && itemCols === 1 ? 8 : 0 }}>
              <ItemRow item={item} done={doneItems.has(item.id)} onToggle={() => onToggleItem(item.id)} cfg={cfg} />
            </div>
          ))}
        </div>

        {/* Expo station readiness */}
        {cfg.mode === "expo" && (
          <div className="border-t border-white/[0.06] pt-2">
            <ExpoStationBar order={order} doneItems={doneItems} />
          </div>
        )}

        {allDone && (
          <p className="text-center text-[10px] text-white/22 tracking-wide">
            All ready — {cfg.mode === "expo" ? "fire" : "bump"} to complete
          </p>
        )}
        {cfg.showUrgencyBar && <UrgencyBar sec={elapsed} priority={order.priority} />}
      </div>
    </div>
  );
}

// ─── Key Recorder ─────────────────────────────────────────────────────────────

function KeyRecorder({ label, value, onRecord }: {
  label: string; value: string; onRecord: (k: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    if (!recording) return;
    function onKey(e: KeyboardEvent) {
      e.preventDefault(); e.stopPropagation();
      onRecord(e.key); setRecording(false);
    }
    window.addEventListener("keydown", onKey, { once: true, capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [recording, onRecord]);
  const display = value === " " ? "SPACE" : value.length > 3 ? value : value.toUpperCase();
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/40">{label}</span>
      <button onClick={() => setRecording(true)}
        className="h-6 px-2.5 rounded text-[10px] font-mono font-bold border transition-all min-w-[56px] text-center"
        style={{ background: recording ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.06)", borderColor: recording ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.1)", color: recording ? "#f59e0b" : "rgba(255,255,255,0.6)" }}>
        {recording ? "press…" : display}
      </button>
    </div>
  );
}

// ─── Quick Settings Panel ─────────────────────────────────────────────────────

function QuickSettingsPanel({ cfg, setCfg, storeId, onClearSuccess, onClose }: {
  cfg: KdsConfig;
  setCfg: React.Dispatch<React.SetStateAction<KdsConfig>>;
  storeId: string;
  onClearSuccess: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing]         = useState(false);

  const set = <K extends keyof KdsConfig>(k: K, v: KdsConfig[K]) => setCfg(c => ({ ...c, [k]: v }));

  async function clearAllOrders() {
    setClearing(true);
    try {
      const res  = await fetch(`/api/orders/clear-all?storeId=${storeId}`, { method: "POST" });
      const json = await res.json() as { ok: boolean; cleared: number };
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        onClearSuccess();
        onClose();
        sonnerToast.success(`${json.cleared} order${json.cleared !== 1 ? "s" : ""} cleared`, { duration: 2500 });
      } else {
        sonnerToast.error("Failed to clear orders");
      }
    } catch { sonnerToast.error("Network error"); }
    finally { setClearing(false); setConfirmClear(false); }
  }
  return (
    <div className="absolute bottom-11 right-16 z-40 rounded-2xl overflow-hidden shadow-2xl border border-white/[0.12]"
      style={{ background: "#13131a", width: 232 }}>
      <div className="px-3 py-2.5 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap style={{ width: 11, height: 11, color: "#f59e0b" }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">Quick Settings</span>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 text-base leading-none">×</button>
      </div>
      <div className="p-3 flex flex-col gap-3">
        <div>
          <span className="text-[9px] text-white/30 uppercase tracking-wider block mb-1">Mode</span>
          <div className="grid grid-cols-3 gap-1">
            {(["multi", "single", "expo"] as KdsMode[]).map(id => (
              <button key={id} onClick={() => set("mode", id)}
                className="py-1 rounded text-[9px] font-bold border capitalize transition-all"
                style={{ background: cfg.mode === id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)", borderColor: cfg.mode === id ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.07)", color: cfg.mode === id ? "#f59e0b" : "rgba(255,255,255,0.4)" }}>
                {id}
              </button>
            ))}
          </div>
        </div>
        {cfg.mode === "expo" && (
          <div>
            <span className="text-[9px] text-white/30 uppercase tracking-wider block mb-1">Fire order when</span>
            <div className="grid grid-cols-2 gap-1">
              {([
                ["expo_bump", "Expo fires"],
                ["all_stations", "All stations done"],
              ] as [ExpoSendMode, string][]).map(([id, label]) => (
                <button key={id} onClick={() => set("expoSendMode", id)}
                  className="py-1.5 px-2 rounded-lg text-[8px] font-bold border text-center leading-tight transition-all"
                  style={{ background: cfg.expoSendMode === id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)", borderColor: cfg.expoSendMode === id ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.07)", color: cfg.expoSendMode === id ? "#f59e0b" : "rgba(255,255,255,0.4)" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/30 uppercase tracking-wider">Columns</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(n => (
              <button key={n} onClick={() => set("numCols", n)}
                className="w-6 h-6 rounded text-[10px] font-bold border transition-all"
                style={{ background: cfg.numCols === n ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", borderColor: cfg.numCols === n ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)", color: cfg.numCols === n ? "#f59e0b" : "rgba(255,255,255,0.45)" }}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/30 uppercase tracking-wider">Sound</span>
          <button onClick={() => set("soundEnabled", !cfg.soundEnabled)}
            className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
            style={{ background: cfg.soundEnabled ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
            <span className="w-3 h-3 rounded-full bg-white transition-all"
              style={{ transform: cfg.soundEnabled ? "translateX(16px)" : "translateX(0)" }} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/30 uppercase tracking-wider">Age Escalation</span>
          <button onClick={() => set("escalationEnabled", !cfg.escalationEnabled)}
            className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
            style={{ background: cfg.escalationEnabled ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
            <span className="w-3 h-3 rounded-full bg-white transition-all"
              style={{ transform: cfg.escalationEnabled ? "translateX(16px)" : "translateX(0)" }} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/30 uppercase tracking-wider">Stats Strip</span>
          <button onClick={() => set("showStats", !cfg.showStats)}
            className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
            style={{ background: cfg.showStats ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
            <span className="w-3 h-3 rounded-full bg-white transition-all"
              style={{ transform: cfg.showStats ? "translateX(16px)" : "translateX(0)" }} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/30 uppercase tracking-wider">Footer Bar</span>
          <button onClick={() => set("showFooter", !cfg.showFooter)}
            className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
            style={{ background: cfg.showFooter ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
            <span className="w-3 h-3 rounded-full bg-white transition-all"
              style={{ transform: cfg.showFooter ? "translateX(16px)" : "translateX(0)" }} />
          </button>
        </div>

        {/* Clear All — danger zone */}
        <div className="pt-1 border-t border-white/[0.06]">
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="w-full py-1.5 rounded-lg text-[9px] font-bold border transition-all"
              style={{ background: "rgba(239,68,68,0.07)", borderColor: "rgba(239,68,68,0.22)", color: "rgba(239,68,68,0.65)" }}>
              Clear All Active Orders
            </button>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] text-white/35 text-center">
                Remove all in-progress orders?
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setConfirmClear(false)}
                  className="flex-1 py-1.5 rounded-lg text-[9px] font-bold border border-white/[0.08] transition-all"
                  style={{ color: "rgba(255,255,255,0.35)" }}>
                  Cancel
                </button>
                <button
                  onClick={clearAllOrders}
                  disabled={clearing}
                  className="flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all"
                  style={{ background: "rgba(239,68,68,0.2)", color: clearing ? "rgba(248,113,113,0.4)" : "#f87171" }}>
                  {clearing ? "Clearing…" : "Yes, Clear All"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Settings Overlay ─────────────────────────────────────────────────────────

function SettingsOverlay({ cfg, setCfg, onClose, playChime }: {
  cfg: KdsConfig;
  setCfg: React.Dispatch<React.SetStateAction<KdsConfig>>;
  onClose: () => void;
  playChime: (type: ChimeType, vol: number) => void;
}) {
  const set = <K extends keyof KdsConfig>(k: K, v: KdsConfig[K]) => setCfg(c => ({ ...c, [k]: v }));
  type ToggleItem = { label: string; key: keyof KdsConfig };
  const toggles: ToggleItem[] = [
    { label: "Order number",     key: "showOrderNumber"   },
    { label: "Customer name",    key: "showCustomerName"  },
    { label: "Order type badge", key: "showOrderType"     },
    { label: "Notes",            key: "showNotes"         },
    { label: "Allergens",        key: "showAllergens"     },
    { label: "Station colors",   key: "showStationColors" },
    { label: "Modifier colors",  key: "showModifierColors"},
    { label: "Item checkboxes",  key: "showItemCompletion"},
    { label: "Urgency bar",      key: "showUrgencyBar"    },
  ];

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-end p-4 pointer-events-none">
      <div className="w-72 rounded-2xl overflow-hidden pointer-events-auto shadow-2xl border border-white/[0.1]"
        style={{ background: "#13131a" }}>
        <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
          <p className="text-xs font-bold text-white/70 tracking-wider uppercase">Display Options</p>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-lg leading-none">×</button>
        </div>
        <div className="px-4 py-3 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">

          {/* Mode */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">KDS Mode</p>
            <div className="grid grid-cols-3 gap-1">
              {(["multi", "single", "expo"] as KdsMode[]).map(id => (
                <button key={id} onClick={() => set("mode", id)}
                  className="py-1.5 rounded-lg text-[10px] font-bold border transition-all capitalize"
                  style={{ background: cfg.mode === id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)", borderColor: cfg.mode === id ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.07)", color: cfg.mode === id ? "#f59e0b" : "rgba(255,255,255,0.4)" }}>
                  {id}
                </button>
              ))}
            </div>
            {cfg.mode === "single" && (
              <div className="grid grid-cols-3 gap-1 mt-1">
                {(["grill", "cold", "fryer", "dessert", "other"] as Station[]).map(s => {
                  const sm = STATION_META[s]; const active = cfg.singleStation === s;
                  return (
                    <button key={s} onClick={() => set("singleStation", s)}
                      className="py-1 rounded text-[9px] font-bold border transition-all"
                      style={{ background: active ? `${sm.color}22` : "rgba(255,255,255,0.03)", borderColor: active ? `${sm.color}55` : "rgba(255,255,255,0.07)", color: active ? sm.color : "rgba(255,255,255,0.35)" }}>
                      {sm.label}
                    </button>
                  );
                })}
              </div>
            )}
            {cfg.mode === "expo" && (
              <div className="mt-1">
                <span className="text-[9px] text-white/30 block mb-1 pl-0.5">Fire order when</span>
                <div className="grid grid-cols-2 gap-1">
                  {([
                    ["expo_bump",     "Expo fires manually"],
                    ["all_stations",  "All stations done"],
                  ] as [ExpoSendMode, string][]).map(([id, label]) => (
                    <button key={id} onClick={() => set("expoSendMode", id)}
                      className="py-1.5 px-2 rounded-lg text-[8px] font-bold border text-center leading-tight transition-all"
                      style={{ background: cfg.expoSendMode === id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)", borderColor: cfg.expoSendMode === id ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.07)", color: cfg.expoSendMode === id ? "#f59e0b" : "rgba(255,255,255,0.4)" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Layout */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Layout</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">Grid columns</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(n => (
                  <button key={n} onClick={() => set("numCols", n)}
                    className="w-7 h-7 rounded text-xs font-bold border transition-all"
                    style={{ background: cfg.numCols === n ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", borderColor: cfg.numCols === n ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)", color: cfg.numCols === n ? "#f59e0b" : "rgba(255,255,255,0.45)" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">Featured first (wider)</span>
              <button onClick={() => set("featuredFirst", !cfg.featuredFirst)}
                className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
                style={{ background: cfg.featuredFirst ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
                <span className="w-3 h-3 rounded-full bg-white transition-all"
                  style={{ transform: cfg.featuredFirst ? "translateX(16px)" : "translateX(0)" }} />
              </button>
            </div>
            {cfg.featuredFirst && (
              <div className="flex items-center justify-between pl-3 border-l border-white/[0.07]">
                <span className="text-xs text-white/40">Featured span</span>
                <div className="flex gap-1">
                  <button onClick={() => set("featuredSpan", null)}
                    className="h-6 px-2 rounded text-[10px] font-bold border transition-all"
                    style={{ background: cfg.featuredSpan === null ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", borderColor: cfg.featuredSpan === null ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)", color: cfg.featuredSpan === null ? "#f59e0b" : "rgba(255,255,255,0.35)" }}>
                    Auto
                  </button>
                  {[1, 2, 3, 4].filter(n => n <= cfg.numCols).map(n => (
                    <button key={n} onClick={() => set("featuredSpan", n)}
                      className="w-6 h-6 rounded text-[10px] font-bold border transition-all"
                      style={{ background: cfg.featuredSpan === n ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", borderColor: cfg.featuredSpan === n ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)", color: cfg.featuredSpan === n ? "#f59e0b" : "rgba(255,255,255,0.35)" }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">Density</span>
              <div className="flex gap-1">
                {(["compact", "normal", "comfortable"] as Density[]).map(d => (
                  <button key={d} onClick={() => set("density", d)}
                    className="h-6 px-2 rounded text-[9px] font-bold border capitalize transition-all"
                    style={{ background: cfg.density === d ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", borderColor: cfg.density === d ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)", color: cfg.density === d ? "#f59e0b" : "rgba(255,255,255,0.35)" }}>
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">Font size</span>
              <div className="flex gap-1">
                {(["sm", "md", "lg"] as FontSize[]).map(id => (
                  <button key={id} onClick={() => set("fontSize", id)}
                    className="w-7 h-6 rounded text-xs font-bold border transition-all uppercase"
                    style={{ background: cfg.fontSize === id ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", borderColor: cfg.fontSize === id ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)", color: cfg.fontSize === id ? "#f59e0b" : "rgba(255,255,255,0.35)" }}>
                    {id}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content toggles */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-1">Card Content</p>
            {toggles.map(({ label, key }) => (
              <button key={key} onClick={() => set(key, !cfg[key] as KdsConfig[typeof key])}
                className="flex items-center justify-between w-full py-0.5">
                <span className="text-xs text-white/55">{label}</span>
                <span className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all shrink-0"
                  style={{ background: cfg[key] ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
                  <span className="w-3 h-3 rounded-full bg-white transition-all"
                    style={{ transform: cfg[key] ? "translateX(16px)" : "translateX(0)" }} />
                </span>
              </button>
            ))}
          </div>

          {/* Sound alerts */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Sound Alerts</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">Age escalation alerts</span>
              <button onClick={() => set("escalationEnabled", !cfg.escalationEnabled)}
                className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
                style={{ background: cfg.escalationEnabled ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
                <span className="w-3 h-3 rounded-full bg-white transition-all"
                  style={{ transform: cfg.escalationEnabled ? "translateX(16px)" : "translateX(0)" }} />
              </button>
            </div>
            {cfg.escalationEnabled && (
              <div className="flex flex-col gap-2 pl-3 border-l border-white/[0.07]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">9 min chime</span>
                  <div className="flex gap-0.5">
                    {(["chime", "ding", "bell", "blip"] as ChimeType[]).map(t => {
                      const active = cfg.escalationWarnChime === t;
                      return (
                        <button key={t}
                          onClick={() => { set("escalationWarnChime", t); playChime(t, cfg.soundVolume); }}
                          className="h-5 px-1.5 rounded text-[8px] font-bold border capitalize transition-all"
                          style={{ background: active ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)", borderColor: active ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.07)", color: active ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">15 min chime</span>
                  <div className="flex gap-0.5">
                    {(["chime", "ding", "bell", "blip"] as ChimeType[]).map(t => {
                      const active = cfg.escalationAlertChime === t;
                      return (
                        <button key={t}
                          onClick={() => { set("escalationAlertChime", t); playChime(t, cfg.soundVolume); }}
                          className="h-5 px-1.5 rounded text-[8px] font-bold border capitalize transition-all"
                          style={{ background: active ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)", borderColor: active ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.07)", color: active ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <span className="text-[9px] text-white/20 leading-relaxed">Border flash shows throughout · "chime" = soft soothing bell</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">Alert on new order</span>
              <button onClick={() => set("soundEnabled", !cfg.soundEnabled)}
                className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
                style={{ background: cfg.soundEnabled ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
                <span className="w-3 h-3 rounded-full bg-white transition-all"
                  style={{ transform: cfg.soundEnabled ? "translateX(16px)" : "translateX(0)" }} />
              </button>
            </div>
            {cfg.soundEnabled && (<>
              <div className="flex items-center gap-2 pl-3 border-l border-white/[0.07]">
                <span className="text-[10px] text-white/40 shrink-0">Volume</span>
                <input type="range" min={0} max={1} step={0.05}
                  value={cfg.soundVolume}
                  onChange={e => set("soundVolume", parseFloat(e.target.value))}
                  onMouseUp={() => playChime(cfg.soundChime, cfg.soundVolume)}
                  className="flex-1 h-1 cursor-pointer accent-amber-500" />
                <span className="text-[10px] text-white/30 w-7 text-right">{Math.round(cfg.soundVolume * 100)}%</span>
              </div>
              <div className="flex flex-col gap-1 pl-3 border-l border-white/[0.07]">
                <span className="text-[10px] text-white/30 mb-0.5">Per-station chimes</span>
                {(Object.entries(STATION_META) as [Station, typeof STATION_META[Station]][]).map(([station, meta]) => (
                  <div key={station} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                      <span className="text-[10px] text-white/45 truncate">{meta.label}</span>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      {(["ding", "bell", "blip", "none"] as (ChimeType | "none")[]).map(t => {
                        const active = cfg.stationChimes[station] === t;
                        return (
                          <button key={t}
                            onClick={() => {
                              setCfg(c => ({ ...c, stationChimes: { ...c.stationChimes, [station]: t } }));
                              if (t !== "none") playChime(t as ChimeType, cfg.soundVolume);
                            }}
                            className="h-5 px-1.5 rounded text-[8px] font-bold border capitalize transition-all"
                            style={{ background: active ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)", borderColor: active ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.07)", color: active ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>
                            {t === "none" ? "off" : t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>)}
          </div>

          {/* Bump bar */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Bump Bar</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">Physical bump bar</span>
              <button onClick={() => set("bumpBarEnabled", !cfg.bumpBarEnabled)}
                className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
                style={{ background: cfg.bumpBarEnabled ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
                <span className="w-3 h-3 rounded-full bg-white transition-all"
                  style={{ transform: cfg.bumpBarEnabled ? "translateX(16px)" : "translateX(0)" }} />
              </button>
            </div>
            {cfg.bumpBarEnabled && (<>
              <div className="flex flex-col gap-1 pl-3 border-l border-white/[0.07]">
                <span className="text-[10px] text-white/30 mb-0.5">Device preset</span>
                {(Object.entries(BUMP_BAR_PRESETS) as [BumpBarPreset, { label: string; desc: string }][]).map(([id, preset]) => (
                  <button key={id}
                    onClick={() => {
                      if (id !== "custom") {
                        const keys = BUMP_BAR_KEY_MAP[id as Exclude<BumpBarPreset,"custom">];
                        setCfg(c => ({ ...c, bumpBarPreset: id, bumpKey: keys.bump, prevKey: keys.prev, nextKey: keys.next }));
                      } else {
                        set("bumpBarPreset", "custom");
                      }
                    }}
                    className="flex flex-col items-start px-2.5 py-1.5 rounded-lg border text-left transition-all"
                    style={{ background: cfg.bumpBarPreset === id ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)", borderColor: cfg.bumpBarPreset === id ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.07)" }}>
                    <span className="text-[10px] font-bold" style={{ color: cfg.bumpBarPreset === id ? "#f59e0b" : "rgba(255,255,255,0.5)" }}>{preset.label}</span>
                    <span className="text-[9px] text-white/25 mt-0.5">{preset.desc}</span>
                  </button>
                ))}
              </div>
              {cfg.bumpBarPreset === "custom" && (
                <div className="flex flex-col gap-1.5 pl-3 border-l border-white/[0.07] mt-0.5">
                  <KeyRecorder label="Bump key"  value={cfg.bumpKey}  onRecord={k => set("bumpKey",  k)} />
                  <KeyRecorder label="Prev order" value={cfg.prevKey} onRecord={k => set("prevKey", k)} />
                  <KeyRecorder label="Next order" value={cfg.nextKey} onRecord={k => set("nextKey", k)} />
                </div>
              )}
              <div className="px-2.5 py-2 rounded-lg border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p className="text-[9px] text-white/25 leading-relaxed">USB HID bump bars connect as keyboards — plug in and pick your model. For gamepad-protocol bars, button A = bump, L/R = navigate.</p>
              </div>
            </>)}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Main KDS Page ────────────────────────────────────────────────────────────

export default function KdsDisplay() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState<string>("");
  const [cfg, setCfg]         = useState<KdsConfig>(() => {
    try {
      const saved = localStorage.getItem("kds_cfg");
      if (saved) return { ...DEFAULT_CFG, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_CFG;
  });
  const [activeTab, setTab]   = useState<string>("All");  // "All" | DB station ID
  const [focusedId, setFocus] = useState<string | null>(null);
  const [doneItems, setDone]  = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [bumpToast, setBumpToast]   = useState<{ number: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [injecting, setInjecting]   = useState(false);
  const [nowServingOrders, setNowServing] = useState<{ order: DisplayOrder; firedAt: number }[]>([]);
  const [showQuickSettings, setShowQuickSettings] = useState(false);

  const { playChime } = useOrderChime();
  const cfgRef           = useRef(cfg);
  cfgRef.current         = cfg;
  const prevOrderIdsRef    = useRef<Set<string>>(new Set());
  const isInitialLoadRef   = useRef(true);
  const escalatedOrdersRef = useRef<Map<string, number>>(new Map());
  const autoBumpedRef      = useRef<Set<string>>(new Set());

  // ── Feature flags ─────────────────────────────────────────────────────────
  const { data: kdsConfig } = useQuery<{ testOrdersEnabled: boolean }>({
    queryKey: ["/api/config"],
    queryFn: () => fetch("/api/config").then(r => r.json()),
    staleTime: 60_000,
  });
  const testOrdersEnabled = kdsConfig?.testOrdersEnabled !== false;

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: stores }   = useListStores();
  const { data: dbStations } = useListStations({ storeId }, { query: { enabled: !!storeId } });
  const { data: rawOrders } = useListOrders(
    { storeId, status: "in_progress" },
    { query: { enabled: !!storeId, refetchInterval: 10000 } }
  );
  const bumpOrderMutation = useBumpOrder();

  useEffect(() => {
    if (stores && stores.length > 0 && !storeId) setStoreId(stores[0].id);
  }, [stores, storeId]);

  // Persist config to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem("kds_cfg", JSON.stringify(cfg)); } catch {}
  }, [cfg]);

  // onNewOrder is handled by the allOrders effect below (has station info)
  useKdsWebSocket(storeId, queryClient);

  // Build a stationId → Station slug map from DB stations
  const stationSlugMap = new Map<string, Station>(
    (dbStations ?? []).map(s => [s.id, stationNameToSlug(s.name)])
  );

  // Adapt + sort real orders
  const allOrders: DisplayOrder[] = adaptOrders(rawOrders ?? [], stationSlugMap)
    .sort((a, b) => urgencyRank(a) - urgencyRank(b));

  // Visible orders (based on mode + active tab)
  const visibleOrders = (() => {
    if (cfg.mode === "single") {
      return allOrders.filter(o => o.items.some(it => it.station === cfg.singleStation));
    }
    if (activeTab === "All") return allOrders;
    // activeTab is a DB station ID
    return allOrders.filter(o => o.items.some(it => it.stationId === activeTab));
  })();

  const focusedOrder = visibleOrders.find(o => o.id === focusedId) ?? visibleOrders[0] ?? null;
  const doneTotal  = allOrders.reduce((s, o) => s + o.items.filter(it => doneItems.has(it.id)).length, 0);
  const itemTotal  = allOrders.reduce((s, o) => s + o.items.length, 0);

  // ── Bump ──────────────────────────────────────────────────────────────────
  const bump = useCallback((orderId: string) => {
    const bumped = allOrders.find(o => o.id === orderId);
    if (!bumped) return;

    bumpOrderMutation.mutate(
      { id: orderId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          setFocus(prev => prev === orderId ? (visibleOrders.find(o => o.id !== orderId)?.id ?? null) : prev);
          setDone(prev => { const next = new Set(prev); bumped.items.forEach(it => next.delete(it.id)); return next; });
          setBumpToast({ number: bumped.number });
          setNowServing(prev => {
            const without = prev.filter(ns => ns.order.id !== bumped.id);
            return [...without, { order: bumped, firedAt: Date.now() }].slice(-8);
          });
        },
      }
    );
  }, [allOrders, bumpOrderMutation, queryClient, visibleOrders]);

  const toggleItem = (itemId: string) => setDone(prev => {
    const next = new Set(prev); next.has(itemId) ? next.delete(itemId) : next.add(itemId); return next;
  });

  // ── Recall a bumped order (from Now Serving strip) ─────────────────────────
  async function recallOrder(orderId: string) {
    const entry = nowServingOrders.find(ns => ns.order.id === orderId);
    if (!entry) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/recall`, { method: "POST" });
      if (res.ok) {
        setNowServing(prev => prev.filter(ns => ns.order.id !== orderId));
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        sonnerToast.success(`Order #${entry.order.number} recalled`, { duration: 2000 });
      } else {
        sonnerToast.error("Could not recall order");
      }
    } catch { sonnerToast.error("Network error"); }
  }

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const enterFullscreen = useCallback(() => { document.documentElement.requestFullscreen?.().catch(() => {}); }, []);
  const exitFullscreen  = useCallback(() => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); }, 500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // ── Keyboard (+ physical bump bar via HID keyboard mode) ─────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F4") { exitFullscreen(); return; }
      if (e.key === "Escape") { setShowSettings(false); setShowQuickSettings(false); return; }
      // Don't intercept when typing in an actual input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (visibleOrders.length === 0) return;
      // Digit keys 1–9: jump directly to nth order
      if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = visibleOrders[parseInt(e.key) - 1];
        if (target) { setFocus(target.id); e.preventDefault(); }
        return;
      }
      const idx = visibleOrders.findIndex(o => o.id === focusedId);
      const nextKey = cfg.nextKey;
      const prevKey = cfg.prevKey;
      const bumpKey = cfg.bumpKey;
      if (e.key === nextKey || e.key === "ArrowRight" || e.key === "ArrowDown") {
        setFocus(visibleOrders[Math.min(idx + 1, visibleOrders.length - 1)]?.id ?? null);
      } else if (e.key === prevKey || e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setFocus(visibleOrders[Math.max(idx - 1, 0)]?.id ?? null);
      } else if ((e.key === bumpKey || e.key === "Enter") && focusedOrder) {
        e.preventDefault(); bump(focusedOrder.id);
      } else if (e.key === "r" || e.key === "R") {
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visibleOrders, focusedId, focusedOrder, bump, exitFullscreen, queryClient, cfg.bumpKey, cfg.prevKey, cfg.nextKey]);

  // ── Gamepad / bump bar (HID game-controller mode) ─────────────────────────
  useEffect(() => {
    if (!cfg.bumpBarEnabled) return;
    let rafId: number;
    const prevButtons = new Map<number, boolean[]>();
    function poll() {
      for (const pad of navigator.getGamepads()) {
        if (!pad) continue;
        const prev = prevButtons.get(pad.index) ?? new Array(pad.buttons.length).fill(false);
        pad.buttons.forEach((btn, i) => {
          if (btn.pressed && !prev[i]) {
            if (i === 0 && focusedOrder) bump(focusedOrder.id);
            else if ((i === 14 || i === 4) && visibleOrders.length) {
              const idx = visibleOrders.findIndex(o => o.id === focusedId);
              setFocus(visibleOrders[Math.max(idx - 1, 0)]?.id ?? null);
            } else if ((i === 15 || i === 5) && visibleOrders.length) {
              const idx = visibleOrders.findIndex(o => o.id === focusedId);
              setFocus(visibleOrders[Math.min(idx + 1, visibleOrders.length - 1)]?.id ?? null);
            }
          }
          prev[i] = btn.pressed;
        });
        prevButtons.set(pad.index, [...prev]);
      }
      rafId = requestAnimationFrame(poll);
    }
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [cfg.bumpBarEnabled, focusedOrder, focusedId, visibleOrders, bump]);

  // ── Per-station chimes + age escalation ───────────────────────────────────
  useEffect(() => {
    const currentIds = new Set(allOrders.map(o => o.id));

    if (isInitialLoadRef.current) {
      prevOrderIdsRef.current = currentIds;
      if (allOrders.length > 0) isInitialLoadRef.current = false;
      return;
    }

    // New order chimes
    const newOrders = allOrders.filter(o => !prevOrderIdsRef.current.has(o.id));
    prevOrderIdsRef.current = currentIds;

    if (newOrders.length > 0 && cfgRef.current.soundEnabled) {
      const stations = new Set(newOrders.flatMap(o => o.items.map(it => it.station)));
      const chimesPlayed = new Set<string>();
      const toPlay: ChimeType[] = [];
      for (const station of STATION_ORDER) {
        if (!stations.has(station as Station)) continue;
        const chime = cfgRef.current.stationChimes[station as Station];
        if (chime === "none") continue;
        if (!chimesPlayed.has(chime)) { toPlay.push(chime); chimesPlayed.add(chime); }
      }
      if (toPlay.length === 0) toPlay.push(cfgRef.current.soundChime);
      toPlay.forEach((chime, i) => setTimeout(() => playChime(chime, cfgRef.current.soundVolume), i * 350));
    }

    // Age escalation — fires when order crosses WARN_SEC (9 min) or ALERT_SEC (15 min)
    if (cfgRef.current.escalationEnabled) {
      for (const order of allOrders) {
        const prevLevel = escalatedOrdersRef.current.get(order.id) ?? 0;
        const newLevel  = order.elapsedSec >= ALERT_SEC ? 2 : order.elapsedSec >= WARN_SEC ? 1 : 0;
        if (newLevel > prevLevel) {
          escalatedOrdersRef.current.set(order.id, newLevel);
          if (cfgRef.current.soundEnabled) {
            if (newLevel === 2) {
              [0, 350].forEach(d => setTimeout(() => playChime(cfgRef.current.escalationAlertChime, cfgRef.current.soundVolume), d));
            } else {
              playChime(cfgRef.current.escalationWarnChime, cfgRef.current.soundVolume);
            }
          }
        }
      }
    }

    // Clean up escalation tracking for completed orders
    for (const id of escalatedOrdersRef.current.keys()) {
      if (!currentIds.has(id)) escalatedOrdersRef.current.delete(id);
    }
  }, [allOrders, playChime]);

  // ── Auto-bump when all stations done (expo all_stations mode) ─────────────
  useEffect(() => {
    if (cfgRef.current.expoSendMode !== "all_stations" || cfgRef.current.mode !== "expo") return;
    for (const order of allOrders) {
      if (autoBumpedRef.current.has(order.id)) continue;
      if (order.items.length > 0 && order.items.every(it => doneItems.has(it.id))) {
        autoBumpedRef.current.add(order.id);
        bump(order.id);
      }
    }
  }, [doneItems, allOrders, bump]);

  // ── Now Serving auto-expire ────────────────────────────────────────────────
  useEffect(() => {
    if (nowServingOrders.length === 0) return;
    const t = setInterval(() => setNowServing(prev => prev.filter(ns => Date.now() - ns.firedAt < 45_000)), 2000);
    return () => clearInterval(t);
  }, [nowServingOrders.length]);

  // ── Test order injection ──────────────────────────────────────────────────
  async function injectTestOrder() {
    if (!storeId || injecting) return;
    setInjecting(true);
    try {
      let url = `/api/test/inject-order?storeId=${storeId}`;
      if (cfg.mode === "expo" || activeTab === "All") {
        url += "&multiStation=true";
      } else {
        const st = (dbStations ?? []).find(s => s.id === activeTab);
        if (st) url += `&station=${stationNameToSlug(st.name)}`;
      }
      const res  = await fetch(url, { method: "POST" });
      const json = await res.json() as { ok: boolean; order?: { orderNumber: string } };
      if (res.ok && json.ok) {
        sonnerToast.success(`Test order #${json.order?.orderNumber} fired!`, { duration: 2500 });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      } else {
        sonnerToast.error("Test order injection failed");
      }
    } catch { sonnerToast.error("Network error"); }
    finally  { setInjecting(false); }
  }

  // ── Station tabs ──────────────────────────────────────────────────────────
  // Build tab list from DB stations, with slug-based colors
  const stationTabs = [
    { id: "All", label: "All", color: "#ffffff" },
    ...(dbStations ?? []).map(s => ({
      id:    s.id,
      label: s.name,
      color: STATION_META[stationNameToSlug(s.name)].color,
    })),
  ];

  // ── Order age stats ───────────────────────────────────────────────────────
  const warnCount  = allOrders.filter(o => o.elapsedSec >= WARN_SEC && o.elapsedSec < ALERT_SEC).length;
  const alertCount = allOrders.filter(o => o.elapsedSec >= ALERT_SEC).length;
  const statsMin   = allOrders.length ? Math.min(...allOrders.map(o => o.elapsedSec)) : 0;
  const statsMax   = allOrders.length ? Math.max(...allOrders.map(o => o.elapsedSec)) : 0;
  const statsAvg   = allOrders.length ? Math.round(allOrders.reduce((a, o) => a + o.elapsedSec, 0) / allOrders.length) : 0;
  function fmtSec(s: number) { const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; }

  return (
    <div className="h-[100dvh] bg-[#0a0a0b] text-white flex flex-col select-none overflow-hidden relative"
      style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-white/[0.07] shrink-0 bg-[#0d0d10]">
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
          {cfg.mode === "multi" ? (
            stationTabs.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setTab(tab.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap shrink-0"
                  style={active
                    ? { background: tab.color, color: tab.id === "All" ? "#000" : "#fff" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                  {!active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: tab.color }} />}
                  {tab.label}
                </button>
              );
            })
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                {cfg.mode === "single"
                  ? `${STATION_META[cfg.singleStation].label} Station`
                  : "Expo View"}
              </span>
              {cfg.mode === "single" && (
                <span className="w-2 h-2 rounded-full" style={{ background: STATION_META[cfg.singleStation].color }} />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          <Clock />
          <span className="text-white/30 text-[11px]">
            <span className="text-white font-semibold">{visibleOrders.length}</span> orders ·{" "}
            <span style={{ color: doneTotal === itemTotal && itemTotal > 0 ? "#22c55e" : "rgba(255,255,255,0.45)" }}>
              {doneTotal}/{itemTotal}
            </span> items
          </span>

          {/* Test inject */}
          {testOrdersEnabled && (
            <button onClick={injectTestOrder} disabled={injecting || !storeId}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border border-white/[0.1] transition-all disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.38)" }}
              title="Inject a random test order">
              <FlaskConical style={{ width: 12, height: 12 }} />
              {injecting ? "…" : "Test"}
            </button>
          )}

          {/* Fullscreen toggle */}
          <button onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.38)" }}
            title={isFullscreen ? "Exit fullscreen (F4)" : "Enter fullscreen"}>
            {isFullscreen
              ? <Minimize2 style={{ width: 13, height: 13 }} />
              : <Maximize2 style={{ width: 13, height: 13 }} />}
          </button>

          {/* Settings gear */}
          <button onClick={() => setShowSettings(s => !s)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ background: showSettings ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", color: showSettings ? "#f59e0b" : "rgba(255,255,255,0.38)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Order grid ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4">
        {visibleOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center flex flex-col items-center gap-3">
              <div className="text-4xl mb-1 text-white/10">✓</div>
              <p className="text-white/20 text-sm">All clear — kitchen idle</p>
              {testOrdersEnabled && (
                <button onClick={injectTestOrder} disabled={injecting || !storeId}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.1] text-xs font-semibold text-white/40 hover:text-white/60 hover:border-white/[0.2] transition-all mt-1 disabled:opacity-40"
                  style={{ background: "rgba(255,255,255,0.03)" }}>
                  <FlaskConical style={{ width: 13, height: 13 }} />
                  {injecting ? "Injecting…" : "Inject a test order"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cfg.numCols},minmax(0,1fr))`,
            gap: DENSITY_GAP[cfg.density],
            alignItems: "start",
          }}>
            {visibleOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                featured={
                  cfg.mode === "expo"
                    ? order.id === focusedOrder?.id
                    : cfg.featuredFirst && order.id === focusedOrder?.id
                }
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

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      {cfg.showStats && allOrders.length > 0 && (
        <div className="mx-4 mb-2 px-3 py-1.5 rounded-xl border flex items-center gap-3 shrink-0 flex-wrap"
          style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
          <span className="text-[9px] text-white/25 uppercase tracking-widest shrink-0">Stats</span>
          <div className="flex gap-4 flex-wrap">
            <span className="text-[10px]">
              <span className="text-white/28">Min </span>
              <span className="font-mono text-white/55">{fmtSec(statsMin)}</span>
            </span>
            <span className="text-[10px]">
              <span className="text-white/28">Avg </span>
              <span className="font-mono text-white/55">{fmtSec(statsAvg)}</span>
            </span>
            <span className="text-[10px]">
              <span className="text-white/28">Max </span>
              <span className="font-mono font-bold"
                style={{ color: statsMax >= ALERT_SEC ? "#f87171" : statsMax >= WARN_SEC ? "#f59e0b" : "rgba(255,255,255,0.55)" }}>
                {fmtSec(statsMax)}
              </span>
            </span>
          </div>
          {(warnCount > 0 || alertCount > 0) && (
            <div className="flex items-center gap-3 ml-1">
              {warnCount > 0 && (
                <span className="flex items-center gap-1 text-[10px]" style={{ color: "#f59e0b" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  {warnCount} late
                </span>
              )}
              {alertCount > 0 && (
                <span className="flex items-center gap-1 text-[10px]" style={{ color: "#f87171" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  {alertCount} critical
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Now Serving strip (all modes) ────────────────────────────────── */}
      {nowServingOrders.length > 0 && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl border flex items-center gap-3 shrink-0"
          style={{ borderColor: "rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.05)" }}>
          <span className="text-[10px] font-black uppercase tracking-widest shrink-0"
            style={{ color: "#4ade80", animation: "pulse 1.5s ease-in-out infinite" }}>
            NOW SERVING
          </span>
          <div className="flex gap-2 flex-wrap">
            {nowServingOrders.map(ns => (
              <div key={ns.order.id} className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac" }}>
                #{ns.order.number}
                <span className="text-white/25 font-normal text-[10px] ml-1">{ns.order.customer}</span>
                <button
                  onClick={() => recallOrder(ns.order.id)}
                  className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full transition-all hover:bg-white/10"
                  style={{ color: "rgba(134,239,172,0.6)", fontSize: 10 }}
                  title="Recall order — bring it back to the display">
                  ↩
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer bump bar ──────────────────────────────────────────────── */}
      {cfg.showFooter && (
        <footer className="h-9 border-t border-white/[0.07] bg-[#0d0d10] flex items-center px-4 shrink-0 gap-5">
          {(() => {
            const bk = cfg.bumpKey === " " ? "SPACE" : cfg.bumpKey.length > 3 ? cfg.bumpKey : cfg.bumpKey.toUpperCase();
            const pk = cfg.prevKey === "ArrowLeft"  ? "←" : cfg.prevKey;
            const nk = cfg.nextKey === "ArrowRight" ? "→" : cfg.nextKey;
            return [
              { keys: [bk],     label: cfg.mode === "expo" ? "Fire" : "Bump" },
              { keys: ["R"],    label: "Refresh" },
              { keys: [pk, nk], label: "Navigate" },
            ];
          })().map(({ keys, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="flex gap-1">
                {keys.map(k => (
                  <kbd key={k} className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-white/[0.13] bg-white/[0.06] text-white/50">{k}</kbd>
                ))}
              </div>
              <span className="text-[10px] text-white/28 uppercase tracking-wider">{label}</span>
            </div>
          ))}
          {doneTotal > 0 && (
            <span className="text-[10px] text-white/22">{doneTotal} item{doneTotal !== 1 ? "s" : ""} done this session</span>
          )}
          {/* Kitchen health indicator */}
          {allOrders.length > 0 && (
            <div className="flex items-center gap-2">
              {alertCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: "#f87171", animation: "pulse 1s ease-in-out infinite" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  {alertCount} crit
                </span>
              )}
              {warnCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: "#f59e0b" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  {warnCount} late
                </span>
              )}
              {alertCount === 0 && warnCount === 0 && (
                <span className="text-[10px] font-medium" style={{ color: "rgba(74,222,128,0.55)" }}>✓ On time</span>
              )}
            </div>
          )}
          <div className="flex-1" />
          {isFullscreen && (
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-white/[0.13] bg-white/[0.06] text-white/50">F4</kbd>
              <span className="text-[10px] text-white/28 uppercase tracking-wider">Exit Kiosk</span>
            </div>
          )}
        </footer>
      )}

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      {showSettings      && <SettingsOverlay cfg={cfg} setCfg={setCfg} onClose={() => setShowSettings(false)} playChime={playChime} />}
      {showQuickSettings && <QuickSettingsPanel cfg={cfg} setCfg={setCfg} storeId={storeId} onClearSuccess={() => setNowServing([])} onClose={() => setShowQuickSettings(false)} />}
      {bumpToast         && <BumpToast number={bumpToast.number} onDone={() => setBumpToast(null)} />}

      {/* ── Quick Settings FAB ────────────────────────────────────────────── */}
      <button
        onClick={() => { setShowQuickSettings(s => !s); setShowSettings(false); }}
        className="absolute z-30 w-8 h-8 rounded-full flex items-center justify-center border shadow-lg transition-all"
        style={{
          bottom: cfg.showFooter ? 44 : 16,
          right: 64,
          background: showQuickSettings ? "rgba(245,158,11,0.18)" : "rgba(13,13,16,0.92)",
          borderColor: showQuickSettings ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.12)",
          color: showQuickSettings ? "#f59e0b" : "rgba(255,255,255,0.38)",
        }}
        title="Quick Settings">
        <Zap style={{ width: 12, height: 12 }} />
      </button>

      <style>{`
        @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateX(-50%) translateY(6px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes warnPulse   { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0)} 50%{box-shadow:0 0 22px 6px rgba(245,158,11,0.32)} }
        @keyframes alertFlash  { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} 50%{box-shadow:0 0 28px 8px rgba(239,68,68,0.45)} }
      `}</style>
    </div>
  );
}
