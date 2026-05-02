import React from "react";

type OrderItem = {
  id: string;
  qty: number;
  name: string;
  modifiers?: string[];
};

type Order = {
  id: string;
  number: string;
  customer: string;
  priority: "normal" | "RUSH" | "VIP";
  elapsed: string; // MM:SS
  elapsedMinutes: number;
  items: OrderItem[];
  isFocused?: boolean;
};

const orders: Order[] = [
  {
    id: "1",
    number: "101",
    customer: "Table 5",
    priority: "RUSH",
    elapsed: "15:32",
    elapsedMinutes: 15,
    isFocused: true,
    items: [
      { id: "i1", qty: 1, name: "Smash Burger", modifiers: ["No onions", "Extra cheese"] },
      { id: "i2", qty: 1, name: "Truffle Fries", modifiers: ["Light salt"] },
    ],
  },
  {
    id: "2",
    number: "105",
    customer: "Table 7",
    priority: "normal",
    elapsed: "05:27",
    elapsedMinutes: 5,
    items: [
      { id: "i3", qty: 1, name: "BBQ Ribs", modifiers: ["Extra sauce"] },
      { id: "i4", qty: 1, name: "Coleslaw" },
      { id: "i5", qty: 1, name: "Onion Rings" },
    ],
  },
  {
    id: "3",
    number: "108",
    customer: "Bar 3",
    priority: "normal",
    elapsed: "01:28",
    elapsedMinutes: 1,
    items: [
      { id: "i6", qty: 2, name: "Caesar Salad", modifiers: ["Dressing on side"] },
      { id: "i7", qty: 1, name: "Grilled Chicken" },
    ],
  },
  {
    id: "4",
    number: "109",
    customer: "To Go #12",
    priority: "VIP",
    elapsed: "07:25",
    elapsedMinutes: 7,
    items: [
      { id: "i8", qty: 1, name: "NY Strip", modifiers: ["Medium rare", "No sauce"] },
      { id: "i9", qty: 1, name: "Creme Brulee" },
    ],
  },
];

const stations = [
  { name: "All Stations", color: "bg-white", active: true },
  { name: "Grill", color: "bg-red-500" },
  { name: "Cold Prep", color: "bg-blue-500" },
  { name: "Fryer", color: "bg-amber-500" },
  { name: "Dessert", color: "bg-violet-500" },
];

export function StructuredGrid() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans selection:bg-amber-500/30">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          {stations.map((station) => (
            <button
              key={station.name}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                station.active
                  ? `${station.color} ${
                      station.name === "All Stations" ? "text-black" : "text-white"
                    }`
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {!station.active && (
                <span className={`w-2 h-2 rounded-full ${station.color}`} />
              )}
              {station.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-white/50">
            <span className="text-white font-medium mr-1">{orders.length}</span> Active Orders
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order) => {
            const topStripeColor =
              order.priority === "RUSH"
                ? "bg-red-500"
                : order.priority === "VIP"
                ? "bg-amber-400"
                : "bg-transparent";

            const timerColor =
              order.elapsedMinutes >= 15
                ? "text-red-400"
                : order.elapsedMinutes >= 10
                ? "text-amber-400"
                : "text-white";

            return (
              <div
                key={order.id}
                className={`relative flex flex-col bg-[#121214] border border-white/5 rounded-xl overflow-hidden shadow-2xl ${
                  order.isFocused ? "ring-2 ring-amber-400/50 ring-offset-2 ring-offset-[#0a0a0b]" : ""
                }`}
              >
                {/* Top Stripe */}
                <div className={`h-1 w-full ${topStripeColor}`} />

                <div className="p-5 flex flex-col gap-4">
                  {/* Card Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-0.5">
                        {order.customer}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold tracking-tight text-white leading-none">
                          {order.number}
                        </span>
                        {order.priority !== "normal" && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                              order.priority === "RUSH"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-amber-400/20 text-amber-400"
                            }`}
                          >
                            {order.priority}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="bg-black/50 border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
                        <svg
                          className={`w-3.5 h-3.5 ${timerColor}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className={`font-mono text-sm font-medium tabular-nums ${timerColor}`}>
                          {order.elapsed}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex flex-col mt-2">
                    {order.items.map((item, idx) => (
                      <React.Fragment key={item.id}>
                        {idx > 0 && <div className="h-px w-full bg-white/5 my-3" />}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-start gap-3">
                            <span className="bg-amber-500 text-black font-bold text-xs px-2 py-0.5 rounded shrink-0 mt-0.5">
                              {item.qty}
                            </span>
                            <span className="text-base font-semibold text-white/90 leading-tight">
                              {item.name}
                            </span>
                          </div>
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="pl-9 flex flex-col gap-0.5">
                              {item.modifiers.map((mod, modIdx) => (
                                <span key={modIdx} className="text-sm text-white/50">
                                  - {mod}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer / Bump Bar */}
      <footer className="h-12 border-t border-white/10 bg-[#121214]/80 flex items-center px-6 shrink-0 gap-8">
        <div className="flex items-center gap-3">
          <kbd className="font-mono text-[10px] font-medium px-2 py-1 bg-white/10 border border-white/20 rounded text-white/70 shadow-sm">
            SPACE
          </kbd>
          <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Bump Order</span>
        </div>
        <div className="flex items-center gap-3">
          <kbd className="font-mono text-[10px] font-medium px-2 py-1 bg-white/10 border border-white/20 rounded text-white/70 shadow-sm">
            R
          </kbd>
          <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Recall</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <kbd className="font-mono text-[10px] font-medium px-2 py-1 bg-white/10 border border-white/20 rounded text-white/70 shadow-sm">
              ↑
            </kbd>
            <kbd className="font-mono text-[10px] font-medium px-2 py-1 bg-white/10 border border-white/20 rounded text-white/70 shadow-sm">
              ↓
            </kbd>
          </div>
          <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Navigate</span>
        </div>
      </footer>
    </div>
  );
}
