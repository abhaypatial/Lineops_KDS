import React, { useState } from "react";

type Priority = "normal" | "rush" | "vip";

type Ticket = {
  id: string;
  number: string;
  table: string;
  type: string;
  priority: Priority;
  elapsedSec: number;
  items: { id: string; name: string; qty: number; mods: string[] }[];
};

function urgencyScore(t: Ticket) {
  const pScore = t.priority === "rush" ? 0 : t.priority === "vip" ? 1 : 2;
  return pScore * 100000 - t.elapsedSec;
}

const INITIAL: Ticket[] = [
  {
    id: "1", number: "101", table: "Table 5", type: "Dine-in", priority: "rush", elapsedSec: 932,
    items: [
      { id: "a", name: "Smash Burger", qty: 1, mods: ["No onions", "Extra cheese"] },
      { id: "b", name: "Truffle Fries", qty: 1, mods: ["Light salt"] },
    ],
  },
  {
    id: "2", number: "105", table: "Table 7", type: "Dine-in", priority: "normal", elapsedSec: 487,
    items: [
      { id: "c", name: "BBQ Ribs", qty: 1, mods: ["Extra sauce"] },
      { id: "d", name: "Coleslaw", qty: 1, mods: [] },
      { id: "e", name: "Onion Rings", qty: 1, mods: [] },
    ],
  },
  {
    id: "3", number: "108", table: "Bar 3", type: "Bar", priority: "normal", elapsedSec: 271,
    items: [
      { id: "f", name: "Caesar Salad", qty: 2, mods: ["Dressing on side"] },
      { id: "g", name: "Grilled Chicken", qty: 1, mods: [] },
    ],
  },
  {
    id: "4", number: "109", table: "To Go #12", type: "Takeout", priority: "vip", elapsedSec: 145,
    items: [
      { id: "h", name: "NY Strip", qty: 1, mods: ["Medium rare", "No sauce"] },
      { id: "i", name: "Crème Brûlée", qty: 1, mods: [] },
    ],
  },
  {
    id: "5", number: "112", table: "Table 2", type: "Dine-in", priority: "normal", elapsedSec: 62,
    items: [
      { id: "j", name: "Fish & Chips", qty: 2, mods: [] },
    ],
  },
];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const PRIORITY_COLOR: Record<Priority, string> = { rush: "#ef4444", vip: "#f59e0b", normal: "#22c55e" };
const PRIORITY_LABEL: Record<Priority, string | null> = { rush: "RUSH", vip: "VIP", normal: null };

function timeColor(sec: number, p: Priority) {
  if (p === "rush") return "#ef4444";
  if (p === "vip") return "#f59e0b";
  if (sec > 600) return "#ef4444";
  if (sec > 360) return "#f59e0b";
  return "#4ade80";
}

