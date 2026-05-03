import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { useQuery, useQueryClient }          from "@tanstack/react-query";
import { useListOrders, useListStations, useBumpOrder, useListStores } from "@workspace/api-client-react";
import { useKdsWebSocket, stripMachineLocal, getKdsDeviceId } from "@/hooks/use-kds-websocket";
import { useOrderChime, type ChimeType }    from "@/hooks/use-order-chime";
import { FlaskConical, Maximize2, Minimize2, Zap } from "lucide-react";
import { toast as sonnerToast }             from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModColorEntry = { text: string; dot: string };
type ModifierColors = { remove: ModColorEntry; extra: ModColorEntry; normal: ModColorEntry };

const DEFAULT_MOD_COLORS: ModifierColors = {
  remove: { text: "#fca5a5", dot: "#ef4444" },
  extra:  { text: "#86efac", dot: "#22c55e" },
  normal: { text: "rgba(255,255,255,0.88)", dot: "#9ca3af" },
};

const ModColorCtx = createContext<ModifierColors>(DEFAULT_MOD_COLORS);

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
type KdsTheme = "ink" | "blue" | "slate";

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
  showAgeHeatmap: boolean;
  showFooter: boolean;
  showNowServing: boolean;
  showRecentBumped: boolean;
  nowServingExpirySec: number;
  expoSendMode: ExpoSendMode;
  bumpBarEnabled: boolean; bumpBarPreset: BumpBarPreset;
  bumpKey: string; prevKey: string; nextKey: string; recallKey: string;
  zoomOverride: number | null;
  showVirtualBumpBar: boolean;
  theme: KdsTheme;
  stationWarnSec: Record<Station, number>;
  stationAlertSec: Record<Station, number>;
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
const THEME_META: Record<KdsTheme, { label: string; bg: string; card: string; line: string; text: string; subtle: string }> = {
  ink:   { label: "Ink",   bg: "#0a0a0b", card: "#111116", line: "rgba(255,255,255,0.07)", text: "rgba(255,255,255,0.76)", subtle: "rgba(255,255,255,0.55)" },
  blue:  { label: "Blue",  bg: "#08111e", card: "#0f1b2e", line: "rgba(96,165,250,0.18)", text: "rgba(219,234,254,0.88)", subtle: "rgba(191,219,254,0.68)" },
  slate: { label: "Slate", bg: "#101114", card: "#171922", line: "rgba(148,163,184,0.16)", text: "rgba(241,245,249,0.8)", subtle: "rgba(226,232,240,0.62)" },
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
  stationChimes: { grill: "ding", fryer: "blip", cold: "beep", dessert: "beep", other: "ding" },
  escalationEnabled: true,
  escalationWarnChime: "chime" as ChimeType,
  escalationAlertChime: "chime" as ChimeType,
  showStats: false,
  showAgeHeatmap: false,
  showFooter: true,
  showNowServing: true,
  showRecentBumped: true,
  nowServingExpirySec: 45,
  expoSendMode: "expo_bump" as ExpoSendMode,
  bumpBarEnabled: false, bumpBarPreset: "keyboard",
  bumpKey: " ", prevKey: "ArrowLeft", nextKey: "ArrowRight", recallKey: "Backspace",
  zoomOverride: null,
  showVirtualBumpBar: true,
  theme: "ink",
  stationWarnSec:  { grill: 540, fryer: 240, cold: 360, dessert: 480, other: 540 },
  stationAlertSec: { grill: 900, fryer: 420, cold: 600, dessert: 780, other: 900 },
};

// ─── Bump bar presets ─────────────────────────────────────────────────────────

