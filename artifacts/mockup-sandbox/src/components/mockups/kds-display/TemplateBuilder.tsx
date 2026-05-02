import React, { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Station  = "grill" | "fryer" | "cold" | "dessert" | "other" | "all" | "expo";
type ZoneMode = "cards" | "list" | "spotlight";
type Density  = "compact" | "normal" | "comfortable";

type Zone = {
  id: string;
  label: string;
  station: Station;
  mode: ZoneMode;
  // Position in the grid canvas (col 0-3, row 0-2)
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  color: string;
};

type Template = {
  id: string;
  name: string;
  description: string;
  zones: Zone[];
  gridCols: number;
  gridRows: number;
  density: Density;
  showAllergens: boolean;
  showStationColors: boolean;
  showModifierColors: boolean;
  showUrgencyBar: boolean;
  showNotes: boolean;
  showOrderNumber: boolean;
  showCustomerName: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATION_META: Record<Station, { label: string; color: string; bg: string }> = {
  all:     { label: "All Orders",     color: "#ffffff", bg: "rgba(255,255,255,0.12)" },
  grill:   { label: "Grill",          color: "#ef4444", bg: "rgba(239,68,68,0.18)"   },
  fryer:   { label: "Fryer",          color: "#f59e0b", bg: "rgba(245,158,11,0.18)"  },
  cold:    { label: "Cold Prep",      color: "#3b82f6", bg: "rgba(59,130,246,0.18)"  },
  dessert: { label: "Dessert",        color: "#a855f7", bg: "rgba(168,85,247,0.18)"  },
  other:   { label: "Other",          color: "#6b7280", bg: "rgba(107,114,128,0.18)" },
  expo:    { label: "Expo / Fire",    color: "#22c55e", bg: "rgba(34,197,94,0.18)"   },
};

const MODE_META: Record<ZoneMode, { label: string; icon: string; desc: string }> = {
  cards:     { label: "Order Cards",  icon: "▦", desc: "Grid of order cards" },
  list:      { label: "Item List",    icon: "≡", desc: "Flat list of items" },
  spotlight: { label: "Spotlight",    icon: "◉", desc: "One order, full detail" },
};

function uid() { return Math.random().toString(36).slice(2, 8); }

// ─── Preset Templates ─────────────────────────────────────────────────────────

const PRESETS: Template[] = [
  {
    id:"p1", name:"Full House", description:"All orders in a 3-col grid — standard multi-station view",
    gridCols:3, gridRows:1, density:"normal",
    showAllergens:true, showStationColors:true, showModifierColors:true, showUrgencyBar:true, showNotes:true, showOrderNumber:true, showCustomerName:true,
    zones:[{ id:"z1", label:"All Orders", station:"all", mode:"cards", col:0, row:0, colSpan:3, rowSpan:1, color:"#ffffff" }],
  },
  {
    id:"p2", name:"Grill Focus", description:"Grill top-left, Fryer top-right, Expo full bottom",
    gridCols:2, gridRows:2, density:"compact",
    showAllergens:true, showStationColors:true, showModifierColors:true, showUrgencyBar:true, showNotes:false, showOrderNumber:true, showCustomerName:false,
    zones:[
      { id:"z1", label:"Grill",  station:"grill", mode:"cards",     col:0, row:0, colSpan:1, rowSpan:1, color:"#ef4444" },
      { id:"z2", label:"Fryer",  station:"fryer", mode:"cards",     col:1, row:0, colSpan:1, rowSpan:1, color:"#f59e0b" },
      { id:"z3", label:"Expo",   station:"expo",  mode:"spotlight", col:0, row:1, colSpan:2, rowSpan:1, color:"#22c55e" },
    ],
  },
  {
    id:"p3", name:"Station Split", description:"Four station quadrants — each cook sees their zone",
    gridCols:2, gridRows:2, density:"normal",
    showAllergens:true, showStationColors:true, showModifierColors:false, showUrgencyBar:true, showNotes:false, showOrderNumber:true, showCustomerName:true,
    zones:[
      { id:"z1", label:"Grill",    station:"grill",   mode:"cards", col:0, row:0, colSpan:1, rowSpan:1, color:"#ef4444" },
      { id:"z2", label:"Cold Prep",station:"cold",    mode:"list",  col:1, row:0, colSpan:1, rowSpan:1, color:"#3b82f6" },
      { id:"z3", label:"Fryer",    station:"fryer",   mode:"cards", col:0, row:1, colSpan:1, rowSpan:1, color:"#f59e0b" },
      { id:"z4", label:"Dessert",  station:"dessert", mode:"list",  col:1, row:1, colSpan:1, rowSpan:1, color:"#a855f7" },
    ],
  },
  {
    id:"p4", name:"Expo Command", description:"Full-width spotlight for expo, compact queue on the right",
    gridCols:3, gridRows:1, density:"comfortable",
    showAllergens:true, showStationColors:true, showModifierColors:true, showUrgencyBar:false, showNotes:true, showOrderNumber:true, showCustomerName:true,
    zones:[
      { id:"z1", label:"Fire Station", station:"expo", mode:"spotlight", col:0, row:0, colSpan:2, rowSpan:1, color:"#22c55e" },
      { id:"z2", label:"Incoming",     station:"all",  mode:"list",      col:2, row:0, colSpan:1, rowSpan:1, color:"#ffffff" },
    ],
  },
  {
    id:"p5", name:"Bar & Kitchen", description:"Bar orders on top, kitchen below split by station",
    gridCols:3, gridRows:2, density:"normal",
    showAllergens:false, showStationColors:true, showModifierColors:true, showUrgencyBar:true, showNotes:true, showOrderNumber:true, showCustomerName:true,
    zones:[
      { id:"z1", label:"Bar",     station:"cold",  mode:"list",  col:0, row:0, colSpan:3, rowSpan:1, color:"#3b82f6" },
      { id:"z2", label:"Grill",   station:"grill", mode:"cards", col:0, row:1, colSpan:2, rowSpan:1, color:"#ef4444" },
      { id:"z3", label:"Fryer",   station:"fryer", mode:"cards", col:2, row:1, colSpan:1, rowSpan:1, color:"#f59e0b" },
    ],
  },
  {
    id:"p6", name:"Blank Canvas", description:"Start fresh — add your own zones",
    gridCols:3, gridRows:2, density:"normal",
    showAllergens:true, showStationColors:true, showModifierColors:true, showUrgencyBar:true, showNotes:true, showOrderNumber:true, showCustomerName:true,
    zones:[],
  },
];

// ─── Mini preview of a template ────────────────────────────────────────────────

function TemplatePreview({ template }: { template: Template }) {
  const { gridCols, gridRows, zones } = template;
  const cellW = 100 / gridCols;
  const cellH = 100 / gridRows;

  return (
    <div className="relative w-full rounded overflow-hidden" style={{ aspectRatio:"16/9", background:"rgba(0,0,0,0.4)" }}>
      {zones.map(z => {
        const sm = STATION_META[z.station];
        return (
          <div key={z.id}
            className="absolute rounded flex items-center justify-center text-center"
            style={{
              left:`calc(${z.col*cellW}% + 2px)`,
              top:`calc(${z.row*cellH}% + 2px)`,
              width:`calc(${z.colSpan*cellW}% - 4px)`,
              height:`calc(${z.rowSpan*cellH}% - 4px)`,
              background:sm.bg,
              border:`1px solid ${sm.color}55`,
            }}>
            <span style={{ fontSize:9, color:sm.color, fontWeight:700 }}>{z.label}</span>
          </div>
        );
      })}
      {zones.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)" }}>Empty</span>
        </div>
      )}
    </div>
  );
}

