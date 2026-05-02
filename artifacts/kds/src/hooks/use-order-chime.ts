import { useCallback, useRef } from "react";

export type ChimeType = "ding" | "beep" | "blip" | "chime";

export function useOrderChime() {
  const ctxRef = useRef<AudioContext | null>(null);

  function getCtx(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }

  const playChime = useCallback((type: ChimeType, volume: number) => {
    if (volume <= 0) return;
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;

      if (type === "ding") {
        // Crisp single square-wave pulse — classic KDS single-fire
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.45, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now); osc.stop(now + 0.14);

      } else if (type === "beep") {
        // Classic restaurant KDS double-beep — two sharp square-wave pulses
        [0, 0.18].forEach(delay => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = "square";
          osc.frequency.setValueAtTime(1047, now + delay);
          gain.gain.setValueAtTime(0, now + delay);
          gain.gain.linearRampToValueAtTime(volume * 0.38, now + delay + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.085);
          osc.start(now + delay); osc.stop(now + delay + 0.085);
        });

      } else if (type === "blip") {
        // Very short rising blip — item-level feedback
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.38, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now); osc.stop(now + 0.12);

      } else if (type === "chime") {
        // Soothing two-note bell: perfect fourth interval — used for escalation alerts
        [[523.25, 0], [698.46, 0.22]].forEach(([freq, delay]) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + delay);
          gain.gain.setValueAtTime(0, now + delay);
          gain.gain.linearRampToValueAtTime(volume * 0.38, now + delay + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 2.2);
          osc.start(now + delay); osc.stop(now + delay + 2.2);
        });
      }
    } catch {
      // AudioContext not available (e.g. SSR or blocked)
    }
  }, []);

  return { playChime };
}