const BUMP_BAR_KEY_MAP: Record<Exclude<BumpBarPreset,"custom">, { bump: string; prev: string; next: string; recall: string }> = {
  "keyboard":       { bump: " ",  prev: "ArrowLeft", next: "ArrowRight", recall: "Backspace" },
  "logic-controls": { bump: "F1", prev: "F11",       next: "F12",        recall: "F9"        },
  "pos-x":          { bump: "1",  prev: "-",         next: "+",          recall: "0"         },
  "mmf":            { bump: "F1", prev: "F7",        next: "F8",         recall: "F9"        },
};
const BUMP_BAR_PRESETS: Record<BumpBarPreset, { label: string; desc: string }> = {
  "keyboard":       { label: "Keyboard (default)",    desc: "Space = bump  ·  ← → = nav  ·  Backspace = recall" },
  "logic-controls": { label: "Logic Controls BB2002", desc: "F1 = bump  ·  F11/F12 = nav  ·  F9 = recall"       },
  "pos-x":          { label: "POS-X BumpBar",         desc: "1 = bump  ·  −/+ = nav  ·  0 = recall"             },
  "mmf":            { label: "MMF Val-u Line",         desc: "F1 = bump  ·  F7/F8 = nav  ·  F9 = recall"         },
  "custom":         { label: "Custom",                 desc: "Record your own key bindings below"                },
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
function timerColor(sec: number, p: Priority, warnSec = WARN_SEC, alertSec = ALERT_SEC) {
  if (p === "RUSH") return "#ef4444";
  if (p === "VIP")  return "#f59e0b";
  return sec >= alertSec ? "#ef4444" : sec >= warnSec ? "#f59e0b" : "#ffffff";
}
function urgencyPct(sec: number, p: Priority, warnSec = WARN_SEC, alertSec = ALERT_SEC) {
  if (p === "RUSH") return 1;
  if (p === "VIP")  return Math.min(sec / warnSec, 1);
  return Math.min(sec / alertSec, 1);
}
function getOrderThresholds(order: { items: { station?: string; stationId?: string }[] }, cfg: { stationWarnSec: Record<Station, number>; stationAlertSec: Record<Station, number> }) {
  const stations = [...new Set(order.items.map(it => {
    const raw = (it.station ?? it.stationId ?? "other").toString();
    if (raw === "grill" || raw === "fryer" || raw === "cold" || raw === "dessert" || raw === "other") return raw as Station;
    return stationNameToSlug(raw);
  }))];
  if (stations.length === 0) return { warnSec: WARN_SEC, alertSec: ALERT_SEC };
  const warnSec  = Math.max(...stations.map(s => cfg.stationWarnSec[s]  ?? WARN_SEC));
  const alertSec = Math.max(...stations.map(s => cfg.stationAlertSec[s] ?? ALERT_SEC));
  return { warnSec, alertSec };
}
function progressColor(pct: number, p: Priority) {
  if (p === "RUSH") return "#ef4444";
  if (p === "VIP")  return "#f59e0b";
  return pct >= 1 ? "#ef4444" : pct >= 0.6 ? "#f59e0b" : "#22c55e";
}
function modColor(mod: string, colors: ModifierColors | undefined) {
  if (!colors) return null;
  const l = mod.toLowerCase();
  if (/^(no |without |remove |hold )/.test(l)) return colors.remove;
  if (/^(extra |add |with |double |more )/.test(l)) return colors.extra;
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AllergenBadge({ a }: { a: Allergen }) {
  const m = ALLERGEN_META[a];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}66` }}>
      ⚠ {m.label}
    </span>
  );
}

function ModLine({ mod, showColors }: { mod: string; showColors: boolean }) {
  const modColors = useContext(ModColorCtx);
  const sem = showColors ? modColor(mod, modColors) : null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sem?.dot ?? modColors.normal.dot }} />
      <span className="text-xs leading-tight font-medium" style={{ color: sem?.text ?? modColors.normal.text }}>{mod}</span>
    </div>
  );
}

function UrgencyBar({ sec, priority, warnSec = WARN_SEC, alertSec = ALERT_SEC }: { sec: number; priority: Priority; warnSec?: number; alertSec?: number }) {
  const pct = urgencyPct(sec, priority, warnSec, alertSec);
  return (
    <div className="h-0.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: progressColor(pct, priority) }} />
    </div>
  );
}

function BumpToast({ number, onDone }: { number: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 pointer-events-none"
      style={{ background: "rgba(17,17,22,0.92)", border: "1px solid rgba(34,197,94,0.4)", color: "#86efac", boxShadow: "0 2px 12px rgba(0,0,0,0.5)", animation: "fadeSlideIn 0.15s ease" }}>
      ✓ Bumped #{number}
    </div>
  );
}

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <span className="font-mono text-xs text-white/60 tabular-nums">
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
            <span className="text-[10px] font-semibold uppercase"
              style={{ color: done === stItems.length ? sm.color : "rgba(255,255,255,0.45)" }}>{sm.label}</span>
            <span className="text-[10px] text-white/45">{done}/{stItems.length}</span>
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
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider opacity-80"
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

function OrderCard({ order, featured, doneItems, onToggleItem, onBump, onFocus, onHold, isHeld, cfg }: {
  order: DisplayOrder; featured: boolean; doneItems: Set<string>;
  onToggleItem: (id: string) => void; onBump: () => void; onFocus: () => void;
  onHold: () => void; isHeld: boolean; cfg: KdsConfig;
}) {
  const [elapsed, setElapsed] = useState(order.elapsedSec);
  useEffect(() => {
    setElapsed(order.elapsedSec);
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [order.id, order.elapsedSec]);

  const hasPrio  = order.priority !== "normal";
  const pColor   = order.priority === "RUSH" ? "#ef4444" : order.priority === "VIP" ? "#f59e0b" : "rgba(255,255,255,0.06)";
  const { warnSec: oWarnSec, alertSec: oAlertSec } = getOrderThresholds(order, cfg);
  const tColor   = timerColor(elapsed, order.priority, oWarnSec, oAlertSec);
  const typeMeta = ORDER_TYPE_META[order.type];
  const doneCount = order.items.filter(it => doneItems.has(it.id)).length;
  const allDone   = doneCount === order.items.length;
  const isNew          = elapsed < NEW_SEC;
  const escalationLevel = cfg.escalationEnabled
    ? (elapsed >= oAlertSec ? 2 : elapsed >= oWarnSec ? 1 : 0)
    : 0;
  const fs        = FONT_SZ[cfg.fontSize];
  const effectiveSpan = cfg.featuredFirst && featured
    ? (cfg.featuredSpan ?? Math.max(cfg.numCols - 1, 1))
    : 1;

  const visibleItems = cfg.mode === "single"
    ? order.items.filter(it => it.station === cfg.singleStation)
    : order.items;

  // Long-order layout helpers
  const MAX_VISIBLE_ITEMS = cfg.density === "compact" ? 14 : cfg.density === "comfortable" ? 10 : 12;
  const clippedItems = visibleItems.slice(0, MAX_VISIBLE_ITEMS);
  const overflowCount = visibleItems.length - clippedItems.length;
  // Scale font for large item counts so content doesn't require scrolling
  const itemScale = visibleItems.length >= 12 ? 0.75
    : visibleItems.length >= 9  ? 0.84
    : visibleItems.length >= 6  ? 0.92
    : 1.0;
  // Use 2-column items when: featured wide card, OR long orders in ≤3-col grid
  const itemCols = (featured && effectiveSpan >= 2 && visibleItems.length >= 3)
    || (!featured && visibleItems.length >= 6 && cfg.numCols <= 3) ? 2 : 1;

  if (cfg.mode === "single" && visibleItems.length === 0) return null;

  const borderC = isHeld
    ? "rgba(245,158,11,0.65)"
    : escalationLevel === 2
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

  const theme = THEME_META[cfg.theme] ?? THEME_META.ink;

  return (
    <div className="flex flex-col rounded-xl overflow-hidden border cursor-pointer"
      style={{
        gridColumn: `span ${effectiveSpan}`,
        background: theme.card,
        borderColor: borderC,
        boxShadow: isHeld ? "0 0 18px rgba(245,158,11,0.18)" : shadowC,
        animation: isHeld ? "none" : escalAnim,
        transition: "border-color 0.3s, opacity 0.2s",
        opacity: isHeld ? 0.58 : 1,
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
                <span className="font-semibold tracking-wide truncate" style={{ fontSize: fs.meta, color: "#a7f3d0" }}>
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
              {isHeld && (
                <span className="font-black px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0"
                  style={{ fontSize: 8, background: "rgba(245,158,11,0.20)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.50)" }}>
                  ⏸ HOLD
                </span>
              )}
            </div>
            {cfg.showOrderNumber && (
              <span className="font-black leading-none tracking-tight"
                style={{ fontSize: featured ? fs.featured : fs.num, color: "#fbbf24" }}>
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
            <span className="text-[12px] font-semibold" style={{ color: theme.subtle }}>{doneCount}/{order.items.length}</span>
            <div className="flex gap-1">
              <button onClick={e => { e.stopPropagation(); onHold(); }}
                className="px-2 py-1 rounded-md text-[11px] font-bold border transition-all active:scale-95"
                style={{
                  background: isHeld ? "rgba(245,158,11,0.20)" : "rgba(255,255,255,0.04)",
                  borderColor: isHeld ? "rgba(245,158,11,0.55)" : "rgba(255,255,255,0.09)",
                  color: isHeld ? "#fbbf24" : "rgba(255,255,255,0.35)",
                }}
                title={isHeld ? "Release hold (H)" : "Put on hold (H)"}>
                ⏸
              </button>
              <button onClick={e => { e.stopPropagation(); onBump(); }}
                className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all active:scale-95"
                style={{
                  background: hasPrio ? `${pColor}18` : "rgba(255,255,255,0.06)",
                  borderColor: hasPrio ? `${pColor}44` : "rgba(255,255,255,0.15)",
                  color: hasPrio ? pColor : "rgba(255,255,255,0.62)",
                }}>
                {cfg.mode === "expo" ? "Fire →" : "Bump ↵"}
              </button>
            </div>
          </div>
        </div>

        {/* Order note */}
        {cfg.showNotes && order.note && (
          <div className="px-3 py-2 rounded-lg border flex items-start gap-2 leading-snug"
            style={{ background: "rgba(245,158,11,0.09)", borderColor: "rgba(245,158,11,0.30)", color: "#fde68a" }}>
            <span className="shrink-0 text-base leading-tight">📋</span>
            <span className="text-[13px] font-medium leading-snug">{order.note}</span>
          </div>
        )}

        {/* Item list — scales font for long orders; 2-col for wide/dense cards */}
        <div style={{ fontSize: `${itemScale}em` }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${itemCols},1fr)`, gap: "10px 16px" }}>
            {clippedItems.map((item, idx) => (
              <div key={item.id}
                style={{ borderTop: idx > 0 && itemCols === 1 ? "1px solid rgba(255,255,255,0.05)" : "none", paddingTop: idx > 0 && itemCols === 1 ? 8 : 0 }}>
                <ItemRow item={item} done={doneItems.has(item.id)} onToggle={() => onToggleItem(item.id)} cfg={cfg} />
              </div>
            ))}
          </div>
          {overflowCount > 0 && (
            <div className="mt-2 px-2 py-1.5 rounded-md text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.55)" }}>
                +{overflowCount} more item{overflowCount > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Expo station readiness */}
        {cfg.mode === "expo" && (
          <div className="border-t border-white/[0.06] pt-2">
            <ExpoStationBar order={order} doneItems={doneItems} />
          </div>
        )}

        {allDone && (
          <p className="text-center text-[10px] text-white/45 tracking-wide font-semibold">
            All ready — {cfg.mode === "expo" ? "fire" : "bump"} to complete
          </p>
        )}
        {cfg.showUrgencyBar && <UrgencyBar sec={elapsed} priority={order.priority} warnSec={oWarnSec} alertSec={oAlertSec} />}
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

