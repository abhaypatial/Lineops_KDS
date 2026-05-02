import React, { useState } from "react";

type Priority = "normal" | "rush" | "vip";

type OrderItem = {
  id: string;
  name: string;
  qty: number;
  mods: string[];
  station: string;
  orderId: string;
  orderNum: string;
  table: string;
  priority: Priority;
  elapsedSec: number;
  done: boolean;
};

const STATIONS = [
  { id: "grill",   label: "Grill",     color: "#ef4444", bg: "#1a0e0e" },
  { id: "cold",    label: "Cold Prep", color: "#3b82f6", bg: "#0c0f1a" },
  { id: "fryer",   label: "Fryer",     color: "#f59e0b", bg: "#1a1406" },
  { id: "dessert", label: "Dessert",   color: "#a855f7", bg: "#130d1a" },
];

const ALL_ITEMS: OrderItem[] = [
  // Order 101 — RUSH
  { id: "1a", name: "Smash Burger",    qty: 1, mods: ["No onions", "Extra cheese"], station: "grill",   orderId: "1", orderNum: "101", table: "Table 5",   priority: "rush",   elapsedSec: 932, done: false },
  { id: "1b", name: "Truffle Fries",   qty: 1, mods: ["Light salt"],                station: "fryer",   orderId: "1", orderNum: "101", table: "Table 5",   priority: "rush",   elapsedSec: 932, done: false },
  // Order 105 — normal
  { id: "2a", name: "BBQ Ribs",        qty: 1, mods: ["Extra sauce"],               station: "grill",   orderId: "2", orderNum: "105", table: "Table 7",   priority: "normal", elapsedSec: 487, done: false },
  { id: "2b", name: "Coleslaw",        qty: 1, mods: [],                            station: "cold",    orderId: "2", orderNum: "105", table: "Table 7",   priority: "normal", elapsedSec: 487, done: false },
  { id: "2c", name: "Onion Rings",     qty: 1, mods: [],                            station: "fryer",   orderId: "2", orderNum: "105", table: "Table 7",   priority: "normal", elapsedSec: 487, done: false },
  // Order 108 — normal
  { id: "3a", name: "Caesar Salad",    qty: 2, mods: ["Dressing on side"],          station: "cold",    orderId: "3", orderNum: "108", table: "Bar 3",     priority: "normal", elapsedSec: 271, done: false },
  { id: "3b", name: "Grilled Chicken", qty: 1, mods: [],                            station: "grill",   orderId: "3", orderNum: "108", table: "Bar 3",     priority: "normal", elapsedSec: 271, done: false },
  // Order 109 — VIP
  { id: "4a", name: "NY Strip",        qty: 1, mods: ["Medium rare", "No sauce"],   station: "grill",   orderId: "4", orderNum: "109", table: "To Go #12", priority: "vip",    elapsedSec: 145, done: false },
  { id: "4b", name: "Crème Brûlée",    qty: 1, mods: [],                            station: "dessert", orderId: "4", orderNum: "109", table: "To Go #12", priority: "vip",    elapsedSec: 145, done: false },
  // Order 112 — normal
  { id: "5a", name: "Fish & Chips",    qty: 2, mods: [],                            station: "fryer",   orderId: "5", orderNum: "112", table: "Table 2",   priority: "normal", elapsedSec: 62,  done: false },
];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function priorityRank(p: Priority) {
  return p === "rush" ? 0 : p === "vip" ? 1 : 2;
}

export function StationBoard() {
  const [items, setItems] = useState(ALL_ITEMS);

  function toggleDone(id: string) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, done: !it.done } : it));
  }

  const pending = items.filter(it => !it.done);
  const totalOrders = new Set(pending.map(it => it.orderId)).size;

  return (
    <div
      className="h-screen bg-[#08080b] flex flex-col select-none"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Header */}
      <header className="h-11 flex items-center px-4 border-b border-white/[0.06] shrink-0 bg-[#0d0d12]">
        <span className="text-white/40 text-xs font-semibold tracking-[0.2em] uppercase">Station Board</span>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-white/30 text-xs">{totalOrders} orders · {pending.length} items pending</span>
        </div>
      </header>

      {/* Station columns */}
      <div className="flex-1 flex overflow-hidden divide-x divide-white/[0.05]">
        {STATIONS.map(station => {
          const stItems = pending
            .filter(it => it.station === station.id)
            .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.elapsedSec - a.elapsedSec);

          return (
            <div
              key={station.id}
              className="flex-1 flex flex-col min-w-0 overflow-hidden"
              style={{ background: stItems.length > 0 ? station.bg : "#08080b" }}
            >
              {/* Station header */}
              <div
                className="h-10 flex items-center px-3 shrink-0 border-b"
                style={{ borderColor: `${station.color}40`, background: `${station.color}15` }}
              >
                <span
                  className="w-2 h-2 rounded-full mr-2 shrink-0"
                  style={{ background: station.color, boxShadow: `0 0 6px ${station.color}` }}
                />
                <span className="font-bold text-sm uppercase tracking-wide" style={{ color: station.color }}>
                  {station.label}
                </span>
                <span
                  className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${station.color}25`, color: station.color }}
                >
                  {stItems.length}
                </span>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
                {stItems.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-white/10 text-xs tracking-wider uppercase">Clear</p>
                  </div>
                )}
                {stItems.map(item => {
                  const isRush = item.priority === "rush";
                  const isVip = item.priority === "vip";
                  const isLate = item.elapsedSec > 480;

                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleDone(item.id)}
                      className="w-full text-left rounded-md px-3 py-2.5 transition-all active:scale-[0.98]"
                      style={{
                        background: isRush
                          ? "rgba(239,68,68,0.12)"
                          : isVip
                          ? "rgba(245,158,11,0.08)"
                          : "rgba(255,255,255,0.04)",
                        border: isRush
                          ? "1px solid rgba(239,68,68,0.35)"
                          : isVip
                          ? "1px solid rgba(245,158,11,0.25)"
                          : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {/* Order tag row */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-bold text-white/60">#{item.orderNum}</span>
                        <span className="text-[10px] text-white/30">·</span>
                        <span className="text-[10px] text-white/40">{item.table}</span>
                        {isRush && (
                          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">RUSH</span>
                        )}
                        {isVip && (
                          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">VIP</span>
                        )}
                        <span
                          className="text-[10px] font-mono ml-auto"
                          style={{ color: isLate ? "#ef4444" : isRush ? "#ef4444" : "#6b7280" }}
                        >
                          {fmt(item.elapsedSec)}
                        </span>
                      </div>

                      {/* Item */}
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-bold text-white/40 shrink-0">{item.qty}×</span>
                        <span className="text-sm font-semibold text-white leading-snug">{item.name}</span>
                      </div>
                      {item.mods.length > 0 && (
                        <div className="mt-1 flex flex-col gap-0.5">
                          {item.mods.map(m => (
                            <span key={m} className="text-[10px] text-white/35 pl-5">— {m}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="h-9 bg-[#0d0d12] border-t border-white/[0.06] flex items-center px-4 gap-2 shrink-0">
        <span className="text-white/20 text-[10px] tracking-wider uppercase">Tap item to mark done</span>
        <div className="ml-auto flex items-center gap-3">
          {items.filter(it => it.done).length > 0 && (
            <span className="text-white/20 text-xs">{items.filter(it => it.done).length} completed</span>
          )}
          <span className="text-[10px] text-white/15">Items are cross-order — organized by station</span>
        </div>
      </footer>
    </div>
  );
}