export function Spotlight() {
  const [tickets, setTickets] = useState(() => [...INITIAL].sort((a, b) => urgencyScore(a) - urgencyScore(b)));
  const [selected, setSelected] = useState(0);

  function bump() {
    const next = tickets.filter((_, i) => i !== selected).sort((a, b) => urgencyScore(a) - urgencyScore(b));
    setTickets(next);
    setSelected(s => Math.max(0, Math.min(s, next.length - 1)));
  }

  const focused = tickets[selected] ?? null;
  const pColor = focused ? PRIORITY_COLOR[focused.priority] : "#22c55e";
  const pLabel = focused ? PRIORITY_LABEL[focused.priority] : null;

  return (
    <div
      className="h-screen bg-[#08080b] flex flex-col select-none"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Header */}
      <header className="h-11 flex items-center px-4 border-b border-white/[0.06] shrink-0 bg-[#0d0d12]">
        <span className="text-white/40 text-xs font-semibold tracking-[0.2em] uppercase">Spotlight</span>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-white/30 text-xs">{tickets.length} pending</span>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Spotlight panel — 62% */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: "62%", borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          {focused ? (
            <div className="flex-1 flex flex-col p-8" style={{ background: focused.priority === "rush" ? "rgba(239,68,68,0.04)" : focused.priority === "vip" ? "rgba(245,158,11,0.03)" : "#0a0a0e" }}>
              {/* Priority stripe */}
              <div
                className="h-1 rounded-full mb-8"
                style={{ background: pColor, width: pLabel ? "100%" : "32px", opacity: pLabel ? 1 : 0.3 }}
              />

              {/* Order meta */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-white/40 text-sm tracking-wide">{focused.table}</span>
                    <span className="text-white/20 text-xs px-2 py-0.5 rounded border border-white/10 uppercase tracking-wider">{focused.type}</span>
                    {pLabel && (
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded uppercase tracking-wider"
                        style={{ background: `${pColor}22`, color: pColor, border: `1px solid ${pColor}44` }}
                      >
                        {pLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-white font-black leading-none" style={{ fontSize: 96, lineHeight: 1, letterSpacing: "-0.04em" }}>
                    #{focused.number}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-white/30 text-xs mb-1 tracking-wider uppercase">Elapsed</p>
                  <span
                    className="font-mono font-black leading-none"
                    style={{ fontSize: 52, lineHeight: 1, color: timeColor(focused.elapsedSec, focused.priority) }}
                  >
                    {fmt(focused.elapsedSec)}
                  </span>
                </div>
              </div>

              {/* Items — very large */}
              <div className="mt-10 flex flex-col gap-5 flex-1">
                {focused.items.map(item => (
                  <div key={item.id} className="border-b border-white/[0.06] pb-4 last:border-0">
                    <div className="flex items-baseline gap-3">
                      <span
                        className="font-bold shrink-0"
                        style={{ fontSize: 28, color: pColor, lineHeight: 1.1 }}
                      >
                        {item.qty}×
                      </span>
                      <span className="font-semibold text-white" style={{ fontSize: 28, lineHeight: 1.1 }}>
                        {item.name}
                      </span>
                    </div>
                    {item.mods.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 pl-12">
                        {item.mods.map(m => (
                          <span
                            key={m}
                            className="text-sm px-2.5 py-0.5 rounded-full border border-white/10 text-white/50"
                            style={{ background: "rgba(255,255,255,0.04)" }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bump button */}
              <button
                onClick={bump}
                className="mt-6 h-14 rounded-xl font-bold text-lg tracking-wide transition-all active:scale-[0.98]"
                style={{
                  background: `${pColor}22`,
                  border: `1.5px solid ${pColor}55`,
                  color: pColor,
                }}
              >
                BUMP — #{focused.number}
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-white/10 text-6xl mb-4">✓</div>
                <p className="text-white/20 text-lg font-medium tracking-wide">All clear</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Queue — 38% */}
        <div className="flex flex-col overflow-hidden" style={{ width: "38%" }}>
          <div className="px-3 py-2 border-b border-white/[0.06] shrink-0">
            <p className="text-white/25 text-[10px] font-semibold tracking-[0.15em] uppercase">Up Next</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tickets.map((ticket, i) => {
              const isFocused = i === selected;
              const tc = timeColor(ticket.elapsedSec, ticket.priority);
              const pc = PRIORITY_COLOR[ticket.priority];
              const pl = PRIORITY_LABEL[ticket.priority];

              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelected(i)}
                  className="w-full text-left border-b border-white/[0.05] px-3 py-3 flex items-start gap-3 transition-all"
                  style={{
                    background: isFocused ? "rgba(255,255,255,0.06)" : "transparent",
                    borderLeft: isFocused ? `2px solid ${pc}` : "2px solid transparent",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-bold text-white text-sm">#{ticket.number}</span>
                      <span className="text-white/30 text-xs">·</span>
                      <span className="text-white/40 text-xs truncate">{ticket.table}</span>
                      {pl && (
                        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: `${pc}22`, color: pc }}>
                          {pl}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ticket.items.map(it => (
                        <span key={it.id} className="text-[10px] text-white/30 bg-white/[0.04] px-1.5 py-0.5 rounded">
                          {it.qty}× {it.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="font-mono text-xs shrink-0 mt-0.5" style={{ color: tc }}>{fmt(ticket.elapsedSec)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="h-10 bg-[#0d0d12] border-t border-white/[0.06] flex items-center px-4 gap-6 shrink-0">
        <button onClick={bump} className="flex items-center gap-2">
          <kbd className="bg-white/10 text-white/60 text-[10px] font-bold px-2 py-0.5 rounded border border-white/10">SPACE</kbd>
          <span className="text-white/40 text-xs">Bump focused order</span>
        </button>
        <div className="flex items-center gap-2">
          <kbd className="bg-white/10 text-white/60 text-[10px] font-bold px-2 py-0.5 rounded border border-white/10">↑ ↓</kbd>
          <span className="text-white/40 text-xs">Select from queue</span>
        </div>
        <div className="ml-auto">
          <span className="text-white/20 text-[10px] tracking-wider">Sorted by urgency · RUSH → VIP → time</span>
        </div>
      </footer>
    </div>
  );
}
