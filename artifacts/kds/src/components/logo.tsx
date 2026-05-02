export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="180" rx="36" fill="#0A0A14"/>
      <rect x="22" y="28" width="136" height="92" rx="10" fill="none" stroke="#F97316" strokeWidth="7"/>
      <rect x="29" y="35" width="122" height="78" rx="6" fill="#0F1629"/>
      <rect x="42" y="50" width="9" height="42" rx="3" fill="#F97316"/>
      <rect x="42" y="83" width="26" height="9" rx="3" fill="#F97316"/>
      <rect x="78" y="52" width="52" height="7" rx="3.5" fill="#3B82F6" opacity="0.9"/>
      <rect x="78" y="65" width="38" height="5" rx="2.5" fill="#3B82F6" opacity="0.55"/>
      <rect x="78" y="76" width="44" height="5" rx="2.5" fill="#3B82F6" opacity="0.55"/>
      <rect x="78" y="87" width="30" height="5" rx="2.5" fill="#F97316" opacity="0.75"/>
      <rect x="83" y="120" width="14" height="18" rx="3" fill="#1E2235"/>
      <rect x="58" y="136" width="64" height="10" rx="5" fill="#1E2235"/>
      <circle cx="148" cy="40" r="8" fill="#22C55E" opacity="0.25"/>
      <circle cx="148" cy="40" r="5" fill="#22C55E"/>
    </svg>
  );
}

export function LogoFull({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={32} />
      <div className="flex flex-col leading-none">
        <span className="text-[15px] font-black tracking-tight" style={{ color: "#F97316" }}>
          LineOps
        </span>
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.45)" }}>
          KDS
        </span>
      </div>
    </div>
  );
}
