import React, { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PosStatus  = "connected" | "available" | "error";
type EventState = "success" | "error" | "ignored";
type RightTab   = "apikeys" | "webhooks" | "apidocs";

interface PosSystem {
  id:       string;
  name:     string;
  logo:     string;
  color:    string;
  status:   PosStatus;
  webhook:  string;
  authType: string;
  lastEvent?: string;
  ordersToday?: number;
  envVar:   string;
  docsUrl:  string;
}

interface ApiKey {
  id:          string;
  name:        string;
  prefix:      string;
  permissions: string[];
  isActive:    boolean;
  lastUsed?:   string;
  created:     string;
}

interface WebhookDest {
  id:       string;
  name:     string;
  url:      string;
  events:   string[];
  isActive: boolean;
  lastHit?: string;
  failures: number;
}

interface Event {
  id:        string;
  source:    string;
  color:     string;
  type:      string;
  order?:    string;
  state:     EventState;
  ago:       string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const POS_SYSTEMS: PosSystem[] = [
  {
    id:"square", name:"Square", logo:"◼", color:"#00b4d8",
    status:"connected", webhook:"/api/integrations/square/webhook",
    authType:"HMAC-SHA256", lastEvent:"2s ago", ordersToday:47,
    envVar:"SQUARE_WEBHOOK_SECRET", docsUrl:"https://developer.squareup.com/docs/webhooks/overview",
  },
  {
    id:"toast", name:"Toast POS", logo:"🍞", color:"#ff6b35",
    status:"connected", webhook:"/api/integrations/toast/webhook",
    authType:"HMAC-SHA256", lastEvent:"1m ago", ordersToday:31,
    envVar:"TOAST_WEBHOOK_SECRET", docsUrl:"https://doc.toasttab.com",
  },
  {
    id:"clover", name:"Clover", logo:"🍀", color:"#22c55e",
    status:"available", webhook:"/api/integrations/clover/webhook",
    authType:"Bearer Token", envVar:"CLOVER_WEBHOOK_SECRET", docsUrl:"https://docs.clover.com",
  },
  {
    id:"lightspeed", name:"Lightspeed K", logo:"⚡", color:"#f59e0b",
    status:"error", webhook:"/api/integrations/lightspeed/webhook",
    authType:"HMAC-SHA256", lastEvent:"3h ago",
    envVar:"LIGHTSPEED_WEBHOOK_SECRET", docsUrl:"https://developers.lightspeedhq.com",
  },
  {
    id:"generic", name:"Custom / Generic", logo:"⬡", color:"#a855f7",
    status:"connected", webhook:"/api/integrations/orders",
    authType:"API Key", lastEvent:"14s ago", ordersToday:12,
    envVar:"—", docsUrl:"",
  },
];

const SEED_KEYS: ApiKey[] = [
  { id:"k1", name:"POS Bridge (Square)",    prefix:"kds_live_a8f3…", permissions:["orders:read","orders:write"], isActive:true,  lastUsed:"2s ago",  created:"Apr 28" },
  { id:"k2", name:"Dashboard App",           prefix:"kds_live_c2b1…", permissions:["orders:read","dashboard:read"], isActive:true,  lastUsed:"1h ago",  created:"Apr 20" },
  { id:"k3", name:"Mobile Client (iOS)",      prefix:"kds_live_d9e7…", permissions:["orders:read"],                isActive:true,  lastUsed:"3m ago",  created:"May 1"  },
  { id:"k4", name:"Legacy POS (deprecated)", prefix:"kds_live_f1a0…", permissions:["orders:write"],               isActive:false, lastUsed:"6d ago",  created:"Mar 10" },
];

const SEED_WEBHOOKS: WebhookDest[] = [
  { id:"w1", name:"Slack #kitchen",     url:"https://hooks.slack.com/services/xxx", events:["order.bumped","order.completed"], isActive:true,  lastHit:"2s ago",  failures:0 },
  { id:"w2", name:"PMS Notification",   url:"https://api.acmepms.com/kds/events",   events:["order.created","order.bumped"],   isActive:true,  lastHit:"1m ago",  failures:1 },
  { id:"w3", name:"Analytics Webhook",  url:"https://track.myanalytics.io/kds",     events:["order.created","order.completed","order.bumped"], isActive:false, failures:0 },
];

const SEED_EVENTS: Event[] = [
  { id:"e1", source:"square",  color:"#00b4d8", type:"order.created",  order:"#203", state:"success", ago:"2s" },
  { id:"e2", source:"generic", color:"#a855f7", type:"order.push",     order:"#202", state:"success", ago:"14s" },
  { id:"e3", source:"toast",   color:"#ff6b35", type:"ORDER_UPDATED",  order:"#201", state:"success", ago:"1m" },
  { id:"e4", source:"lightspeed",color:"#f59e0b",type:"order.created", order:"#200", state:"error",   ago:"3h" },
  { id:"e5", source:"square",  color:"#00b4d8", type:"payment.created",order:"#199", state:"success", ago:"3h" },
  { id:"e6", source:"square",  color:"#00b4d8", type:"refund.created",              state:"ignored",  ago:"3h" },
  { id:"e7", source:"toast",   color:"#ff6b35", type:"ORDER_UPDATED",  order:"#198", state:"success", ago:"4h" },
  { id:"e8", source:"generic", color:"#a855f7", type:"order.push",     order:"#197", state:"success", ago:"5h" },
];

const ALL_EVENTS = ["order.created","order.bumped","order.completed","order.recalled","item.ready"] as const;

const API_ENDPOINTS = [
  { method:"GET",    path:"/api/orders",                      auth:"—",      desc:"List active orders" },
  { method:"POST",   path:"/api/orders",                      auth:"—",      desc:"Create an order (internal)" },
  { method:"PATCH",  path:"/api/orders/:id",                  auth:"—",      desc:"Bump / update order status" },
  { method:"POST",   path:"/api/integrations/orders",         auth:"API Key",desc:"Push order from any POS (generic)" },
  { method:"POST",   path:"/api/integrations/square/webhook", auth:"HMAC",   desc:"Square webhook receiver" },
  { method:"POST",   path:"/api/integrations/toast/webhook",  auth:"HMAC",   desc:"Toast webhook receiver" },
  { method:"POST",   path:"/api/integrations/clover/webhook", auth:"Bearer", desc:"Clover webhook receiver" },
  { method:"POST",   path:"/api/integrations/lightspeed/webhook",auth:"HMAC",desc:"Lightspeed webhook receiver" },
  { method:"GET",    path:"/api/integrations/events",         auth:"—",      desc:"Recent integration events log" },
  { method:"GET",    path:"/api/integrations",                auth:"—",      desc:"List integration capabilities" },
  { method:"GET",    path:"/api/keys",                        auth:"—",      desc:"List API keys (prefix only)" },
  { method:"POST",   path:"/api/keys",                        auth:"—",      desc:"Create API key (returns raw once)" },
  { method:"DELETE", path:"/api/keys/:id",                    auth:"—",      desc:"Revoke API key" },
  { method:"GET",    path:"/api/webhooks",                    auth:"—",      desc:"List outbound webhook destinations" },
  { method:"POST",   path:"/api/webhooks",                    auth:"—",      desc:"Register outbound webhook" },
  { method:"DELETE", path:"/api/webhooks/:id",                auth:"—",      desc:"Remove outbound webhook" },
  { method:"GET",    path:"/api/stations",                    auth:"—",      desc:"List kitchen stations" },
  { method:"GET",    path:"/api/devices",                     auth:"—",      desc:"List registered KDS displays" },
  { method:"GET",    path:"/api/health",                      auth:"—",      desc:"Health check" },
];

const METHOD_COLOR: Record<string, string> = {
  GET:"#3b82f6", POST:"#22c55e", PATCH:"#f59e0b", PUT:"#f59e0b", DELETE:"#ef4444",
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ color, background: bg }}>
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: PosStatus }) {
  const c = status === "connected" ? "#22c55e" : status === "error" ? "#ef4444" : "#4b5563";
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c, boxShadow: status === "connected" ? `0 0 6px ${c}` : "none" }} />;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all shrink-0"
      style={{ background: value ? "#22c55e" : "rgba(255,255,255,0.12)" }}>
      <span className="w-3 h-3 rounded-full bg-white transition-all" style={{ transform: value ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

// ─── POS System Card ─────────────────────────────────────────────────────────

function PosCard({ pos, selected, onSelect }: { pos: PosSystem; selected: boolean; onSelect: () => void }) {
  const statusLabel = pos.status === "connected" ? "Connected" : pos.status === "error" ? "Error" : "Available";
  return (
    <button onClick={onSelect}
      className="flex flex-col gap-2.5 text-left p-3.5 rounded-xl border transition-all"
      style={{
        background: selected ? `${pos.color}10` : "rgba(255,255,255,0.03)",
        borderColor: selected ? `${pos.color}55` : "rgba(255,255,255,0.07)",
        boxShadow: selected ? `0 0 20px ${pos.color}10` : "none",
      }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{ background: `${pos.color}18`, border: `1px solid ${pos.color}33` }}>
            {pos.logo}
          </div>
          <div>
            <p className="text-xs font-bold text-white/80 leading-none">{pos.name}</p>
            <div className="flex items-center gap-1 mt-1">
              <StatusDot status={pos.status} />
              <span className="text-[9px] font-semibold" style={{ color: pos.status === "connected" ? "#22c55e" : pos.status === "error" ? "#ef4444" : "#6b7280" }}>{statusLabel}</span>
            </div>
          </div>
        </div>
        {pos.ordersToday !== undefined && (
          <div className="text-right">
            <p className="text-sm font-black" style={{ color: pos.color }}>{pos.ordersToday}</p>
            <p className="text-[8px] text-white/25 uppercase tracking-wider">today</p>
          </div>
        )}
      </div>
      {pos.lastEvent && (
        <p className="text-[9px] text-white/30">Last event <span className="text-white/50">{pos.lastEvent}</span></p>
      )}
      {pos.status === "available" && (
        <p className="text-[9px] text-white/25 italic">Click to configure →</p>
      )}
    </button>
  );
}

// ─── POS Config Panel ─────────────────────────────────────────────────────────

function PosConfigPanel({ pos }: { pos: PosSystem }) {
  const [secret, setSecret] = useState("••••••••••••••••••••");
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: `${pos.color}18`, border: `1px solid ${pos.color}33` }}>{pos.logo}</div>
        <div>
          <p className="text-sm font-bold text-white/85">{pos.name}</p>
          <p className="text-[10px] text-white/35">Auth: {pos.authType}</p>
        </div>
        {pos.docsUrl && (
          <a href={pos.docsUrl} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all"
            style={{ color: pos.color, borderColor: `${pos.color}44`, background: `${pos.color}0d` }}>
            Docs ↗
          </a>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Webhook URL</label>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background:"rgba(0,0,0,0.3)", borderColor:"rgba(255,255,255,0.08)" }}>
          <code className="flex-1 text-[10px] font-mono text-green-400/80 truncate">{pos.webhook}?storeId=YOUR_STORE_ID</code>
          <button onClick={() => copy(pos.webhook, "url")}
            className="text-[9px] font-bold px-2 py-0.5 rounded transition-all"
            style={{ color: copied==="url"?"#22c55e":pos.color, background:`${pos.color}15` }}>
            {copied==="url"?"✓ Copied":"Copy"}
          </button>
        </div>
      </div>

      {pos.envVar !== "—" && (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Webhook Secret ({pos.envVar})</label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background:"rgba(0,0,0,0.3)", borderColor:"rgba(255,255,255,0.08)" }}>
            <code className="flex-1 text-[10px] font-mono text-white/40">{secret}</code>
            <button onClick={() => setSecret(prev => prev.startsWith("•") ? "a9f3c..." : "••••••••••••••••••••")}
              className="text-[9px] font-bold px-2 py-0.5 rounded transition-all"
              style={{ color:"rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.06)" }}>
              {secret.startsWith("•") ? "Reveal" : "Hide"}
            </button>
          </div>
          <p className="text-[9px] text-white/25">Set in your server <code className="font-mono">.env</code> file as <code className="font-mono text-yellow-400/60">{pos.envVar}</code></p>
        </div>
      )}

      {pos.id === "generic" && (
        <div className="flex flex-col gap-2 mt-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Example — Push an order</label>
          <pre className="text-[9px] font-mono leading-relaxed px-3 py-2.5 rounded-lg overflow-x-auto"
            style={{ background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.07)", color:"#86efac" }}>
{`curl -X POST https://kds.local/api/integrations/orders \\
  -H "Authorization: Bearer kds_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
  "orderNumber": "001",
  "customerName": "Table 5",
  "priority": "normal",
  "items": [
    { "name": "Smash Burger", "quantity": 1,
      "stationId": "grill", "modifiers": ["No onion"] },
    { "name": "Fries", "quantity": 1,
      "stationId": "fryer" }
  ]
}'`}
          </pre>
        </div>
      )}

      <div className="flex flex-col gap-1.5 pt-2 border-t border-white/[0.06]">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Setup steps</p>
        {[
          pos.envVar !== "—" ? `Set ${pos.envVar} in your .env file` : "Create an API key below",
          `Register ${pos.webhook} as the webhook URL in your ${pos.name} dashboard`,
          pos.id !== "generic" ? `Select events: order.created / order.updated` : "Include Authorization header with your API key",
          "Test with a real order — check the Events feed",
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 mt-0.5"
              style={{ background:`${pos.color}20`, color:pos.color }}>{i+1}</span>
            <span className="text-[10px] text-white/45 leading-snug">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Events Feed ─────────────────────────────────────────────────────────────

function EventsFeed({ events }: { events: Event[] }) {
  const stateColor = (s: EventState) =>
    s === "success" ? "#22c55e" : s === "error" ? "#ef4444" : "#6b7280";
  const stateIcon  = (s: EventState) =>
    s === "success" ? "✓" : s === "error" ? "✗" : "—";

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Live Event Feed</p>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background:"#22c55e", boxShadow:"0 0 6px #22c55e", animation:"pulse 2s ease-in-out infinite" }} />
      </div>
      <div className="flex flex-col divide-y" style={{ divideColor:"rgba(255,255,255,0.04)" }}>
        {events.map(ev => (
          <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black shrink-0"
              style={{ background:`${stateColor(ev.state)}18`, color:stateColor(ev.state) }}>
              {stateIcon(ev.state)}
            </div>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ev.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-white/65">{ev.source}</span>
                <span className="text-[9px] text-white/25">·</span>
                <span className="text-[10px] font-mono text-white/40">{ev.type}</span>
                {ev.order && <span className="text-[10px] font-bold" style={{ color: ev.color }}>{ev.order}</span>}
              </div>
            </div>
            <span className="text-[9px] text-white/20 shrink-0">{ev.ago}s ago</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Right Panels ─────────────────────────────────────────────────────────────

function ApiKeysPanel({ keys: initKeys }: { keys: ApiKey[] }) {
  const [keys, setKeys]   = useState(initKeys);
  const [creating, setC]  = useState(false);
  const [newName, setN]   = useState("");
  const [newPerms, setP]  = useState<string[]>(["orders:read","orders:write"]);
  const [showRaw, setRaw] = useState<string | null>(null);

  const create = () => {
    const fake: ApiKey = {
      id: Math.random().toString(36).slice(2), name: newName || "New Key",
      prefix: "kds_live_" + Math.random().toString(36).slice(2, 10) + "…",
      permissions: newPerms, isActive: true, created: "just now",
    };
    const raw = "kds_live_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    setKeys(prev => [fake, ...prev]);
    setRaw(raw); setC(false); setN(""); setP(["orders:read","orders:write"]);
  };

  const PERM_OPTS = ["orders:read","orders:write","dashboard:read","devices:read","*"];
  const togglePerm = (p: string) => setP(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev,p]);

  return (
    <div className="flex flex-col gap-4">
      {showRaw && (
        <div className="rounded-xl border p-3 flex flex-col gap-2" style={{ background:"rgba(34,197,94,0.08)", borderColor:"rgba(34,197,94,0.25)" }}>
          <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider">✓ API Key Created — save it now</p>
          <code className="text-[10px] font-mono text-green-300/80 break-all leading-relaxed">{showRaw}</code>
          <p className="text-[9px] text-white/30">This key will not be shown again.</p>
          <button onClick={() => { navigator.clipboard.writeText(showRaw).catch(()=>{}); }}
            className="self-start text-[10px] font-bold px-3 py-1 rounded-lg"
            style={{ background:"rgba(34,197,94,0.15)", color:"#86efac", border:"1px solid rgba(34,197,94,0.3)" }}>
            Copy key
          </button>
        </div>
      )}

      {creating ? (
        <div className="rounded-xl border p-3 flex flex-col gap-2.5" style={{ background:"rgba(255,255,255,0.03)", borderColor:"rgba(255,255,255,0.1)" }}>
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">New API Key</p>
          <input value={newName} onChange={e=>setN(e.target.value)} placeholder="Key name (e.g. Square Bridge)"
            className="w-full text-xs rounded-lg px-3 py-2 border outline-none"
            style={{ background:"rgba(0,0,0,0.3)", borderColor:"rgba(255,255,255,0.1)", color:"#fff" }} />
          <div className="flex flex-col gap-1">
            <p className="text-[9px] text-white/35 mb-1">Permissions</p>
            <div className="flex flex-wrap gap-1">
              {PERM_OPTS.map(p => (
                <button key={p} onClick={()=>togglePerm(p)}
                  className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border transition-all"
                  style={{
                    background: newPerms.includes(p)?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.04)",
                    borderColor:newPerms.includes(p)?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.08)",
                    color: newPerms.includes(p)?"#f59e0b":"rgba(255,255,255,0.35)",
                  }}>{p}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={create}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all"
              style={{ background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.35)", color:"#f59e0b" }}>
              Generate Key
            </button>
            <button onClick={()=>setC(false)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
              style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.4)" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={()=>{setC(true);setRaw(null);}}
          className="flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed text-[10px] font-bold transition-all"
          style={{ borderColor:"rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.35)" }}>
          + Generate new API key
        </button>
      )}

      <div className="flex flex-col gap-2">
        {keys.map(k => (
          <div key={k.id} className="rounded-xl border p-3 flex flex-col gap-1.5 transition-all"
            style={{ background:"rgba(255,255,255,0.03)", borderColor: k.isActive?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.03)", opacity: k.isActive?1:0.5 }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: k.isActive?"#22c55e":"#4b5563" }} />
                <span className="text-xs font-bold text-white/75">{k.name}</span>
              </div>
              <button onClick={()=>setKeys(prev=>prev.map(x=>x.id===k.id?{...x,isActive:!x.isActive}:x))}
                className="text-[9px] font-bold px-2 py-0.5 rounded border transition-all"
                style={{ color: k.isActive?"#f87171":"#6b7280", borderColor:"rgba(255,255,255,0.07)", background:"rgba(255,255,255,0.03)" }}>
                {k.isActive?"Revoke":"Revoked"}
              </button>
            </div>
            <code className="text-[9px] font-mono text-white/30">{k.prefix}</code>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(k.permissions as string[]).map(p => (
                <span key={p} className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background:"rgba(245,158,11,0.1)", color:"#f59e0b99" }}>{p}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[9px] text-white/20">
              {k.lastUsed && <span>Used {k.lastUsed}</span>}
              <span>·</span>
              <span>Created {k.created}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WebhooksPanel({ webhooks: init }: { webhooks: WebhookDest[] }) {
  const [hooks, setHooks] = useState(init);
  const [adding, setA]    = useState(false);
  const [url, setUrl]     = useState("");
  const [name, setName]   = useState("");
  const [evts, setEvts]   = useState<string[]>(["order.bumped","order.completed"]);

  const toggleEvt = (e: string) => setEvts(prev => prev.includes(e)?prev.filter(x=>x!==e):[...prev,e]);
  const add = () => {
    const hook: WebhookDest = {
      id: Math.random().toString(36).slice(2), name: name||url, url,
      events: evts, isActive:true, failures:0,
    };
    setHooks(prev=>[hook,...prev]); setA(false); setUrl(""); setName(""); setEvts(["order.bumped","order.completed"]);
  };

  return (
    <div className="flex flex-col gap-4">
      {adding ? (
        <div className="rounded-xl border p-3 flex flex-col gap-2.5" style={{ background:"rgba(255,255,255,0.03)", borderColor:"rgba(255,255,255,0.1)" }}>
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Register Webhook</p>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name (e.g. Slack #orders)"
            className="w-full text-xs rounded-lg px-3 py-2 border outline-none"
            style={{ background:"rgba(0,0,0,0.3)", borderColor:"rgba(255,255,255,0.1)", color:"#fff" }} />
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://your-endpoint.com/hook"
            className="w-full text-xs rounded-lg px-3 py-2 border outline-none font-mono"
            style={{ background:"rgba(0,0,0,0.3)", borderColor:"rgba(255,255,255,0.1)", color:"#22c55e" }} />
          <div className="flex flex-col gap-1">
            <p className="text-[9px] text-white/35 mb-1">Events to deliver</p>
            <div className="flex flex-col gap-1">
              {ALL_EVENTS.map(e => (
                <button key={e} onClick={()=>toggleEvt(e)}
                  className="flex items-center gap-2 text-left text-[10px] py-0.5 transition-colors"
                  style={{ color: evts.includes(e)?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.28)" }}>
                  <span className="w-3 h-3 rounded flex items-center justify-center text-[8px]"
                    style={{ background: evts.includes(e)?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.05)", border:`1px solid ${evts.includes(e)?"rgba(34,197,94,0.4)":"rgba(255,255,255,0.1)"}`, color:"#22c55e" }}>
                    {evts.includes(e)?"✓":""}
                  </span>
                  <code className="font-mono">{e}</code>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={add}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
              style={{ background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.3)", color:"#86efac" }}>
              Register
            </button>
            <button onClick={()=>setA(false)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
              style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.4)" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={()=>setA(true)}
          className="flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed text-[10px] font-bold"
          style={{ borderColor:"rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.35)" }}>
          + Register webhook destination
        </button>
      )}

      <div className="flex flex-col gap-2">
        {hooks.map(h => (
          <div key={h.id} className="rounded-xl border p-3 flex flex-col gap-1.5"
            style={{ background:"rgba(255,255,255,0.03)", borderColor:h.isActive?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.03)", opacity:h.isActive?1:0.5 }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/75">{h.name}</span>
              <div className="flex items-center gap-2">
                {h.failures > 0 && <span className="text-[9px] font-bold text-red-400/70">{h.failures} fail</span>}
                <Toggle value={h.isActive} onChange={v=>setHooks(prev=>prev.map(x=>x.id===h.id?{...x,isActive:v}:x))} />
              </div>
            </div>
            <code className="text-[9px] font-mono text-white/30 truncate">{h.url}</code>
            <div className="flex items-center gap-1 flex-wrap">
              {h.events.map(e=>(
                <span key={e} className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background:"rgba(34,197,94,0.08)", color:"#22c55e66" }}>{e}</span>
              ))}
            </div>
            {h.lastHit && <p className="text-[9px] text-white/20">Last delivered {h.lastHit}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ApiDocsPanel() {
  const [search, setSearch] = useState("");
  const filtered = API_ENDPOINTS.filter(e =>
    e.path.toLowerCase().includes(search.toLowerCase()) ||
    e.desc.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="flex flex-col gap-3">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search endpoints…"
        className="w-full text-xs rounded-lg px-3 py-2 border outline-none"
        style={{ background:"rgba(0,0,0,0.3)", borderColor:"rgba(255,255,255,0.1)", color:"#fff" }} />
      <div className="flex flex-col gap-1.5">
        {filtered.map((ep, i) => (
          <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-lg border transition-all"
            style={{ background:"rgba(255,255,255,0.02)", borderColor:"rgba(255,255,255,0.05)" }}>
            <span className="text-[9px] font-black font-mono shrink-0 mt-0.5 w-10"
              style={{ color: METHOD_COLOR[ep.method] ?? "#fff" }}>{ep.method}</span>
            <div className="flex-1 min-w-0">
              <code className="text-[10px] font-mono text-green-400/70 break-all">{ep.path}</code>
              <p className="text-[9px] text-white/35 mt-0.5">{ep.desc}</p>
            </div>
            {ep.auth !== "—" && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0"
                style={{ background:"rgba(245,158,11,0.1)", color:"#f59e0b77" }}>{ep.auth}</span>
            )}
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-white/[0.06]">
        <p className="text-[10px] font-bold text-white/30 mb-2">Webhook payload (outbound)</p>
        <pre className="text-[9px] font-mono leading-relaxed px-3 py-2.5 rounded-lg overflow-x-auto"
          style={{ background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.06)", color:"#86efac" }}>
{`{
  "event": "order.bumped",
  "storeId": "store_xxx",
  "timestamp": "2026-05-02T17:30:00Z",
  "data": {
    "orderId": "...",
    "orderNumber": "101",
    "source": "kds"
  }
}
X-KDS-Signature: sha256=<hmac>`}
        </pre>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function IntegrationHub() {
  const [selectedPos, setSelected] = useState<string>("square");
  const [rightTab, setRightTab]    = useState<RightTab>("apikeys");
  const pos = POS_SYSTEMS.find(p => p.id === selectedPos)!;

  const totalToday = POS_SYSTEMS.reduce((s,p)=>s+(p.ordersToday??0), 0);
  const connected  = POS_SYSTEMS.filter(p=>p.status==="connected").length;
  const errors     = POS_SYSTEMS.filter(p=>p.status==="error").length;

  return (
    <div className="h-screen bg-[#0d0d12] text-white flex flex-col select-none overflow-hidden"
      style={{ fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* ── Header ── */}
      <header className="h-13 flex items-center justify-between px-5 border-b border-white/[0.07] shrink-0 bg-[#0f0f18]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:"linear-gradient(135deg,#f59e0b,#a855f7)" }}>
            <span className="text-[10px] font-black">⬡</span>
          </div>
          <div>
            <span className="text-sm font-bold text-white/85">Integration Hub</span>
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
              style={{ background:"rgba(245,158,11,0.12)", color:"#f59e0b", border:"1px solid rgba(245,158,11,0.25)" }}>Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-sm font-black text-white leading-none">{totalToday}</p>
              <p className="text-[8px] text-white/25 uppercase tracking-wider mt-0.5">Orders today</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-black leading-none" style={{ color:"#22c55e" }}>{connected}</p>
              <p className="text-[8px] text-white/25 uppercase tracking-wider mt-0.5">Connected</p>
            </div>
            {errors > 0 && (
              <div className="text-center">
                <p className="text-sm font-black leading-none" style={{ color:"#ef4444" }}>{errors}</p>
                <p className="text-[8px] text-white/25 uppercase tracking-wider mt-0.5">Errors</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: POS list + config ── */}
        <div className="w-80 shrink-0 border-r border-white/[0.07] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/[0.06]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-2.5">POS Systems</p>
            <div className="flex flex-col gap-1.5">
              {POS_SYSTEMS.map(p => <PosCard key={p.id} pos={p} selected={selectedPos===p.id} onSelect={()=>setSelected(p.id)} />)}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-2.5">Configure — {pos.name}</p>
            <PosConfigPanel pos={pos} />
          </div>
        </div>

        {/* ── Center: Event feed ── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-white/[0.07]">
          <EventsFeed events={SEED_EVENTS} />
          <div className="mt-auto border-t border-white/[0.06] px-4 py-3 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background:"#22c55e" }} />
              <span className="text-[10px] text-white/40">Success</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background:"#ef4444" }} />
              <span className="text-[10px] text-white/40">Error</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background:"#4b5563" }} />
              <span className="text-[10px] text-white/40">Ignored</span>
            </div>
            <span className="ml-auto text-[10px] text-white/20">Webhook events are stored 30 days</span>
          </div>
        </div>

        {/* ── Right: API Keys / Webhooks / Docs ── */}
        <div className="w-80 shrink-0 flex flex-col overflow-hidden">
          <div className="flex border-b border-white/[0.07] shrink-0">
            {([["apikeys","API Keys"],["webhooks","Webhooks"],["apidocs","API Docs"]] as [RightTab,string][]).map(([id,label]) => (
              <button key={id} onClick={()=>setRightTab(id)}
                className="flex-1 py-2.5 text-[10px] font-bold transition-all border-b-2"
                style={{
                  color: rightTab===id?"#f59e0b":"rgba(255,255,255,0.3)",
                  borderColor: rightTab===id?"#f59e0b":"transparent",
                  background: rightTab===id?"rgba(245,158,11,0.05)":"transparent",
                }}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {rightTab === "apikeys"  && <ApiKeysPanel   keys={SEED_KEYS}        />}
            {rightTab === "webhooks" && <WebhooksPanel  webhooks={SEED_WEBHOOKS} />}
            {rightTab === "apidocs"  && <ApiDocsPanel />}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>
    </div>
  );
}
