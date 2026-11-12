import { useEffect, useState } from 'preact/hooks';
import type { GameState } from '../sim/types';

// ---------- formatting ----------

export function money(v: number): string {
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(a >= 1e10 ? 1 : 2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
  return `${sign}$${Math.round(a).toLocaleString('en-US')}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const dateLabel = (month: number) => `${MONTHS[month % 12]} ${1900 + Math.floor(month / 12)}`;
export const asset = (name: string) => `assets/${name}.webp`;
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- saves (localStorage; every access guarded so the game still runs without it) ----------

const AUTO = 'fit.save.v1';
const SLOT = 'fit.slot.v1';
const PREFS = 'fit.prefs.v1';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
const valid = (s: GameState | null) => (s && s.version === 1 && Array.isArray(s.films) ? s : null);

export const loadAuto = () => valid(read<GameState>(AUTO));
export const saveAuto = (s: GameState) => write(AUTO, s);
export const loadSlot = () => valid(read<GameState>(SLOT));
export const saveSlot = (s: GameState) => write(SLOT, s);
export function clearAuto() {
  try { localStorage.removeItem(AUTO); } catch { /* ignore */ }
}
export const loadPrefs = () => read<{ sound: boolean }>(PREFS) ?? { sound: true };
export const savePrefs = (p: { sound: boolean }) => write(PREFS, p);

// ---------- small hooks ----------

/** Animates a number from 0 to target. */
export function useCountUp(target: number, ms: number, delay = 0): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / ms));
      setV(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

// ---------- sound: a few synthesized blips, no audio files ----------

let ctx: AudioContext | null = null;
let soundOn = loadPrefs().sound;
export const isSoundOn = () => soundOn;
export function setSound(on: boolean) {
  soundOn = on;
  savePrefs({ sound: on });
}
function tone(freq: number, at: number, dur: number, type: OscillatorType = 'triangle', gain = 0.06) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime + at);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + at);
  o.stop(ctx.currentTime + at + dur + 0.02);
}
export function sfx(kind: 'tap' | 'cash' | 'hit' | 'flop' | 'roll') {
  if (!soundOn) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    if (kind === 'tap') tone(520, 0, 0.06, 'square', 0.025);
    if (kind === 'cash') [880, 1175].forEach((f, i) => tone(f, i * 0.07, 0.12));
    if (kind === 'roll') [330, 392, 494].forEach((f, i) => tone(f, i * 0.09, 0.14));
    if (kind === 'hit') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3));
    if (kind === 'flop') [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.32, 'sawtooth', 0.035));
  } catch { /* audio is optional */ }
}
