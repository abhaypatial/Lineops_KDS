import React, { useState } from "react";

type Mod = string;
type Item = { id: string; name: string; qty: number; mods: Mod[] };
type Priority = "normal" | "rush" | "vip";

type Ticket = {
  id: string;
  number: string;
  table: string;
  priority: Priority;
  elapsedSec: number;
  items: Item[];
};

const INITIAL: Ticket[] = [
  {
    id: "1", number: "101", table: "Table 5", priority: "rush", elapsedSec: 932,
    items: [
      { id: "a", name: "Smash Burger", qty: 1, mods: ["No onions", "Extra cheese"] },
      { id: "b", name: "Truffle Fries", qty: 1, mods: ["Light salt"] },
    ],
  },
  {
    id: "2", number: "105", table: "Table 7", priority: "normal", elapsedSec: 487,
    items: [
      { id: "c", name: "BBQ Ribs", qty: 1, mods: ["Extra sauce"] },
      { id: "d", name: "Coleslaw", qty: 1, mods: [] },
      { id: "e", name: "Onion Rings", qty: 1, mods: [] },
    ],
  },
  {
    id: "3", number: "108", table: "Bar 3", priority: "normal", elapsedSec: 271,
    items: [
      { id: "f", name: "Caesar Salad", qty: 2, mods: ["Dressing on side"] },
      { id: "g", name: "Grilled Chicken", qty: 1, mods: [] },
    ],
  },
  {
    id: "4", number: "109", table: "To Go #12", priority: "vip", elapsedSec: 145,
    items: [
      { id: "h", name: "NY Strip", qty: 1, mods: ["Medium rare", "No sauce"] },
      { id: "i", name: "Crème Brûlée", qty: 1, mods: [] },
    ],
  },
  {
    id: "5", number: "112", table: "Table 2", priority: "normal", elapsedSec: 62,
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

function timeColor(sec: number, priority: Priority) {
  if (priority === "rush") return "#ef4444";
  if (priority === "vip") return "#f59e0b";
  if (sec > 600) return "#ef4444";
  if (sec > 360) return "#f59e0b";
  return "#6b7280";
}

const PRIORITY_LABEL: Record<Priority, string | null> = { rush: "RUSH", vip: "VIP", normal: null };
const PRIORITY_COLOR: Record<Priority, string> = { rush: "#ef4444", vip: "#f59e0b", normal: "transparent" };

export function TicketRail() {
  const [tickets, setTickets] = useState(INITIAL);
  const [focused, setFocused] = useState(0);

  function bump() {
    setTickets(prev => prev.filter((_, i) => i !== focused));
    setFocused(f => Math.max(0, f - 1));
  }

  const focusedTicket = tickets[focused] ?? null;
  const sideTickets = tickets.filter((_, i) => i !== focused);

  return (
    <div
      className="h-screen bg-[#08080b] flex flex-col select-none overflow-hidden"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Top bar */}
      <header className="h-11 flex items-center px-4 border-b border-white/[0.06] shrink-0 bg-[#0d0d12]">
        <span className="text-white/40 text-xs font-semibold tracking-[0.2em] uppercase">Ticket Rail</span>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-white/30 text-xs">{tickets.length} tickets</span>
          <span className="text-[10px] text-white/20 tracking-wider uppercase">← older · newer →</span>
        </div>
      </header>

      {/* Rail */}
      <div className="flex-1 flex overflow-hidden p-4 gap-3">
        {tickets.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/20 text-lg font-medium tracking-wide">All clear — kitchen idle</p>
          </div>
        )}

        {tickets.map((ticket, i) => {
          const isFocused = i === focused;
          const age = ticket.elapsedSec;
          const pColor = PRIORITY_COLOR[ticket.priority];
          const tColor = timeColor(age, ticket.priority);
          const label = PRIORITY_LABEL[ticket.priority];

          if (isFocused) {
            return (
              <div
                key={ticket.id}
                onClick={() => setFocused(i)}
                className="relative flex flex-col shrink-0 rounded-lg overflow-hidden cursor-pointer"
                style={{
                  width: 320,
                  background: "#13131a",
                  border: `1.5px solid ${pColor !== "transparent" ? pColor : "rgba(255,255,255,0.12)"}`,
                  boxShadow: pColor !== "transparent" ? `0 0 32px ${pColor}22` : "none",
                }}
              >
                {/* top priority stripe */}
                <div style={{ height: 3, background: pColor !== "transparent" ? pColor : "rgba(255,255,255,0.08)" }} />

                <div className="p-4 flex flex-col flex-1">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-white/40 text-[10px] font-semibold tracking-[0.15em] uppercase">{ticket.table}</p>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-white font-bold text-4xl leading-none">#{ticket.number}</span>
                        {label && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: pColor, color: "#fff" }}>{label}</span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-2xl leading-none mt-1" style={{ color: tColor }}>{fmt(age)}</span>
                  </div>

                  <div className="mt-4 border-t border-white/[0.07] pt-3 flex flex-col gap-3">
                    {ticket.items.map(item => (
                      <div key={item.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white/50 w-5 shrink-0">{item.qty}×</span>
                          <span className="text-white font-semibold text-sm leading-tight">{item.name}</span>
                        </div>
                        {item.mods.map(m => (
                          <p key={m} className="text-white/40 text-xs pl-7 mt-0.5">— {m}</p>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-4">
                    <div className="text-[10px] text-white/20 text-center tracking-wider">FOCUSED</div>
                  </div>
                </div>
              </div>
            );
          }

          // Side ticket — narrower strip, proportionally sized by recency
          const relativeAge = 1 - i / tickets.length;
          const stripW = Math.round(80 + relativeAge * 60); // 80–140px

          return (
            <div
              key={ticket.id}
              onClick={() => setFocused(i)}
              className="relative flex flex-col shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all"
              style={{
                width: stripW,
                background: "#0f0f14",
                border: "1px solid rgba(255,255,255,0.06)",
                opacity: 0.6 + relativeAge * 0.3,
              }}
            >
              <div style={{ height: 2, background: pColor !== "transparent" ? pColor : "rgba(255,255,255,0.05)" }} />
              <div className="p-2 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-white font-bold text-base">#{ticket.number}</span>
                  {label && (
                    <span className="text-[8px] font-bold px-1 rounded" style={{ background: pColor, color: "#fff" }}>{label}</span>
                  )}
                </div>
                <span className="font-mono text-xs" style={{ color: tColor }}>{fmt(age)}</span>
                <div className="border-t border-white/[0.05] pt-1 flex flex-col gap-1">
                  {ticket.items.map(item => (
                    <p key={item.id} className="text-white/40 text-[10px] truncate">{item.qty}× {item.name}</p>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time axis labels */}
      <div className="px-4 pb-1 flex items-center">
        <div className="text-[10px] text-white/15 tracking-widest uppercase">← longest waiting</div>
        <div className="ml-auto text-[10px] text-white/15 tracking-widest uppercase">just arrived →</div>
      </div>

      {/* Footer */}
      <footer className="h-10 bg-[#0d0d12] border-t border-white/[0.06] flex items-center px-4 gap-6 shrink-0">
        <button onClick={bump} className="flex items-center gap-2">
          <kbd className="bg-white/10 text-white/60 text-[10px] font-bold px-2 py-0.5 rounded border border-white/10">SPACE</kbd>
          <span className="text-white/40 text-xs">Bump</span>
        </button>
        <div className="flex items-center gap-2">
          <kbd className="bg-white/10 text-white/60 text-[10px] font-bold px-2 py-0.5 rounded border border-white/10">← →</kbd>
          <span className="text-white/40 text-xs">Navigate rail</span>
        </div>
        <div className="ml-auto text-white/20 text-xs">{focused + 1} / {tickets.length}</div>
      </footer>
    </div>
  );
}
