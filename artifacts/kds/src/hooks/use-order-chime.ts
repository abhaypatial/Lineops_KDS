import { useCallback, useRef } from "react";

export type ChimeType = "ding" | "bell" | "blip" | "chime";

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
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(1047, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.85, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc.start(now); osc.stop(now + 0.9);

      } else if (type === "bell") {
        [[880, 0.6], [1320, 0.35], [1760, 0.2]].forEach(([freq, amp]) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(volume * amp, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
          osc.start(now); osc.stop(now + 1.4);
        });

      } else if (type === "blip") {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.45, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now); osc.stop(now + 0.18);

      } else if (type === "chime") {
        // Soothing two-note bell: perfect fourth interval, long sine decay
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