// ─── Grid Canvas ──────────────────────────────────────────────────────────────

function GridCanvas({ template, selectedZoneId, onSelectZone, onAddZone, onDeleteZone }: {
  template: Template;
  selectedZoneId: string | null;
  onSelectZone: (id: string | null) => void;
  onAddZone: (col: number, row: number) => void;
  onDeleteZone: (id: string) => void;
}) {
  const { gridCols, gridRows, zones } = template;

  // Build a cell occupancy map
  const occupied: Record<string, string> = {};
  for (const z of zones) {
    for (let r = z.row; r < z.row + z.rowSpan; r++) {
      for (let c = z.col; c < z.col + z.colSpan; c++) {
        occupied[`${c},${r}`] = z.id;
      }
    }
  }

  const rows = Array.from({ length: gridRows }, (_, r) => r);
  const cols = Array.from({ length: gridCols }, (_, c) => c);

  return (
    <div className="flex-1 flex flex-col gap-1 min-h-0">
      {/* Canvas */}
      <div className="flex-1 relative rounded-xl border border-white/[0.08] overflow-hidden"
        style={{ background:"rgba(0,0,0,0.35)", minHeight:220 }}>
        <div className="absolute inset-0" style={{ display:"grid", gridTemplateColumns:`repeat(${gridCols},1fr)`, gridTemplateRows:`repeat(${gridRows},1fr)`, gap:4, padding:4 }}>
          {rows.flatMap(r => cols.map(c => {
            const key = `${c},${r}`;
            const zoneId = occupied[key];
            const zone = zoneId ? zones.find(z => z.id === zoneId) : null;
            const isOrigin = zone ? (zone.col === c && zone.row === r) : false;

            // Only render the zone cell at its origin; other cells are blank (hidden by zone overlay)
            if (zoneId && !isOrigin) return <div key={key} />;

            if (zone && isOrigin) {
              const sm = STATION_META[zone.station];
              const isSelected = selectedZoneId === zone.id;
              return (
                <div key={key}
                  onClick={() => onSelectZone(isSelected ? null : zone.id)}
                  className="rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all relative"
                  style={{
                    gridColumn:`span ${zone.colSpan}`,
                    gridRow:`span ${zone.rowSpan}`,
                    background:sm.bg,
                    border:`2px solid ${isSelected ? sm.color : sm.color + "66"}`,
                    boxShadow:isSelected?`0 0 16px ${sm.color}44`:"none",
                  }}>
                  <span style={{ fontSize:18, color:sm.color, fontWeight:900, lineHeight:1 }}>
                    {MODE_META[zone.mode].icon}
                  </span>
                  <span className="text-xs font-bold mt-1" style={{ color:sm.color }}>{zone.label}</span>
                  <span className="text-[9px] mt-0.5" style={{ color:`${sm.color}99` }}>{STATION_META[zone.station].label} · {MODE_META[zone.mode].label}</span>
                  {isSelected && (
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteZone(zone.id); }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                      style={{ background:"rgba(239,68,68,0.3)", color:"#ef4444" }}>
                      ×
                    </button>
                  )}
                </div>
              );
            }

            // Empty cell
            return (
              <div key={key}
                onClick={() => { onSelectZone(null); onAddZone(c, r); }}
                className="rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-all group"
                style={{ borderColor:"rgba(255,255,255,0.08)" }}>
                <span className="text-xl font-black text-white/10 group-hover:text-white/30 transition-colors">+</span>
              </div>
            );
          }))}
        </div>
      </div>

      {/* Grid size controls */}
      <div className="flex items-center gap-4 pt-1">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">Grid size</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white/40">Cols</span>
          {[1,2,3,4].map(n => (
            <button key={n} className="w-6 h-6 rounded text-[10px] font-bold border transition-all"
              style={{ background: gridCols===n?"rgba(245,158,11,0.2)":"rgba(255,255,255,0.04)", borderColor:gridCols===n?"rgba(245,158,11,0.5)":"rgba(255,255,255,0.08)", color:gridCols===n?"#f59e0b":"rgba(255,255,255,0.35)" }}
              onClick={() => { /* handled by parent */ }}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white/40">Rows</span>
          {[1,2,3].map(n => (
            <button key={n} className="w-6 h-6 rounded text-[10px] font-bold border transition-all"
              style={{ background:gridRows===n?"rgba(245,158,11,0.2)":"rgba(255,255,255,0.04)", borderColor:gridRows===n?"rgba(245,158,11,0.5)":"rgba(255,255,255,0.08)", color:gridRows===n?"#f59e0b":"rgba(255,255,255,0.35)" }}
              onClick={() => { /* handled by parent */ }}>
              {n}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-white/20 ml-auto">Click empty cell to add zone · Click zone to select · × to delete</span>
      </div>
    </div>
  );
}

// ─── Zone Config Panel ────────────────────────────────────────────────────────

function ZonePanel({ zone, onChange }: { zone: Zone; onChange: (z: Zone) => void }) {
  const set = <K extends keyof Zone>(k: K, v: Zone[K]) => onChange({ ...zone, [k]: v });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 block mb-1.5">Zone Label</label>
        <input
          value={zone.label}
          onChange={e => set("label", e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium border outline-none"
          style={{ background:"rgba(255,255,255,0.06)", borderColor:"rgba(255,255,255,0.12)", color:"#fff" }}
        />
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 block mb-1.5">Station Filter</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(STATION_META) as Station[]).map(s => {
            const sm = STATION_META[s]; const active = zone.station === s;
            return <button key={s} onClick={() => { set("station",s); set("color",sm.color); }}
              className="px-2.5 py-2 rounded-lg border text-left transition-all"
              style={{ background:active?sm.bg:"rgba(255,255,255,0.03)", borderColor:active?sm.color+"66":"rgba(255,255,255,0.07)", color:active?sm.color:"rgba(255,255,255,0.45)" }}>
              <span className="text-xs font-bold">{sm.label}</span>
            </button>;
          })}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 block mb-1.5">Display Mode</label>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(MODE_META) as ZoneMode[]).map(m => {
            const mm = MODE_META[m]; const active = zone.mode === m;
            return <button key={m} onClick={() => set("mode",m)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all"
              style={{ background:active?"rgba(245,158,11,0.12)":"rgba(255,255,255,0.03)", borderColor:active?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.07)" }}>
              <span style={{ fontSize:16, color:active?"#f59e0b":"rgba(255,255,255,0.3)" }}>{mm.icon}</span>
              <div>
                <p className="text-xs font-bold" style={{ color:active?"#f59e0b":"rgba(255,255,255,0.6)" }}>{mm.label}</p>
                <p className="text-[10px] text-white/30">{mm.desc}</p>
              </div>
            </button>;
          })}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 block mb-1.5">Size</label>
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-[10px] text-white/40 mb-1">Col span</p>
            <div className="flex gap-1">
              {[1,2,3,4].map(n => (
                <button key={n} onClick={() => set("colSpan",n)}
                  className="w-8 h-7 rounded text-xs font-bold border transition-all"
                  style={{ background:zone.colSpan===n?"rgba(245,158,11,0.2)":"rgba(255,255,255,0.04)", borderColor:zone.colSpan===n?"rgba(245,158,11,0.5)":"rgba(255,255,255,0.08)", color:zone.colSpan===n?"#f59e0b":"rgba(255,255,255,0.35)" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-white/40 mb-1">Row span</p>
            <div className="flex gap-1">
              {[1,2,3].map(n => (
                <button key={n} onClick={() => set("rowSpan",n)}
                  className="w-8 h-7 rounded text-xs font-bold border transition-all"
                  style={{ background:zone.rowSpan===n?"rgba(245,158,11,0.2)":"rgba(255,255,255,0.04)", borderColor:zone.rowSpan===n?"rgba(245,158,11,0.5)":"rgba(255,255,255,0.08)", color:zone.rowSpan===n?"#f59e0b":"rgba(255,255,255,0.35)" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Global Settings Panel ───────────────────────────────────────────────────

function GlobalPanel({ template, onChange }: { template: Template; onChange: (t: Template) => void }) {
  const set = <K extends keyof Template>(k: K, v: Template[K]) => onChange({ ...template, [k]: v });
  type TglKey = "showAllergens" | "showStationColors" | "showModifierColors" | "showUrgencyBar" | "showNotes" | "showOrderNumber" | "showCustomerName";
  const toggles: { label: string; key: TglKey }[] = [
    { label:"Order number",    key:"showOrderNumber"   },
    { label:"Customer name",   key:"showCustomerName"  },
    { label:"Order notes",     key:"showNotes"         },
    { label:"Allergen badges", key:"showAllergens"     },
    { label:"Station colors",  key:"showStationColors" },
    { label:"Modifier colors", key:"showModifierColors"},
    { label:"Urgency bar",     key:"showUrgencyBar"    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 block mb-1.5">Template Name</label>
        <input value={template.name} onChange={e => set("name",e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium border outline-none"
          style={{ background:"rgba(255,255,255,0.06)", borderColor:"rgba(255,255,255,0.12)", color:"#fff" }} />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 block mb-1.5">Description</label>
        <input value={template.description} onChange={e => set("description",e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-xs border outline-none"
          style={{ background:"rgba(255,255,255,0.06)", borderColor:"rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.6)" }} />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 block mb-1.5">Card Density</label>
        <div className="flex gap-1.5">
          {(["compact","normal","comfortable"] as Density[]).map(d => (
            <button key={d} onClick={() => set("density",d)}
              className="flex-1 py-2 rounded-lg text-[10px] font-bold capitalize border transition-all"
              style={{ background:template.density===d?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.04)", borderColor:template.density===d?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.07)", color:template.density===d?"#f59e0b":"rgba(255,255,255,0.4)" }}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 block mb-1.5">Grid Size</label>
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-[10px] text-white/40 mb-1">Columns</p>
            <div className="flex gap-1">
              {[1,2,3,4].map(n => <button key={n} onClick={() => set("gridCols",n)}
                className="w-8 h-7 rounded text-xs font-bold border transition-all"
                style={{ background:template.gridCols===n?"rgba(245,158,11,0.2)":"rgba(255,255,255,0.04)", borderColor:template.gridCols===n?"rgba(245,158,11,0.5)":"rgba(255,255,255,0.08)", color:template.gridCols===n?"#f59e0b":"rgba(255,255,255,0.35)" }}>
                {n}</button>)}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-white/40 mb-1">Rows</p>
            <div className="flex gap-1">
              {[1,2,3].map(n => <button key={n} onClick={() => set("gridRows",n)}
                className="w-8 h-7 rounded text-xs font-bold border transition-all"
                style={{ background:template.gridRows===n?"rgba(245,158,11,0.2)":"rgba(255,255,255,0.04)", borderColor:template.gridRows===n?"rgba(245,158,11,0.5)":"rgba(255,255,255,0.08)", color:template.gridRows===n?"#f59e0b":"rgba(255,255,255,0.35)" }}>
                {n}</button>)}
            </div>
          </div>
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 block mb-1">Card Content</label>
        <div className="flex flex-col gap-1">
          {toggles.map(({ label, key }) => (
            <button key={key} onClick={() => set(key as keyof Template, !template[key] as Template[typeof key])}
              className="flex items-center justify-between py-1">
              <span className="text-xs text-white/55">{label}</span>
              <span className="w-8 h-4 rounded-full flex items-center px-0.5 transition-all"
                style={{ background:template[key]?"#f59e0b":"rgba(255,255,255,0.1)" }}>
                <span className="w-3 h-3 rounded-full bg-white transition-all"
                  style={{ transform:template[key]?"translateX(16px)":"translateX(0)" }} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function newTemplate(): Template {
  return {
    id: uid(), name: "My Template", description: "", zones: [],
    gridCols:3, gridRows:2, density:"normal",
    showAllergens:true, showStationColors:true, showModifierColors:true,
    showUrgencyBar:true, showNotes:true, showOrderNumber:true, showCustomerName:true,
  };
}

export function TemplateBuilder() {
  const [templates, setTemplates]     = useState<Template[]>([...PRESETS.map(p => ({ ...p }))]);
  const [activeId, setActiveId]       = useState<string>(PRESETS[0].id);
  const [selectedZoneId, setSelectedZ]= useState<string | null>(null);
  const [rightPanel, setRightPanel]   = useState<"zone" | "global">("global");
  const [exportJson, setExportJson]   = useState<string | null>(null);
  const [importText, setImportText]   = useState("");
  const [showImport, setShowImport]   = useState(false);
  const [copied, setCopied]           = useState(false);

  const template = templates.find(t => t.id === activeId)!;
  const selectedZone = template.zones.find(z => z.id === selectedZoneId) ?? null;

  const updateTemplate = useCallback((updated: Template) => {
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
  }, []);

  const updateZone = (zone: Zone) => {
    updateTemplate({ ...template, zones: template.zones.map(z => z.id === zone.id ? zone : z) });
  };

  const addZone = (col: number, row: number) => {
    const sm = STATION_META["all"];
    const zone: Zone = { id:uid(), label:"New Zone", station:"all", mode:"cards", col, row, colSpan:1, rowSpan:1, color:sm.color };
    const updated = { ...template, zones: [...template.zones, zone] };
    updateTemplate(updated);
    setSelectedZ(zone.id);
    setRightPanel("zone");
  };

  const deleteZone = (id: string) => {
    updateTemplate({ ...template, zones: template.zones.filter(z => z.id !== id) });
    if (selectedZoneId === id) setSelectedZ(null);
  };

  const duplicateTemplate = () => {
    const copy = { ...template, id: uid(), name: template.name + " (copy)" };
    setTemplates(prev => [...prev, copy]);
    setActiveId(copy.id);
    setSelectedZ(null);
  };

  const deleteTemplate = () => {
    if (templates.length <= 1) return;
    const remaining = templates.filter(t => t.id !== activeId);
    setTemplates(remaining);
    setActiveId(remaining[0].id);
    setSelectedZ(null);
  };

  const exportTemplate = () => {
    const json = JSON.stringify(template, null, 2);
    setExportJson(json);
  };

  const importTemplate = () => {
    try {
      const parsed = JSON.parse(importText) as Template;
      const imported = { ...parsed, id: uid() };
      setTemplates(prev => [...prev, imported]);
      setActiveId(imported.id);
      setShowImport(false);
      setImportText("");
    } catch {
      alert("Invalid JSON — check the format and try again.");
    }
  };

  const copyJson = () => {
    if (!exportJson) return;
    navigator.clipboard.writeText(exportJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="h-screen flex flex-col text-white select-none"
      style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#0e0e14" }}>

      {/* ── Top bar ── */}
      <header className="h-14 bg-[#111118] border-b border-white/[0.07] flex items-center px-5 gap-4 shrink-0">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)" }}>
            <span className="text-[10px] font-black text-white">KDS</span>
          </div>
          <span className="text-sm font-bold text-white/80">Template Builder</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
            style={{ background:"rgba(245,158,11,0.15)", color:"#f59e0b", border:"1px solid rgba(245,158,11,0.3)" }}>Admin</span>
        </div>

        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {templates.map(t => (
            <button key={t.id} onClick={() => { setActiveId(t.id); setSelectedZ(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 border transition-all"
              style={{
                background:activeId===t.id?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.04)",
                borderColor:activeId===t.id?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.07)",
                color:activeId===t.id?"#f59e0b":"rgba(255,255,255,0.5)",
              }}>
              <TemplatePreview template={t} />
              <span className="hidden">{t.name}</span>
              {t.name}
            </button>
          ))}
          <button onClick={() => { const t=newTemplate(); setTemplates(p=>[...p,t]); setActiveId(t.id); }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-dashed transition-all shrink-0"
            style={{ borderColor:"rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.3)" }}>
            + New
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowImport(s=>!s)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
            style={{ background:"rgba(255,255,255,0.05)", borderColor:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.55)" }}>
            Import JSON
          </button>
          <button onClick={exportTemplate}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
            style={{ background:"rgba(245,158,11,0.12)", borderColor:"rgba(245,158,11,0.35)", color:"#f59e0b" }}>
            Export →
          </button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Preset strip + canvas ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden p-4 gap-4">

          {/* Preset picker */}
          <div className="shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-2">Preset Templates</p>
            <div className="grid grid-cols-6 gap-2">
              {PRESETS.map(p => (
                <button key={p.id}
                  onClick={() => { const t={...p,id:uid()}; setTemplates(prev=>[...prev,t]); setActiveId(t.id); setSelectedZ(null); }}
                  className="flex flex-col gap-1.5 p-2 rounded-xl border text-left transition-all group"
                  style={{ background:"rgba(255,255,255,0.03)", borderColor:"rgba(255,255,255,0.07)" }}>
                  <TemplatePreview template={p} />
                  <span className="text-[10px] font-bold text-white/60 group-hover:text-white/80 transition-colors leading-tight">{p.name}</span>
                  <span className="text-[9px] text-white/25 leading-tight">{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Canvas section */}
          <div className="flex flex-col flex-1 min-h-0 gap-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white/80">{template.name}</p>
                <p className="text-[10px] text-white/35">{template.description || "No description"} · {template.gridCols}×{template.gridRows} grid · {template.zones.length} zone{template.zones.length!==1?"s":""}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={duplicateTemplate}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all"
                  style={{ background:"rgba(255,255,255,0.04)", borderColor:"rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.4)" }}>
                  Duplicate
                </button>
                {templates.length > 1 && (
                  <button onClick={deleteTemplate}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all"
                    style={{ background:"rgba(239,68,68,0.08)", borderColor:"rgba(239,68,68,0.2)", color:"#f87171" }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
            <GridCanvas
              template={template}
              selectedZoneId={selectedZoneId}
              onSelectZone={id => { setSelectedZ(id); if(id) setRightPanel("zone"); }}
              onAddZone={addZone}
              onDeleteZone={deleteZone}
            />
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="w-72 shrink-0 bg-[#111118] border-l border-white/[0.07] flex flex-col overflow-hidden">
          {/* Panel tabs */}
          <div className="flex border-b border-white/[0.07] shrink-0">
            {([["zone","Zone Config"],["global","Template Settings"]] as const).map(([id,label]) => (
              <button key={id} onClick={() => setRightPanel(id)}
                className="flex-1 py-2.5 text-[11px] font-bold transition-all border-b-2"
                style={{
                  color:rightPanel===id?"#f59e0b":"rgba(255,255,255,0.35)",
                  borderColor:rightPanel===id?"#f59e0b":"transparent",
                  background:rightPanel===id?"rgba(245,158,11,0.05)":"transparent",
                }}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {rightPanel === "zone" ? (
              selectedZone ? (
                <ZonePanel zone={selectedZone} onChange={updateZone} />
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <p className="text-2xl mb-2">⬡</p>
                  <p className="text-xs text-white/30">Click a zone on the canvas to configure it,<br/>or click an empty cell to add one.</p>
                </div>
              )
            ) : (
              <GlobalPanel template={template} onChange={updateTemplate} />
            )}
          </div>
        </div>
      </div>

      {/* ── Export modal ── */}
      {exportJson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}>
          <div className="w-full max-w-2xl rounded-2xl border overflow-hidden"
            style={{ background:"#13131a", borderColor:"rgba(255,255,255,0.1)" }}>
            <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
              <div>
                <p className="font-bold text-white/80 text-sm">Export Template</p>
                <p className="text-[10px] text-white/35 mt-0.5">Copy this JSON and paste it into any KDS device or import it back here</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copyJson}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold border transition-all"
                  style={{ background:copied?"rgba(34,197,94,0.15)":"rgba(245,158,11,0.12)", borderColor:copied?"rgba(34,197,94,0.4)":"rgba(245,158,11,0.35)", color:copied?"#86efac":"#f59e0b" }}>
                  {copied ? "✓ Copied!" : "Copy JSON"}
                </button>
                <button onClick={() => setExportJson(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{ background:"rgba(255,255,255,0.05)", borderColor:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)" }}>
                  Close
                </button>
              </div>
            </div>
            <pre className="p-5 text-[11px] font-mono text-green-400/80 overflow-auto max-h-96 leading-relaxed"
              style={{ background:"rgba(0,0,0,0.4)" }}>
              {exportJson}
            </pre>
          </div>
        </div>
      )}

      {/* ── Import panel ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}>
          <div className="w-full max-w-xl rounded-2xl border overflow-hidden"
            style={{ background:"#13131a", borderColor:"rgba(255,255,255,0.1)" }}>
            <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
              <p className="font-bold text-white/80 text-sm">Import Template JSON</p>
              <button onClick={() => setShowImport(false)} className="text-white/30 hover:text-white/60 text-xl leading-none">×</button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder="Paste exported template JSON here..."
                rows={10}
                className="w-full rounded-xl p-3 text-xs font-mono border outline-none resize-none leading-relaxed"
                style={{ background:"rgba(0,0,0,0.4)", borderColor:"rgba(255,255,255,0.1)", color:"#86efac" }}
              />
              <button onClick={importTemplate}
                className="px-5 py-2 rounded-lg text-sm font-bold border transition-all self-end"
                style={{ background:"rgba(245,158,11,0.15)", borderColor:"rgba(245,158,11,0.4)", color:"#f59e0b" }}>
                Import Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
