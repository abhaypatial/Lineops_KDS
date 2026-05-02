import React, { useState } from 'react';

const orders = [
  { id:1, num:"101", customer:"Table 5", priority:"rush", elapsed:932, note:"Allergy: nuts",
    items:[{name:"Smash Burger",qty:1,station:"grill",mods:["No onions","Extra cheese"]},{name:"Truffle Fries",qty:1,station:"fryer",mods:["Light salt"]}] },
  { id:2, num:"105", customer:"Table 7", priority:"normal", elapsed:327, note:null,
    items:[{name:"BBQ Ribs",qty:1,station:"grill",mods:["Extra sauce"]},{name:"Coleslaw",qty:1,station:"cold",mods:[]},{name:"Onion Rings",qty:1,station:"fryer",mods:[]}] },
  { id:3, num:"108", customer:"Bar 3", priority:"normal", elapsed:88, note:null,
    items:[{name:"Caesar Salad",qty:2,station:"cold",mods:["Dressing on side"]},{name:"Grilled Chicken",qty:1,station:"grill",mods:[]}] },
  { id:4, num:"109", customer:"To Go #12", priority:"vip", elapsed:445, note:"VIP member",
    items:[{name:"NY Strip",qty:1,station:"grill",mods:["Medium rare","No sauce"]},{name:"Crème Brûlée",qty:1,station:"dessert",mods:[]}] },
];

const stations = ["All","Grill","Cold Prep","Fryer","Dessert"];
const stationColors: Record<string, string> = { grill:"bg-red-600", cold:"bg-blue-600", fryer:"bg-amber-600", dessert:"bg-violet-600", all:"bg-zinc-600" };

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ElevatedCard() {
  const [activeStation, setActiveStation] = useState("All");

  return (
    <div className="min-h-screen bg-[#080809] flex flex-col text-white font-sans selection:bg-white/10">
      {/* Top header */}
      <header className="h-[56px] bg-[#0d0d10] border-b border-white/5 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-2">
          {stations.map(station => {
            const isActive = activeStation === station;
            const normalized = station === "Cold Prep" ? "cold" : station.toLowerCase();
            const colorClass = stationColors[normalized] || "bg-zinc-600";
            
            return (
              <button
                key={station}
                onClick={() => setActiveStation(station)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  isActive 
                    ? `${colorClass} text-white border border-transparent` 
                    : `border border-white/10 text-zinc-400 hover:text-white hover:border-white/20`
                }`}
              >
                {station}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 bg-[#1c1c21] rounded-full pl-2 pr-3 py-1 border border-white/5 shadow-inner">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider text-zinc-300">4 ACTIVE</span>
        </div>
      </header>

      {/* Card grid */}
      <main className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
        {orders.map((order, index) => {
          const isFocused = index === 0;
          
          let priorityStyles = "border-l-4 border-transparent";
          if (order.priority === "rush") priorityStyles = "border-l-4 border-red-500 bg-red-950/20";
          else if (order.priority === "vip") priorityStyles = "border-l-4 border-amber-400 bg-amber-950/15";
          
          let timerColor = "text-white";
          if (order.elapsed > 600) timerColor = "text-red-400";
          else if (order.elapsed > 300) timerColor = "text-yellow-400";

          return (
            <article 
              key={order.id} 
              className={`rounded-lg bg-[#111114] overflow-hidden flex flex-col relative transition-all duration-200 ${priorityStyles} ${isFocused ? 'ring-2 ring-white/30 shadow-[0_0_0_4px_rgba(255,255,255,0.08)]' : 'border border-white/5 hover:border-white/10'}`}
            >
              {/* Card Header */}
              <div className="px-4 py-3 border-b border-white/5 flex flex-col gap-1 shrink-0">
                <div className="flex justify-between items-center w-full">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{order.customer}</span>
                  {order.priority !== "normal" && (
                    <span className={`text-[10px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded-sm ${order.priority === 'rush' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {order.priority}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-baseline mt-1">
                  <div className="text-5xl font-bold font-mono tracking-tighter leading-none">{order.num}</div>
                  <div className={`text-xl font-mono tracking-tight tabular-nums ${timerColor}`}>{formatTime(order.elapsed)}</div>
                </div>
              </div>

              {/* Item List */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {order.items.map((item, i) => {
                  const dotColor = stationColors[item.station] || "bg-zinc-500";
                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-start gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${dotColor.replace('bg-', 'bg-').replace('600', '500')}`} />
                        <div className="text-zinc-500 font-mono text-sm mt-0.5 font-bold shrink-0 w-4">{item.qty}</div>
                        <div className="text-zinc-100 font-medium leading-snug">{item.name}</div>
                      </div>
                      {item.mods.length > 0 && (
                        <div className="pl-7 flex flex-col">
                          {item.mods.map((mod, j) => (
                            <div key={j} className="text-sm text-zinc-400 font-medium before:content-['—'] before:mr-1 before:text-zinc-600">
                              {mod}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Card Footer (Notes) */}
              {order.note && (
                <div className="bg-yellow-500/10 border-t border-yellow-500/20 px-4 py-2 shrink-0">
                  <div className="text-sm text-yellow-200/90 font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0 text-yellow-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {order.note}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </main>

      {/* Bottom footer (Bump bar hints) */}
      <footer className="bg-[#0d0d10] border-t border-white/5 h-11 shrink-0 px-4 flex items-center justify-center gap-6">
        {[
          { key: "1", label: "Bump" },
          { key: "2", label: "Recall" },
          { key: "3", label: "Page" },
          { key: "4", label: "Summary" }
        ].map(btn => (
          <div key={btn.key} className="flex items-center gap-2">
            <kbd className="bg-white/10 border border-white/20 rounded text-xs px-1.5 py-0.5 font-mono text-zinc-300 font-bold">{btn.key}</kbd>
            <span className="text-sm text-zinc-500 font-medium">{btn.label}</span>
          </div>
        ))}
      </footer>
    </div>
  );
}

export default ElevatedCard;