function QuickSettingsPanel({ cfg, setCfg, onClose, focusedOrder, onBumpFocused, recentBumped, nowServingOrders, recallOrder }: {
  cfg: KdsConfig;
  setCfg: React.Dispatch<React.SetStateAction<KdsConfig>>;
  onClose: () => void;
  focusedOrder: DisplayOrder | null;
  onBumpFocused: () => void;
  recentBumped: { order: DisplayOrder; bumpedAt: number }[];
  nowServingOrders: { order: DisplayOrder; firedAt: number }[];
  recallOrder: (id: string) => void;
}) {
  const [showRecallList, setShowRecallList] = useState(false);
  const activeIds = new Set(nowServingOrders.map(ns => ns.order.id));
  const recallable = recentBumped.filter(r => !activeIds.has(r.order.id));
  const lastRecallable = recallable[0] ?? null;

  function bumpAndClose() { onBumpFocused(); onClose(); }
  function recallAndClose(id: string) { recallOrder(id); onClose(); }
  const toggle = <K extends keyof KdsConfig>(k: K, v: KdsConfig[K]) => setCfg(c => ({ ...c, [k]: v }));

  return (
    <div className="absolute bottom-16 right-16 z-40 rounded-2xl overflow-hidden shadow-2xl border border-white/[0.12]"
      style={{ background: "#13131a", width: 248 }}>
      <div className="px-3 py-2.5 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap style={{ width: 11, height: 11, color: "#f59e0b" }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/65">Quick Actions</span>
        </div>
        <button onClick={onClose} className="text-white/58 hover:text-white/85 text-base leading-none">×</button>
      </div>
      <div className="p-3 flex flex-col gap-2">

        {/* Bump (clear) focused order */}
        <button
          onClick={bumpAndClose}
          disabled={!focusedOrder}
          className="w-full py-2.5 rounded-xl text-[12px] font-bold border transition-all disabled:opacity-30 flex items-center justify-center gap-1.5 active:scale-[0.98]"
          style={{ background: focusedOrder ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)", borderColor: focusedOrder ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.07)", color: focusedOrder ? "#f59e0b" : "rgba(255,255,255,0.35)" }}>
          <span style={{ fontSize: 13 }}>✓</span>
          {focusedOrder ? `Bump #${focusedOrder.number}` : "No order focused"}
        </button>

        {/* Recall last */}
        <button
          onClick={() => lastRecallable && recallAndClose(lastRecallable.order.id)}
          disabled={!lastRecallable}
          className="w-full py-2.5 rounded-xl text-[12px] font-bold border transition-all disabled:opacity-30 flex items-center justify-center gap-1.5 active:scale-[0.98]"
          style={{ background: "rgba(74,222,128,0.07)", borderColor: "rgba(74,222,128,0.2)", color: lastRecallable ? "rgba(74,222,128,0.88)" : "rgba(255,255,255,0.35)" }}>
          <span>↩</span>
          {lastRecallable ? `Recall #${lastRecallable.order.number}` : "Nothing to recall"}
        </button>

        {/* Recall list */}
        <div>
          <button
            onClick={() => setShowRecallList(v => !v)}
            disabled={recallable.length === 0}
            className="w-full py-2 rounded-xl text-[12px] font-bold border transition-all disabled:opacity-30 flex items-center justify-between px-3 active:scale-[0.98]"
            style={{ background: showRecallList ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)", borderColor: showRecallList ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.07)", color: recallable.length > 0 ? (showRecallList ? "rgba(74,222,128,0.8)" : "rgba(255,255,255,0.55)") : "rgba(255,255,255,0.25)" }}>
            <span>↩↩ Recall list</span>
            {recallable.length > 0 && (
              <span className="tabular-nums text-[11px] opacity-70">{recallable.length}</span>
            )}
          </button>
          {showRecallList && recallable.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-1 pl-1">
              {recallable.map(r => (
                <button key={r.order.id}
                  onClick={() => recallAndClose(r.order.id)}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all hover:bg-white/[0.05] active:scale-[0.98]"
                  style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-2">
                    <span className="font-black tabular-nums text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>#{r.order.number}</span>
                    {r.order.customer && <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.50)" }}>{r.order.customer}</span>}
                  </div>
                  <span style={{ color: "rgba(74,222,128,0.7)", fontSize: 13 }}>↩</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Age heatmap toggle */}
        <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[11px] text-white/65 uppercase tracking-wider">Age heatmap</span>
          <button onClick={() => toggle("showAgeHeatmap", !cfg.showAgeHeatmap)}
            className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
            style={{ background: cfg.showAgeHeatmap ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
            <span className="w-3 h-3 rounded-full bg-white transition-all"
              style={{ transform: cfg.showAgeHeatmap ? "translateX(16px)" : "translateX(0)" }} />
          </button>
        </div>

        {/* Footer bar toggle */}
        <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[11px] text-white/65 uppercase tracking-wider">Footer Bar</span>
          <button onClick={() => toggle("showFooter", !cfg.showFooter)}
            className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
            style={{ background: cfg.showFooter ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
            <span className="w-3 h-3 rounded-full bg-white transition-all"
              style={{ transform: cfg.showFooter ? "translateX(16px)" : "translateX(0)" }} />
          </button>
        </div>

        {/* Recall recent */}
        <button
          onClick={() => {
            const activeIds = new Set(nowServingOrders.map(ns => ns.order.id));
            const last = recentBumped.find(r => !activeIds.has(r.order.id));
            if (last) recallOrder(last.order.id);
          }}
          disabled={recentBumped.every(r => nowServingOrders.some(ns => ns.order.id === r.order.id))}
          className="w-full py-2.5 rounded-xl text-[12px] font-bold border transition-all disabled:opacity-30 flex items-center justify-center gap-1.5 active:scale-[0.98]"
          style={{ background: "rgba(74,222,128,0.07)", borderColor: "rgba(74,222,128,0.2)", color: "rgba(74,222,128,0.88)" }}>
          ↩ Recall recent
        </button>
      </div>
    </div>
  );
}

// ─── Virtual Bump Bar ─────────────────────────────────────────────────────────

function VirtualBumpBar({
  focusedOrder, canPrev, canNext, canRecall, lastRecallable,
  onPrev, onNext, onBump, onRecall, bottomOffset,
}: {
  focusedOrder: DisplayOrder | null;
  canPrev: boolean; canNext: boolean; canRecall: boolean;
  lastRecallable: DisplayOrder | null;
  onPrev: () => void; onNext: () => void;
  onBump: () => void; onRecall: () => void;
  bottomOffset: number;
}) {
  const [elapsed, setElapsed] = useState(focusedOrder?.elapsedSec ?? 0);
  useEffect(() => { setElapsed(focusedOrder?.elapsedSec ?? 0); }, [focusedOrder?.id, focusedOrder?.elapsedSec]);
  useEffect(() => {
    if (!focusedOrder) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [focusedOrder?.id]);
  const elapsedColor = elapsed >= 900 ? "#f87171" : elapsed >= 540 ? "#f59e0b" : "rgba(255,255,255,0.45)";
  return (
    <div
      className="absolute z-20 flex items-stretch rounded-2xl overflow-hidden border shadow-2xl"
      style={{
        bottom: bottomOffset,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(13,13,16,0.88)",
        borderColor: "rgba(255,255,255,0.10)",
        backdropFilter: "blur(14px)",
        animation: "vbbSlideUp 0.18s ease-out",
        minWidth: 340,
      }}
    >
      {/* PREV */}
      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="flex flex-col items-center justify-center px-5 py-3 gap-1 transition-all active:scale-95 hover:bg-white/[0.06] disabled:opacity-30 border-r"
        style={{ borderColor: "rgba(255,255,255,0.07)", minWidth: 64 }}
        title="Previous order (← key)">
        <span className="text-[20px] leading-none text-white/75">←</span>
        <span className="text-[9px] uppercase tracking-widest text-white/35 font-bold">Prev</span>
      </button>

      {/* BUMP */}
      <button
        onClick={onBump}
        disabled={!focusedOrder}
        className="flex flex-col items-center justify-center px-6 py-3 gap-1 transition-all active:scale-95 disabled:opacity-30 border-r flex-1"
        style={{
          borderColor: "rgba(255,255,255,0.07)",
          background: focusedOrder ? "rgba(245,158,11,0.12)" : "transparent",
        }}
        title="Bump focused order (SPACE / ENTER)">
        <span className="text-[20px] leading-none font-black" style={{ color: focusedOrder ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>✓</span>
        <span className="text-[11px] font-black tabular-nums" style={{ color: focusedOrder ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>
          {focusedOrder ? `#${focusedOrder.number}` : "Bump"}
        </span>
        {focusedOrder && (
          <span className="text-[9px] font-mono tabular-nums leading-none" style={{ color: elapsedColor }}>
            {`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`}
          </span>
        )}
      </button>

      {/* RECALL */}
      <button
        onClick={onRecall}
        disabled={!canRecall}
        className="flex flex-col items-center justify-center px-5 py-3 gap-1 transition-all active:scale-95 disabled:opacity-30 border-r hover:bg-white/[0.06]"
        style={{ borderColor: "rgba(255,255,255,0.07)", minWidth: 72 }}
        title="Recall last bumped order (Backspace)">
        <span className="text-[18px] leading-none" style={{ color: canRecall ? "rgba(74,222,128,0.9)" : "rgba(255,255,255,0.3)" }}>↩</span>
        <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: canRecall ? "rgba(74,222,128,0.65)" : "rgba(255,255,255,0.25)" }}>
          {lastRecallable ? `#${lastRecallable.number}` : "Recall"}
        </span>
      </button>

      {/* NEXT */}
      <button
        onClick={onNext}
        disabled={!canNext}
        className="flex flex-col items-center justify-center px-5 py-3 gap-1 transition-all active:scale-95 hover:bg-white/[0.06] disabled:opacity-30"
        style={{ minWidth: 64 }}
        title="Next order (→ key)">
        <span className="text-[20px] leading-none text-white/75">→</span>
        <span className="text-[9px] uppercase tracking-widest text-white/35 font-bold">Next</span>
      </button>
    </div>
  );
}

// ─── Inject Order Panel ───────────────────────────────────────────────────────

const INJECT_STATIONS = [
  { id: "multi",   label: "Multi",   color: "#a5b4fc" },
  { id: "grill",   label: "Grill",   color: "#ef4444" },
  { id: "fryer",   label: "Fryer",   color: "#f59e0b" },
  { id: "cold",    label: "Cold",    color: "#3b82f6" },
  { id: "dessert", label: "Dessert", color: "#a855f7" },
  { id: "other",   label: "Other",   color: "#6b7280" },
] as const;

const INJECT_PRIORITIES = [
  { id: "random", label: "Rnd",    color: undefined },
  { id: "normal", label: "Normal", color: undefined },
  { id: "rush",   label: "RUSH",   color: "#ef4444" },
  { id: "vip",    label: "VIP",    color: "#f59e0b" },
] as const;

const INJECT_NOTES = [
  { id: "random",                         label: "Random" },
  { id: "",                               label: "None" },
  { id: "Allergy: nuts",                  label: "🥜 Allergy: nuts" },
  { id: "Birthday table — add candles",   label: "🎂 Birthday" },
  { id: "VIP guest",                      label: "⭐ VIP guest" },
] as const;

function InjectOrderPanel({
  storeId, onClose, onFired,
}: {
  storeId: string;
  onClose: () => void;
  onFired: () => void;
}) {
  const [station,  setStation]  = useState<string>("multi");
  const [priority, setPriority] = useState<string>("random");
  const [count,    setCount]    = useState<number>(0);
  const [note,     setNote]     = useState<string>("random");
  const [firing,   setFiring]   = useState(false);
  const [clearing, setClearing] = useState(false);

  async function fire() {
    if (firing) return;
    setFiring(true);
    try {
      const params = new URLSearchParams({ storeId });
      if (station === "multi") params.set("multiStation", "true");
      else params.set("station", station);
      if (priority !== "random") params.set("priority", priority);
      if (count > 0) params.set("count", String(count));
      if (note !== "random") params.set("note", note);
      const res  = await fetch(`/api/test/inject-order?${params}`, { method: "POST" });
      const json = await res.json() as { ok: boolean; order?: { orderNumber: string } };
      if (res.ok && json.ok) {
        sonnerToast.success(`Order #${json.order?.orderNumber} fired`, { duration: 2000 });
        onFired();
      } else {
        sonnerToast.error("Injection failed");
      }
    } catch { sonnerToast.error("Network error"); }
    finally { setFiring(false); }
  }

  async function clearAll() {
    if (clearing) return;
    setClearing(true);
    try {
      const res  = await fetch(`/api/orders/clear-all?storeId=${storeId}`, { method: "POST" });
      const json = await res.json() as { cleared: number };
      if (res.ok) {
        sonnerToast.success(`Cleared ${json.cleared} order${json.cleared !== 1 ? "s" : ""}`, { duration: 2000 });
        onFired();
        onClose();
      }
    } catch { sonnerToast.error("Network error"); }
    finally { setClearing(false); }
  }

  const chip = (active: boolean, color?: string) => ({
    background: active ? (color ? `${color}18` : "rgba(245,158,11,0.15)") : "rgba(255,255,255,0.04)",
    borderColor: active ? (color ? `${color}50` : "rgba(245,158,11,0.4)") : "rgba(255,255,255,0.09)",
    color:       active ? (color ?? "#f59e0b") : "rgba(255,255,255,0.52)",
  });

  return (
    <div className="absolute top-12 right-[104px] z-50 rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: "#13131a", width: 292, border: "1px solid rgba(255,255,255,0.13)" }}>
      {/* Title bar */}
      <div className="px-3.5 py-2.5 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical style={{ width: 12, height: 12, color: "#f59e0b" }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/65">Test Order Injector</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 text-base leading-none transition-colors">×</button>
      </div>

      <div className="p-3.5 flex flex-col gap-3.5">

        {/* Station */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 mb-1.5">Station</p>
          <div className="flex flex-wrap gap-1">
            {INJECT_STATIONS.map(s => (
              <button key={s.id} onClick={() => setStation(s.id)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all"
                style={chip(station === s.id, s.color)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 mb-1.5">Priority</p>
          <div className="flex gap-1">
            {INJECT_PRIORITIES.map(p => (
              <button key={p.id} onClick={() => setPriority(p.id)}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all"
                style={chip(priority === p.id, p.color)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Item Count */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 mb-1.5">
            Items <span className="normal-case opacity-60">{count === 0 ? "(random)" : ""}</span>
          </p>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => setCount(n)}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all"
                style={chip(count === n)}>
                {n === 0 ? "~" : n}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 mb-1.5">Order Note</p>
          <div className="flex flex-wrap gap-1">
            {INJECT_NOTES.map(n => (
              <button key={n.id} onClick={() => setNote(n.id)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all"
                style={chip(note === n.id)}>
                {n.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-0.5">
          <button onClick={fire} disabled={firing}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-bold border transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-[0.98]"
            style={{ background: "rgba(245,158,11,0.14)", borderColor: "rgba(245,158,11,0.42)", color: "#f59e0b" }}>
            <FlaskConical style={{ width: 12, height: 12 }} />
            {firing ? "Firing…" : "Fire Order"}
          </button>
          <button onClick={clearAll} disabled={clearing}
            className="py-2.5 px-3.5 rounded-xl text-[11px] font-bold border transition-all disabled:opacity-50 flex items-center justify-center gap-1 active:scale-[0.98]"
            style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.28)", color: "#f87171" }}>
            {clearing ? "…" : "✕ Clear All"}
          </button>
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
  const autoZoomVal = Math.min(2.2, Math.max(0.40, window.innerWidth / 1920));
  const curZ = cfg.zoomOverride ?? autoZoomVal;

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
          <button onClick={onClose} className="text-white/58 hover:text-white/85 text-lg leading-none">×</button>
        </div>
        <div className="px-4 py-3 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">

          {/* Mode */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">KDS Mode</p>
            <div className="grid grid-cols-3 gap-1">
              {(["multi", "single", "expo"] as KdsMode[]).map(id => (
                <button key={id} onClick={() => set("mode", id)}
                  className="py-2 rounded-lg text-[11px] font-bold border transition-all capitalize"
                  style={{ background: cfg.mode === id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)", borderColor: cfg.mode === id ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.12)", color: cfg.mode === id ? "#f59e0b" : "rgba(255,255,255,0.85)" }}>
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
                      className="py-1.5 rounded text-[10px] font-bold border transition-all"
                      style={{ background: active ? `${sm.color}22` : "rgba(255,255,255,0.05)", borderColor: active ? `${sm.color}55` : "rgba(255,255,255,0.12)", color: active ? sm.color : "rgba(255,255,255,0.85)" }}>
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
                      className="py-2 px-2 rounded-lg text-[9px] font-bold border text-center leading-tight transition-all"
                      style={{ background: cfg.expoSendMode === id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)", borderColor: cfg.expoSendMode === id ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.12)", color: cfg.expoSendMode === id ? "#f59e0b" : "rgba(255,255,255,0.85)" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Layout */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">Layout</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">Grid columns</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => set("numCols", n)}
                    className="w-8 h-8 rounded text-xs font-bold border transition-all"
                    style={{ background: cfg.numCols === n ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)", borderColor: cfg.numCols === n ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.12)", color: cfg.numCols === n ? "#f59e0b" : "rgba(255,255,255,0.85)" }}>
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
                    className="h-7 px-2.5 rounded text-[10px] font-bold border transition-all"
                    style={{ background: cfg.featuredSpan === null ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)", borderColor: cfg.featuredSpan === null ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.12)", color: cfg.featuredSpan === null ? "#f59e0b" : "rgba(255,255,255,0.85)" }}>
                    Auto
                  </button>
                  {[1, 2, 3, 4].filter(n => n <= cfg.numCols).map(n => (
                    <button key={n} onClick={() => set("featuredSpan", n)}
                      className="w-7 h-7 rounded text-[10px] font-bold border transition-all"
                      style={{ background: cfg.featuredSpan === n ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)", borderColor: cfg.featuredSpan === n ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.12)", color: cfg.featuredSpan === n ? "#f59e0b" : "rgba(255,255,255,0.85)" }}>
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
                    style={{ background: cfg.density === d ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", borderColor: cfg.density === d ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)", color: cfg.density === d ? "#f59e0b" : "rgba(255,255,255,0.72)" }}>
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
                    style={{ background: cfg.fontSize === id ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", borderColor: cfg.fontSize === id ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)", color: cfg.fontSize === id ? "#f59e0b" : "rgba(255,255,255,0.72)" }}>
                    {id}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">UI scale</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => set("zoomOverride", Math.max(0.40, Math.round((curZ - 0.05) * 100) / 100))}
                  className="w-6 h-6 rounded border text-[11px] font-bold transition-all hover:bg-white/10"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}>−</button>
                <span className="text-[10px] tabular-nums w-9 text-center"
                  style={{ color: cfg.zoomOverride !== null ? "#f59e0b" : "rgba(255,255,255,0.35)" }}>
                  {Math.round(curZ * 100)}%
                </span>
                <button onClick={() => set("zoomOverride", Math.min(2.50, Math.round((curZ + 0.05) * 100) / 100))}
                  className="w-6 h-6 rounded border text-[11px] font-bold transition-all hover:bg-white/10"
                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}>+</button>
                <button onClick={() => set("zoomOverride", null)}
                  className="h-6 px-2 rounded border text-[9px] font-bold transition-all"
                  style={{ background: cfg.zoomOverride === null ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)", borderColor: cfg.zoomOverride === null ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.07)", color: cfg.zoomOverride === null ? "#f59e0b" : "rgba(255,255,255,0.65)" }}>
                  Auto
                </button>
              </div>
            </div>
          </div>

          {/* Now Serving */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">Now Serving Strip</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">Show strip</span>
              <button onClick={() => set("showNowServing", !cfg.showNowServing)}
                className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
                style={{ background: cfg.showNowServing ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
                <span className="w-3 h-3 rounded-full bg-white transition-all"
                  style={{ transform: cfg.showNowServing ? "translateX(16px)" : "translateX(0)" }} />
              </button>
            </div>
            {cfg.showNowServing && (
              <div className="flex items-center gap-2 pl-3 border-l border-white/[0.07]">
                <span className="text-[10px] text-white/60 shrink-0">Auto-dismiss</span>
                <input type="range" min={15} max={120} step={5}
                  value={cfg.nowServingExpirySec}
                  onChange={e => set("nowServingExpirySec", parseInt(e.target.value))}
                  className="flex-1 h-1 cursor-pointer accent-amber-500" />
                <span className="text-[10px] text-white/60 w-8 text-right shrink-0">{cfg.nowServingExpirySec}s</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">Recent / recall tray</span>
              <button onClick={() => set("showRecentBumped", !cfg.showRecentBumped)}
                className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
                style={{ background: cfg.showRecentBumped ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
                <span className="w-3 h-3 rounded-full bg-white transition-all"
                  style={{ transform: cfg.showRecentBumped ? "translateX(16px)" : "translateX(0)" }} />
              </button>
            </div>
          </div>

          {/* Content toggles */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55 mb-1">Card Content</p>
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
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">Sound Alerts</p>
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
                    {(["chime", "ding", "beep", "blip"] as ChimeType[]).map(t => {
                      const active = cfg.escalationWarnChime === t;
                      return (
                        <button key={t}
                          onClick={() => { set("escalationWarnChime", t); playChime(t, cfg.soundVolume); }}
                          className="h-6 px-2 rounded text-[9px] font-bold border capitalize transition-all"
                          style={{ background: active ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)", borderColor: active ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.12)", color: active ? "#f59e0b" : "rgba(255,255,255,0.82)" }}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">15 min chime</span>
                  <div className="flex gap-0.5">
                    {(["chime", "ding", "beep", "blip"] as ChimeType[]).map(t => {
                      const active = cfg.escalationAlertChime === t;
                      return (
                        <button key={t}
                          onClick={() => { set("escalationAlertChime", t); playChime(t, cfg.soundVolume); }}
                          className="h-6 px-2 rounded text-[9px] font-bold border capitalize transition-all"
                          style={{ background: active ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)", borderColor: active ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.12)", color: active ? "#f59e0b" : "rgba(255,255,255,0.82)" }}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <span className="text-[9px] text-white/42 leading-relaxed">Border flash shows throughout · "chime" = soft soothing tone · "beep" = classic KDS double-beep</span>
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
                <span className="text-[10px] text-white/60 w-7 text-right">{Math.round(cfg.soundVolume * 100)}%</span>
              </div>
              <div className="flex flex-col gap-1 pl-3 border-l border-white/[0.07]">
                <span className="text-[10px] text-white/55 mb-0.5">Per-station chimes</span>
                {(Object.entries(STATION_META) as [Station, typeof STATION_META[Station]][]).map(([station, meta]) => (
                  <div key={station} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                      <span className="text-[10px] text-white/65 truncate">{meta.label}</span>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      {(["ding", "beep", "blip", "none"] as (ChimeType | "none")[]).map(t => {
                        const active = cfg.stationChimes[station] === t;
                        return (
                          <button key={t}
                            onClick={() => {
                              setCfg(c => ({ ...c, stationChimes: { ...c.stationChimes, [station]: t } }));
                              if (t !== "none") playChime(t as ChimeType, cfg.soundVolume);
                            }}
                            className="h-6 px-1.5 rounded text-[9px] font-bold border capitalize transition-all"
                            style={{ background: active ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)", borderColor: active ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.12)", color: active ? "#f59e0b" : "rgba(255,255,255,0.82)" }}>
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
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">Bump Bar</p>
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
                <span className="text-[10px] text-white/55 mb-0.5">Device preset</span>
                {(Object.entries(BUMP_BAR_PRESETS) as [BumpBarPreset, { label: string; desc: string }][]).map(([id, preset]) => (
                  <button key={id}
                    onClick={() => {
                      if (id !== "custom") {
                        const keys = BUMP_BAR_KEY_MAP[id as Exclude<BumpBarPreset,"custom">];
                        setCfg(c => ({ ...c, bumpBarPreset: id, bumpKey: keys.bump, prevKey: keys.prev, nextKey: keys.next, recallKey: keys.recall }));
                      } else {
                        set("bumpBarPreset", "custom");
                      }
                    }}
                    className="flex flex-col items-start px-2.5 py-1.5 rounded-lg border text-left transition-all"
                    style={{ background: cfg.bumpBarPreset === id ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)", borderColor: cfg.bumpBarPreset === id ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.07)" }}>
                    <span className="text-[10px] font-bold" style={{ color: cfg.bumpBarPreset === id ? "#f59e0b" : "rgba(255,255,255,0.5)" }}>{preset.label}</span>
                    <span className="text-[9px] text-white/48 mt-0.5">{preset.desc}</span>
                  </button>
                ))}
              </div>
              {cfg.bumpBarPreset === "custom" && (
                <div className="flex flex-col gap-1.5 pl-3 border-l border-white/[0.07] mt-0.5">
                  <KeyRecorder label="Bump key"    value={cfg.bumpKey}   onRecord={k => set("bumpKey",   k)} />
                  <KeyRecorder label="Prev order"  value={cfg.prevKey}   onRecord={k => set("prevKey",  k)} />
                  <KeyRecorder label="Next order"  value={cfg.nextKey}   onRecord={k => set("nextKey",  k)} />
                  <KeyRecorder label="Recall key"  value={cfg.recallKey} onRecord={k => set("recallKey", k)} />
                </div>
              )}
              <div className="px-2.5 py-2 rounded-lg border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p className="text-[9px] text-white/50 leading-relaxed">USB HID bump bars connect as keyboards — plug in and pick your model. For gamepad-protocol bars, button A = bump, L/R = navigate.</p>
              </div>
            </>)}
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-white/55">Virtual bump buttons</span>
              <button onClick={() => set("showVirtualBumpBar", !cfg.showVirtualBumpBar)}
                className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
                style={{ background: cfg.showVirtualBumpBar ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
                <span className="w-3 h-3 rounded-full bg-white transition-all"
                  style={{ transform: cfg.showVirtualBumpBar ? "translateX(16px)" : "translateX(0)" }} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">Footer bar</span>
              <button onClick={() => set("showFooter", !cfg.showFooter)}
                className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
                style={{ background: cfg.showFooter ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
                <span className="w-3 h-3 rounded-full bg-white transition-all"
                  style={{ transform: cfg.showFooter ? "translateX(16px)" : "translateX(0)" }} />
              </button>
            </div>
          </div>

          {/* Station targets */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55">Station Targets</p>
            <p className="text-[9px] text-white/35 leading-relaxed -mt-1">Warn / alert thresholds per station. Cards change amber → red when exceeded.</p>
            {(Object.entries(STATION_META) as [Station, typeof STATION_META[Station]][]).map(([station, meta]) => (
              <div key={station} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 min-w-0 w-16 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                  <span className="text-[10px] text-white/65 truncate">{meta.label}</span>
                </div>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-[9px] text-amber-400/70 shrink-0">⚠</span>
                  <input type="number" min={1} max={59} step={1}
                    value={Math.floor((cfg.stationWarnSec[station] ?? WARN_SEC) / 60)}
                    onChange={e => {
                      const v = Math.max(1, Math.min(59, parseInt(e.target.value) || 1));
                      setCfg(c => ({ ...c, stationWarnSec: { ...c.stationWarnSec, [station]: v * 60 } }));
                    }}
                    className="w-10 h-6 text-center text-[11px] font-bold rounded border bg-transparent outline-none focus:border-amber-500/60"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#f59e0b" }} />
                  <span className="text-[9px] text-white/35 shrink-0">m</span>
                  <span className="text-[9px] text-red-400/70 shrink-0 ml-1">🔴</span>
                  <input type="number" min={1} max={90} step={1}
                    value={Math.floor((cfg.stationAlertSec[station] ?? ALERT_SEC) / 60)}
                    onChange={e => {
                      const v = Math.max(1, Math.min(90, parseInt(e.target.value) || 1));
                      setCfg(c => ({ ...c, stationAlertSec: { ...c.stationAlertSec, [station]: v * 60 } }));
                    }}
                    className="w-10 h-6 text-center text-[11px] font-bold rounded border bg-transparent outline-none focus:border-red-500/60"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#f87171" }} />
                  <span className="text-[9px] text-white/35 shrink-0">m</span>
                </div>
              </div>
            ))}
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
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<KdsConfig>;
        // Migrate: old "bell" chime type → "beep"
        const mc = (v: unknown) => v === "bell" ? "beep" : v;
        if (parsed.soundChime)           parsed.soundChime           = mc(parsed.soundChime) as ChimeType;
        if (parsed.escalationWarnChime)  parsed.escalationWarnChime  = mc(parsed.escalationWarnChime) as ChimeType;
        if (parsed.escalationAlertChime) parsed.escalationAlertChime = mc(parsed.escalationAlertChime) as ChimeType;
        if (parsed.stationChimes) {
          const sc = parsed.stationChimes as Record<string, unknown>;
          for (const k of Object.keys(sc)) sc[k] = mc(sc[k]);
        }
        return { ...DEFAULT_CFG, ...parsed };
      }
    } catch {}
    return DEFAULT_CFG;
  });
  // ── Resolution-aware zoom ────────────────────────────────────────────────────
  // Auto-zoom relative to 1920 px baseline. Manual override saved in cfg.
  const calcAutoZoom = () =>
    Math.min(2.2, Math.max(0.40, Math.min(window.innerWidth / 1920, window.innerHeight / 1080)));
  const [autoZoom, setAutoZoom] = useState(calcAutoZoom);
  useEffect(() => {
    const onResize = () => setAutoZoom(calcAutoZoom());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const kdsZoom = cfg.zoomOverride ?? autoZoom;
  const [activeTab, setTab]   = useState<string>("All");  // "All" | DB station ID
  const [focusedId, setFocus] = useState<string | null>(null);
  const [doneItems, setDone]  = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [bumpToast, setBumpToast]   = useState<{ number: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [injecting, setInjecting]   = useState(false);
  const [nowServingOrders, setNowServing] = useState<{ order: DisplayOrder; firedAt: number }[]>([]);
  const [recentBumped,    setRecentBumped] = useState<{ order: DisplayOrder; bumpedAt: number }[]>([]);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [showInjectPanel,   setShowInjectPanel]   = useState(false);
  const [pingActive, setPingActive] = useState(false);
  const [modColors, setModColors] = useState<ModifierColors>(DEFAULT_MOD_COLORS);
  const [sessionBumps, setSessionBumps] = useState(0);
  const [heldOrders,   setHeldOrders]   = useState<Set<string>>(new Set());
  const toggleHold = useCallback((id: string) => {
    setHeldOrders(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dbStations } = useListStations({ storeId }, { query: { enabled: !!storeId } as any });
  const { data: rawOrders } = useListOrders(
    { storeId, status: "in_progress" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!storeId, refetchInterval: 10000 } as any }
  );
  const bumpOrderMutation = useBumpOrder();

  useEffect(() => {
    if (stores && stores.length > 0 && !storeId) setStoreId(stores[0].id);
  }, [stores, storeId]);

  // Persist config to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem("kds_cfg", JSON.stringify(cfg)); } catch {}
  }, [cfg]);

  // Load modifier colors from server
  useEffect(() => {
    fetch("/api/modifier-colors")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setModColors(d as ModifierColors); })
      .catch(() => {});
  }, []);

  // onNewOrder is handled by the allOrders effect below (has station info)
  useKdsWebSocket(storeId, queryClient, undefined, (safeCfg) => {
    setCfg(c => ({ ...c, ...(safeCfg as Partial<KdsConfig>) }));
    sonnerToast.info("Display config updated from template", { id: "cfg-push", duration: 3000 });
  }, () => {
    setPingActive(true);
    setTimeout(() => setPingActive(false), 1600);
  }, (colors) => {
    setModColors(colors as ModifierColors);
  });

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

  // Orders available for bump-bar navigation (skip held)
  const navigableOrders = visibleOrders.filter(o => !heldOrders.has(o.id));
  const focusedOrder = navigableOrders.find(o => o.id === focusedId) ?? navigableOrders[0] ?? null;
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
          setHeldOrders(prev => { const next = new Set(prev); next.delete(orderId); return next; });
          setFocus(prev => prev === orderId ? (navigableOrders.find(o => o.id !== orderId)?.id ?? null) : prev);
          setDone(prev => { const next = new Set(prev); bumped.items.forEach(it => next.delete(it.id)); return next; });
          setBumpToast({ number: bumped.number });
          setNowServing(prev => {
            const without = prev.filter(ns => ns.order.id !== bumped.id);
            return [...without, { order: bumped, firedAt: Date.now() }].slice(-8);
          });
          setRecentBumped(prev => {
            const without = prev.filter(r => r.order.id !== bumped.id);
            return [{ order: bumped, bumpedAt: Date.now() }, ...without].slice(0, 10);
          });
          setSessionBumps(n => n + 1);
        },
      }
    );
  }, [allOrders, bumpOrderMutation, queryClient, visibleOrders]);

  const toggleItem = (itemId: string) => setDone(prev => {
    const next = new Set(prev); next.has(itemId) ? next.delete(itemId) : next.add(itemId); return next;
  });

  // ── Recall a bumped order (Now Serving strip OR recent list) ───────────────
  async function recallOrder(orderId: string) {
    const nsEntry = nowServingOrders.find(ns => ns.order.id === orderId);
    const rcEntry = recentBumped.find(r => r.order.id === orderId);
    const entry = nsEntry ?? rcEntry;
    const orderNum = entry?.order.number ?? orderId;
    try {
      const res = await fetch(`/api/orders/${orderId}/recall`, { method: "POST" });
      if (res.ok) {
        setNowServing(prev => prev.filter(ns => ns.order.id !== orderId));
        setRecentBumped(prev => prev.filter(r => r.order.id !== orderId));
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        sonnerToast.success(`Order #${orderNum} recalled`, { duration: 2000 });
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
      // Ctrl+=/Ctrl+- : zoom in/out; Ctrl+0 : reset to auto
      if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "0")) {
        const az = calcAutoZoom();
        const cur = cfgRef.current.zoomOverride ?? az;
        if (e.key === "=" || e.key === "+") setCfg(c => ({ ...c, zoomOverride: Math.min(2.50, Math.round((cur + 0.05) * 100) / 100) }));
        else if (e.key === "-")             setCfg(c => ({ ...c, zoomOverride: Math.max(0.40, Math.round((cur - 0.05) * 100) / 100) }));
        else                                setCfg(c => ({ ...c, zoomOverride: null }));
        e.preventDefault(); return;
      }
      // Don't intercept when typing in an actual input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (visibleOrders.length === 0) return;
      // C key: clear Now Serving strip
      if ((e.key === "c" || e.key === "C") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setNowServing([]); e.preventDefault(); return;
      }
      // Digit keys 1–9: jump directly to nth order
      if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = visibleOrders[parseInt(e.key) - 1];
        if (target) { setFocus(target.id); e.preventDefault(); }
        return;
      }
      // H key: toggle hold on focused order
      if ((e.key === "h" || e.key === "H") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (focusedOrder) { toggleHold(focusedOrder.id); e.preventDefault(); return; }
      }
      const idx = navigableOrders.findIndex(o => o.id === focusedId);
      const nextKey = cfg.nextKey;
      const prevKey = cfg.prevKey;
      const bumpKey = cfg.bumpKey;
      if (e.key === nextKey || e.key === "ArrowRight" || e.key === "ArrowDown") {
        setFocus(navigableOrders[Math.min(idx + 1, navigableOrders.length - 1)]?.id ?? null);
      } else if (e.key === prevKey || e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setFocus(navigableOrders[Math.max(idx - 1, 0)]?.id ?? null);
      } else if ((e.key === bumpKey || e.key === "Enter") && focusedOrder) {
        e.preventDefault(); bump(focusedOrder.id);
      } else if (e.key === cfg.recallKey && cfg.recallKey) {
        const activeIds = new Set(nowServingOrders.map(ns => ns.order.id));
        const last = recentBumped.find(r => !activeIds.has(r.order.id));
        if (last) { recallOrder(last.order.id); e.preventDefault(); }
      } else if (e.key === "r" || e.key === "R") {
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigableOrders, visibleOrders, focusedId, focusedOrder, bump, exitFullscreen, queryClient, cfg.bumpKey, cfg.prevKey, cfg.nextKey, cfg.recallKey, nowServingOrders, recentBumped, recallOrder, toggleHold]);

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

  // ── Now Serving auto-expire + clock tick ──────────────────────────────────
  const [, setNsTick] = useState(0);
  useEffect(() => {
    if (nowServingOrders.length === 0) return;
    const expMs = cfgRef.current.nowServingExpirySec * 1000;
    const t = setInterval(() => {
      setNowServing(prev => prev.filter(ns => Date.now() - ns.firedAt < expMs));
      setNsTick(n => n + 1);
    }, 1000);
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
  const warnCount  = allOrders.filter(o => { const t = getOrderThresholds(o, cfg); return o.elapsedSec >= t.warnSec && o.elapsedSec < t.alertSec; }).length;
  const alertCount = allOrders.filter(o => { const t = getOrderThresholds(o, cfg); return o.elapsedSec >= t.alertSec; }).length;
  const statsMin   = allOrders.length ? Math.min(...allOrders.map(o => o.elapsedSec)) : 0;
  const statsMax   = allOrders.length ? Math.max(...allOrders.map(o => o.elapsedSec)) : 0;
  const statsAvg   = allOrders.length ? Math.round(allOrders.reduce((a, o) => a + o.elapsedSec, 0) / allOrders.length) : 0;
  function fmtSec(s: number) { const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; }

  const theme = THEME_META[cfg.theme] ?? THEME_META.ink;

  return (
    <ModColorCtx.Provider value={modColors}>
    <div className="bg-[#0a0a0b] text-white flex flex-col select-none overflow-hidden relative"
      style={{
        fontFamily: "'Inter',system-ui,sans-serif",
        zoom: kdsZoom,
        height: `${(100 / kdsZoom).toFixed(3)}dvh`,
        width: `${(100 / kdsZoom).toFixed(3)}vw`,
        background: theme.bg,
      }}>

      {/* ── Ping flash overlay ───────────────────────────────────────────── */}
      {pingActive && (
        <div className="fixed inset-0 z-[999] pointer-events-none flex items-center justify-center"
          style={{ animation: "pingFlash 1.6s ease forwards" }}>
          <div className="absolute inset-0" style={{ border: "3px solid rgba(34,197,94,0.9)", boxShadow: "inset 0 0 60px rgba(34,197,94,0.25), 0 0 60px rgba(34,197,94,0.3)" }} />
          <div className="relative flex flex-col items-center gap-2"
            style={{ background: "rgba(10,10,11,0.75)", border: "1px solid rgba(34,197,94,0.5)", borderRadius: 12, padding: "10px 22px", boxShadow: "0 0 24px rgba(34,197,94,0.3)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#4ade80", textTransform: "uppercase" }}>● PING</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{getKdsDeviceId()}</span>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="h-14 flex items-center justify-between px-5 border-b shrink-0" style={{ background: theme.bg, borderColor: theme.line }}>
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
          {cfg.mode === "multi" ? (
            stationTabs.map(tab => {
              const active = activeTab === tab.id;
              const count  = tab.id === "All"
                ? allOrders.length
                : allOrders.filter(o => o.items.some(it => it.stationId === tab.id)).length;
              return (
                <button key={tab.id} onClick={() => setTab(tab.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap shrink-0"
                  style={active
                    ? { background: tab.color, color: tab.id === "All" ? "#000" : "#fff" }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.78)" }}>
                  {!active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: tab.color }} />}
                  {tab.label}
                  {count > 0 && (
                    <span
                      className="text-[10px] font-black tabular-nums leading-none px-1 py-0.5 rounded-full"
                      style={active
                        ? { background: "rgba(0,0,0,0.22)", color: tab.id === "All" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)" }
                        : { background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.65)" }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
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

        <div className="flex items-center gap-4 shrink-0 ml-4">
          <Clock />
          <span className="text-[11px]" style={{ color: theme.subtle }}>
            <span className="text-white font-semibold">{visibleOrders.length}</span> orders ·{" "}
            <span style={{ color: doneTotal === itemTotal && itemTotal > 0 ? "#22c55e" : "rgba(255,255,255,0.45)" }}>
              {doneTotal}/{itemTotal}
            </span> items
          </span>

          {/* Quick column control (multi mode only) */}
          {cfg.mode === "multi" && (
            <div className="flex items-center rounded-lg border overflow-hidden shrink-0"
              style={{ borderColor: "rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)" }}>
              <button
                onClick={() => setCfg(c => ({ ...c, numCols: Math.max(2, c.numCols - 1) }))}
                disabled={cfg.numCols <= 2}
                className="w-6 h-6 flex items-center justify-center text-[13px] font-bold transition-all hover:bg-white/[0.08] disabled:opacity-30"
                style={{ color: "rgba(255,255,255,0.55)" }}
                title="Fewer columns">−</button>
              <span className="text-[11px] font-bold tabular-nums px-1"
                style={{ color: "rgba(255,255,255,0.65)" }}>{cfg.numCols}</span>
              <button
                onClick={() => setCfg(c => ({ ...c, numCols: Math.min(6, c.numCols + 1) }))}
                disabled={cfg.numCols >= 6}
                className="w-6 h-6 flex items-center justify-center text-[13px] font-bold transition-all hover:bg-white/[0.08] disabled:opacity-30"
                style={{ color: "rgba(255,255,255,0.55)" }}
                title="More columns">+</button>
            </div>
          )}

          {/* Test inject */}
          {testOrdersEnabled && (
            <button
              onClick={() => { setShowInjectPanel(s => !s); setShowSettings(false); setShowQuickSettings(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition-all disabled:opacity-40"
              style={{
                background: showInjectPanel ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.04)",
                borderColor: showInjectPanel ? "rgba(245,158,11,0.38)" : "rgba(255,255,255,0.1)",
                color: showInjectPanel ? "#f59e0b" : "rgba(255,255,255,0.45)",
              }}
              title="Open test order injector">
              <FlaskConical style={{ width: 13, height: 13 }} />
              Test
            </button>
          )}

          {/* Fullscreen toggle */}
          <button onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.38)" }}
            title={isFullscreen ? "Exit fullscreen (F4)" : "Enter fullscreen"}>
            {isFullscreen
              ? <Minimize2 style={{ width: 13, height: 13 }} />
              : <Maximize2 style={{ width: 13, height: 13 }} />}
          </button>

          {/* Settings gear */}
          <button onClick={() => setShowSettings(s => !s)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: showSettings ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", color: showSettings ? "#f59e0b" : "rgba(255,255,255,0.38)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Order grid ──────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col">
        {visibleOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center flex flex-col items-center gap-3">
              <div className="text-4xl mb-1 text-white/10">✓</div>
              <p className="text-white/20 text-sm">All clear — kitchen idle</p>
              {testOrdersEnabled && (
                <button onClick={() => setShowInjectPanel(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.1] text-xs font-semibold text-white/40 hover:text-white/60 hover:border-white/[0.2] transition-all mt-1"
                  style={{ background: "rgba(255,255,255,0.03)" }}>
                  <FlaskConical style={{ width: 13, height: 13 }} />
                  Inject a test order
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cfg.numCols},minmax(0,1fr))`,
            gridAutoRows: "1fr",
            gap: DENSITY_GAP[cfg.density],
            alignItems: "stretch",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
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
                onHold={() => toggleHold(order.id)}
                isHeld={heldOrders.has(order.id)}
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
          <span className="text-[11px] text-white/65 uppercase tracking-widest shrink-0 font-semibold">Stats</span>
          <div className="flex gap-4 flex-wrap">
            <span className="text-[12px]">
              <span className="text-white/65">Min </span>
              <span className="font-mono text-white/70">{fmtSec(statsMin)}</span>
            </span>
            <span className="text-[12px]">
              <span className="text-white/65">Avg </span>
              <span className="font-mono text-white/70">{fmtSec(statsAvg)}</span>
            </span>
            <span className="text-[12px]">
              <span className="text-white/65">Max </span>
              <span className="font-mono font-bold"
                style={{ color: statsMax >= ALERT_SEC ? "#f87171" : statsMax >= WARN_SEC ? "#f59e0b" : "rgba(255,255,255,0.70)" }}>
                {fmtSec(statsMax)}
              </span>
            </span>
          </div>
          {(warnCount > 0 || alertCount > 0) && (
            <div className="flex items-center gap-3 ml-1">
              {warnCount > 0 && (
                <span className="flex items-center gap-1 text-[12px]" style={{ color: "#f59e0b" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  {warnCount} late
                </span>
              )}
              {alertCount > 0 && (
                <span className="flex items-center gap-1 text-[12px]" style={{ color: "#f87171" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  {alertCount} critical
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Age Heatmap strip ────────────────────────────────────────────── */}
      {cfg.showAgeHeatmap && visibleOrders.length > 0 && (() => {
        const sorted = [...visibleOrders].sort((a, b) => b.elapsedSec - a.elapsedSec);
        return (
          <div className="mx-4 mb-2 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
              <span className="text-[10px] font-bold uppercase tracking-widest shrink-0"
                style={{ color: "rgba(255,255,255,0.3)" }}>Age</span>
              {sorted.map(order => {
                const sec = order.elapsedSec;
                const { warnSec: hWarn, alertSec: hAlert } = getOrderThresholds(order, cfg);
                const color = sec >= hAlert ? "#f87171" : sec >= hWarn ? "#f59e0b" : "#4ade80";
                const bg = sec >= hAlert ? "rgba(239,68,68,0.12)" : sec >= hWarn ? "rgba(245,158,11,0.12)" : "rgba(74,222,128,0.10)";
                const border = sec >= hAlert ? "rgba(239,68,68,0.35)" : sec >= hWarn ? "rgba(245,158,11,0.35)" : "rgba(74,222,128,0.25)";
                const isFocused = focusedOrder?.id === order.id;
                return (
                  <button
                    key={order.id}
                    onClick={() => setFocus(order.id)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md border shrink-0 transition-all"
                    style={{
                      background: isFocused ? "rgba(255,255,255,0.12)" : bg,
                      borderColor: isFocused ? "rgba(255,255,255,0.35)" : border,
                      color,
                      outline: isFocused ? "1px solid rgba(255,255,255,0.25)" : "none",
                      outlineOffset: 1,
                    }}
                    title={`Order #${order.number} — ${fmtSec(sec)} old`}>
                    <span className="text-[10px] font-bold">#{order.number}</span>
                    <span className="text-[10px] font-mono opacity-80">{fmtSec(sec)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Now Serving strip (all modes) ────────────────────────────────── */}
      {cfg.showNowServing && nowServingOrders.length > 0 && (
        <div className="mx-3 mb-2 rounded-xl overflow-hidden shrink-0"
          style={{
            background: "linear-gradient(135deg,rgba(22,101,52,0.18) 0%,rgba(20,83,45,0.10) 100%)",
            border: "1px solid rgba(34,197,94,0.2)",
            boxShadow: "0 0 0 1px rgba(34,197,94,0.04),inset 0 1px 0 rgba(34,197,94,0.1)",
          }}>
          <div style={{ height: 2, background: "linear-gradient(90deg,rgba(74,222,128,0.9) 0%,rgba(74,222,128,0.18) 55%,transparent 100%)" }} />
          <div className="flex items-center gap-3 px-3 py-2">
            {/* Label */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full"
                style={{ background: "#4ade80", animation: "pulse 1.2s ease-in-out infinite", boxShadow: "0 0 7px rgba(74,222,128,0.7)" }} />
              <span className="text-[12px] font-black uppercase tracking-[0.18em]" style={{ color: "#86efac" }}>Now Serving</span>
            </div>
            <div className="w-px self-stretch bg-white/[0.07] shrink-0" />
            {/* Chips */}
            <div className="flex-1 flex gap-1.5 flex-wrap items-center min-w-0">
              {nowServingOrders.map(ns => {
                const secAgo = Math.floor((Date.now() - ns.firedAt) / 1000);
                const pct    = Math.min(secAgo / cfgRef.current.nowServingExpirySec, 1);
                const barClr = pct > 0.72 ? "rgba(239,68,68,0.55)" : pct > 0.42 ? "rgba(245,158,11,0.55)" : "rgba(74,222,128,0.45)";
                return (
                  <div key={ns.order.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg relative overflow-hidden"
                    style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.18)" }}>
                    {/* Countdown bar */}
                    <div className="absolute bottom-0 left-0 h-[2px]"
                      style={{ width: `${(1 - pct) * 100}%`, background: barClr, transition: "width 1s linear,background 1s linear" }} />
                    <span className="text-[13px] font-black tabular-nums" style={{ color: "#ffffff" }}>
                      #{ns.order.number}
                    </span>
                    {ns.order.customer && (
                      <span className="text-[11px] font-semibold" style={{ color: "#86efac" }}>
                        {ns.order.customer}
                      </span>
                    )}
                    <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.72)" }}>
                      {fmtSec(secAgo)}
                    </span>
                    <button onClick={() => recallOrder(ns.order.id)}
                      className="flex items-center justify-center w-4 h-4 rounded transition-all hover:bg-white/10"
                      style={{ color: "rgba(134,239,172,0.9)", fontSize: 11, fontWeight: 700 }}
                      title="Recall — reopen this order">↩</button>
                  </div>
                );
              })}
            </div>
            {/* Clear button */}
            <button onClick={() => setNowServing([])}
              className="shrink-0 h-7 px-2.5 rounded-lg text-[11px] font-bold border transition-all hover:bg-white/[0.08]"
              style={{ borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.82)", background: "rgba(255,255,255,0.05)" }}
              title="Clear all (C)">
              ✕ Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Recent bumped (recall tray) ──────────────────────────────────── */}
      {(() => {
        const activeIds = new Set(nowServingOrders.map(ns => ns.order.id));
        const recallable = recentBumped.filter(r => !activeIds.has(r.order.id));
        if (!cfg.showRecentBumped || recallable.length === 0) return null;
        return (
          <div className="mx-3 mb-2 rounded-xl overflow-hidden shrink-0"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.75)" }}>Recent</span>
              </div>
              <div className="w-px self-stretch bg-white/[0.07] shrink-0" />
              <div className="flex-1 flex gap-1.5 flex-wrap items-center min-w-0">
                {recallable.map(r => (
                  <div key={r.order.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
                    <span className="text-[12px] font-black tabular-nums" style={{ color: "rgba(255,255,255,0.85)" }}>
                      #{r.order.number}
                    </span>
                    {r.order.customer && (
                      <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.72)" }}>
                        {r.order.customer}
                      </span>
                    )}
                    <button onClick={() => recallOrder(r.order.id)}
                      className="flex items-center justify-center w-5 h-5 rounded transition-all hover:bg-white/10"
                      style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700 }}
                      title="Recall this order">↩</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setRecentBumped([])}
                className="shrink-0 h-6 px-2 rounded-lg text-[11px] font-bold border transition-all hover:bg-white/[0.06]"
                style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }}
                title="Clear recent">
                ✕
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Footer bump bar ──────────────────────────────────────────────── */}
      {cfg.showFooter && (
        <footer className="min-h-14 flex items-center px-4 md:px-5 py-2 shrink-0 gap-4 md:gap-6 flex-wrap" style={{ background: theme.bg, borderTop: `1px solid ${theme.line}` }}>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(() => {
              const bk = cfg.bumpKey === " " ? "SPACE" : cfg.bumpKey.length > 3 ? cfg.bumpKey : cfg.bumpKey.toUpperCase();
              const pk = cfg.prevKey === "ArrowLeft" ? "←" : cfg.prevKey;
              const nk = cfg.nextKey === "ArrowRight" ? "→" : cfg.nextKey;
              const hints: { keys: string[]; label: string }[] = [
                { keys: [bk], label: cfg.mode === "expo" ? "Fire" : "Bump" },
                { keys: ["R"], label: "Refresh" },
                { keys: [pk, nk], label: "Navigate" },
              ];
              if (cfg.showNowServing && nowServingOrders.length > 0) hints.push({ keys: ["C"], label: "Clear Served" });
              if (cfg.recallKey) {
                const rk = cfg.recallKey === "Backspace" ? "⌫" : cfg.recallKey.length > 3 ? cfg.recallKey : cfg.recallKey.toUpperCase();
                hints.push({ keys: [rk], label: "Recall" });
              }
              hints.push({ keys: ["H"], label: "Hold" });
              return hints;
            })().map(({ keys, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="flex gap-1">
                  {keys.map(k => (
                    <kbd key={k} className="font-mono text-[12px] font-bold px-2.5 py-1 rounded border border-white/[0.22] bg-white/[0.10] text-white/90">{k}</kbd>
                  ))}
                </div>
                <span className="text-[12px] text-white/80 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {sessionBumps > 0 && (
              <span className="text-[12px] text-white/70">
                <span className="font-semibold text-white/85">{sessionBumps}</span> order{sessionBumps !== 1 ? "s" : ""} bumped
              </span>
            )}
            {heldOrders.size > 0 && (
              <span className="text-[12px] font-semibold" style={{ color: "#fbbf24" }}>
                ⏸ {heldOrders.size} on hold
              </span>
            )}
            {doneTotal > 0 && (
              <span className="text-[12px] text-white/50">· {doneTotal} item{doneTotal !== 1 ? "s" : ""} done</span>
            )}
            {allOrders.length > 0 && (
              <div className="flex items-center gap-2">
                {alertCount > 0 && (
                  <span className="flex items-center gap-1 text-[12px] font-bold" style={{ color: "#f87171", animation: "pulse 1s ease-in-out infinite" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    {alertCount} crit
                  </span>
                )}
                {warnCount > 0 && (
                  <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: "#f59e0b" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    {warnCount} late
                  </span>
                )}
                {alertCount === 0 && warnCount === 0 && (
                  <span className="text-[12px] font-medium" style={{ color: "rgba(74,222,128,0.62)" }}>✓ On time</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 border-l border-white/[0.07] pl-4">
            <span className="hidden lg:inline text-[11px] uppercase tracking-wider text-white/55">Bump bar</span>
            <button
              onClick={() => setCfg(c => ({ ...c, bumpBarEnabled: !c.bumpBarEnabled }))}
              className="h-8 px-3 rounded-lg text-[11px] font-bold border transition-all active:scale-95"
              style={{ background: cfg.bumpBarEnabled ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.05)", borderColor: cfg.bumpBarEnabled ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.08)", color: cfg.bumpBarEnabled ? "#f59e0b" : "rgba(255,255,255,0.72)" }}>
              {cfg.bumpBarEnabled ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setCfg(c => ({ ...c, showVirtualBumpBar: !c.showVirtualBumpBar }))}
              className="h-8 px-3 rounded-lg text-[11px] font-bold border transition-all active:scale-95"
              style={{ background: cfg.showVirtualBumpBar ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.05)", borderColor: cfg.showVirtualBumpBar ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.08)", color: cfg.showVirtualBumpBar ? "#f59e0b" : "rgba(255,255,255,0.72)" }}>
              Virtual
            </button>
            <button
              onClick={() => {
                const activeIds = new Set(nowServingOrders.map(ns => ns.order.id));
                const last = recentBumped.find(r => !activeIds.has(r.order.id));
                if (last) recallOrder(last.order.id);
              }}
              disabled={recentBumped.every(r => nowServingOrders.some(ns => ns.order.id === r.order.id))}
              className="h-8 px-3 rounded-lg text-[11px] font-bold border transition-all active:scale-95"
              style={{ background: "rgba(74,222,128,0.07)", borderColor: "rgba(74,222,128,0.2)", color: "rgba(74,222,128,0.88)" }}>
              Recall last
            </button>
            <button
              onClick={() => setCfg(c => ({ ...c, showFooter: false }))}
              className="h-8 px-2.5 rounded-lg text-[12px] border transition-all hover:bg-white/[0.06]"
              style={{ borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.58)" }}
              title="Hide footer bar">Hide</button>
          </div>
        </footer>
      )}

      {/* ── Virtual Bump Bar ─────────────────────────────────────────────── */}
      {cfg.showVirtualBumpBar && (() => {
        const idx          = navigableOrders.findIndex(o => o.id === focusedId);
        const activeIds    = new Set(nowServingOrders.map(ns => ns.order.id));
        const recallable   = recentBumped.filter(r => !activeIds.has(r.order.id));
        const lastRecall   = recallable[0]?.order ?? null;
        return (
          <VirtualBumpBar
            focusedOrder={focusedOrder}
            canPrev={idx > 0}
            canNext={idx < navigableOrders.length - 1}
            canRecall={recallable.length > 0}
            lastRecallable={lastRecall}
            onPrev={() => setFocus(navigableOrders[Math.max(idx - 1, 0)]?.id ?? null)}
            onNext={() => setFocus(navigableOrders[Math.min(idx + 1, navigableOrders.length - 1)]?.id ?? null)}
            onBump={() => focusedOrder && bump(focusedOrder.id)}
            onRecall={() => lastRecall && recallOrder(lastRecall.id)}
            bottomOffset={cfg.showFooter ? 68 : 16}
          />
        );
      })()}

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      {showSettings      && <SettingsOverlay cfg={cfg} setCfg={setCfg} onClose={() => setShowSettings(false)} playChime={playChime} />}
      {showQuickSettings && <QuickSettingsPanel cfg={cfg} setCfg={setCfg} onClose={() => setShowQuickSettings(false)} focusedOrder={focusedOrder} onBumpFocused={() => focusedOrder && bump(focusedOrder.id)} recentBumped={recentBumped} nowServingOrders={nowServingOrders} recallOrder={recallOrder} />}
      {bumpToast         && <BumpToast number={bumpToast.number} onDone={() => setBumpToast(null)} />}
      {showInjectPanel && storeId && (
        <InjectOrderPanel
          storeId={storeId}
          onClose={() => setShowInjectPanel(false)}
          onFired={() => queryClient.invalidateQueries({ queryKey: ["/api/orders"] })}
        />
      )}

      {/* ── Quick Settings FAB ────────────────────────────────────────────── */}
      <button
        onClick={() => { setShowQuickSettings(s => !s); setShowSettings(false); }}
        className="absolute z-30 w-8 h-8 rounded-full flex items-center justify-center border shadow-lg transition-all"
        style={{
          bottom: cfg.showFooter ? 64 : 16,
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
        @keyframes pingFlash   { 0%{opacity:0} 8%{opacity:1} 70%{opacity:1} 100%{opacity:0} }
        @keyframes vbbSlideUp  { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      `}</style>
    </div>
    </ModColorCtx.Provider>
  );
}
