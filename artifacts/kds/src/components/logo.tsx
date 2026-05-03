export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="180" rx="38" fill="#09090F"/>
      <rect x="36" y="24" width="34" height="110" rx="6" fill="white"/>
      <rect x="36" y="118" width="110" height="36" rx="6" fill="white"/>
      <rect x="70" y="118" width="76" height="36" rx="6" fill="#F97316"/>
      <rect x="70" y="118" width="12" height="22" fill="white"/>
      <circle cx="148" cy="34" r="14" fill="#09090F"/>
      <circle cx="148" cy="34" r="9" fill="#22C55E"/>
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
