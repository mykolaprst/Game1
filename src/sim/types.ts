export type Role = 'writer' | 'director' | 'actor';
export type DeptId = 'writing' | 'production' | 'camera' | 'post' | 'marketing';
export type EraId = 'silent' | 'sound' | 'blockbuster';
export type Fit = 'great' | 'ok' | 'poor';
export type Verdict = 'flop' | 'modest' | 'hit' | 'smash' | 'blockbuster';

export interface PersonDef {
  id: string; name: string; role: Role;
  debut: number; peak: number; retire: number;
  stats: Record<string, number>;
  fame: number; loves: string[]; weak: string[];
}
export interface TechDef {
  id: string; name: string; category: 'camera' | 'post' | 'production' | 'marketing';
  year: number; cost: number; months: number; desc: string;
  unlocksTier?: boolean;
  essential?: { after: number; mult: number; label: string };
}
export interface GenreDef {
  id: string; name: string; year: number; tech?: string;
  taste: Record<EraId, number>; audience: Record<string, number>;
}
export interface ThemeDef { id: string; name: string; great: string[]; poor: string[] }
export interface TierDef { id: string; name: string; cost: number; value: number; months: number; reach: number; desc: string; tech?: string; dept?: number }
export interface CampaignDef { id: string; name: string; cost: number; reach: number; tech?: string; desc: string }
export interface AudienceDef { id: string; name: string; size: Record<EraId, number> }
export interface DeptDef { id: DeptId; name: string; sprite: string; desc: string }
export interface EraDef { id: EraId; name: string; start: number; end: number; maxDeptLevel: number; blurb: string }
export interface EventEffects {
  cash?: number; rep?: number; tech?: string; months?: number;
  market?: { mult: number; years: number; label: string };
}
export interface EventDef {
  id: string; year: number; image: string; title: string; text: string;
  options: { label: string; detail: string; effects: EventEffects }[];
}

export interface FilmPlan {
  title: string; genre: string; theme: string; audience: string; tier: string;
  writer: string; director: string; lead: string; campaign: string;
}
export interface Scores { script: number; direction: number; acting: number; visuals: number; production: number; post: number }
export interface FilmRecord extends FilmPlan {
  n: number; year: number; month: number;
  color: boolean; sound: boolean;
  quality: number; scores: Scores; themeFit: Fit;
  costs: { production: number; talent: number; marketing: number; total: number };
  gross: number; profit: number; verdict: Verdict;
  repDelta: number; fameDelta: Record<string, number>;
  notes: { text: string; good: boolean }[];
}
export interface GameState {
  version: 1;
  seed: number;
  studio: string;
  month: number;              // months since January 1900
  cash: number;               // dollars
  rep: number;                // 0..100
  depts: Record<DeptId, number>;
  techs: string[];
  research: { id: string; monthsLeft: number } | null;
  people: Record<string, { fame: number; films: number }>;
  films: FilmRecord[];
  discovered: Record<string, Fit>;
  eventsSeen: string[];
  pendingEvents: string[];
  pendingEra: EraId | null;
  marketMods: { mult: number; untilMonth: number; label: string }[];
  bailouts: number;
  needBailout: boolean;
  news: { month: number; text: string }[];
  history: { month: number; cash: number }[];
  ledger: { upkeep: number; research: number; upgrades: number; events: number };
  tutorialDone: boolean;
  over: null | 'bankrupt' | 'finale';
}
