export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lops-bg" x1="0" y1="0" x2="180" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#16161F"/>
          <stop offset="100%" stopColor="#0A0A12"/>
        </linearGradient>
        <linearGradient id="lops-stem" x1="36" y1="28" x2="70" y2="134" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A"/>
          <stop offset="45%" stopColor="#F97316"/>
          <stop offset="100%" stopColor="#EA580C"/>
        </linearGradient>
        <linearGradient id="lops-base" x1="36" y1="118" x2="144" y2="154" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F97316"/>
          <stop offset="100%" stopColor="#9A3412"/>
        </linearGradient>
      </defs>
      <rect width="180" height="180" rx="40" fill="url(#lops-bg)"/>
      <rect x="1" y="1" width="178" height="178" rx="39" stroke="rgba(249,115,22,0.18)" strokeWidth="1.5"/>
      <circle cx="114" cy="50" r="2.5" fill="rgba(255,255,255,0.08)"/>
      <circle cx="132" cy="50" r="2.5" fill="rgba(255,255,255,0.08)"/>
      <circle cx="150" cy="50" r="2.5" fill="rgba(255,255,255,0.08)"/>
      <circle cx="114" cy="68" r="2.5" fill="rgba(255,255,255,0.06)"/>
      <circle cx="132" cy="68" r="2.5" fill="rgba(255,255,255,0.06)"/>
      <circle cx="150" cy="68" r="2.5" fill="rgba(255,255,255,0.06)"/>
      <circle cx="114" cy="86" r="2.5" fill="rgba(255,255,255,0.04)"/>
      <circle cx="132" cy="86" r="2.5" fill="rgba(255,255,255,0.04)"/>
      <rect x="36" y="28" width="34" height="106" rx="8" fill="url(#lops-stem)"/>
      <rect x="36" y="118" width="108" height="36" rx="8" fill="url(#lops-base)"/>
      <rect x="36" y="28" width="13" height="106" rx="8" fill="rgba(255,255,255,0.20)"/>
      <rect x="36" y="28" width="34" height="13" rx="6" fill="rgba(255,220,150,0.22)"/>
      <circle cx="150" cy="36" r="16" fill="#0A0A12"/>
      <circle cx="150" cy="36" r="10" fill="#22C55E"/>
      <circle cx="147" cy="33" r="3.5" fill="rgba(255,255,255,0.42)"/>
    </svg>
  );
}

export function LogoFull({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={32} />
      <div className="flex flex-col leading-none gap-[3px]">
        <span className="text-[14px] font-black tracking-tight" style={{ color: "#F97316" }}>
          LineOps
        </span>
        <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: "rgba(255,255,255,0.50)" }}>
          Kitchen Display
        </span>
      </div>
    </div>
  );
}
