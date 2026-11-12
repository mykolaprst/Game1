// The simulation layer. Pure functions only: (state, input) -> new state.
// Nothing in here touches the DOM, storage or the clock, so it runs headless in tests
// and in the balance simulator (scripts/balance.ts).
import {
  AUDIENCE, BAL, CAMPAIGN, CAMPAIGNS, COST_ANCHORS, DEPTS, DEPT_UPGRADE_COST, DEPT_UPKEEP, END_YEAR, ERAS,
  EVENT, EVENTS, GENRE, GENRES, PEOPLE, PERSON, START_YEAR, TECH, TECHS, THEME, TIER, TIERS, UNIT_DOLLARS,
} from './data';
import { rand } from './rng';
import type {
  DeptId, EraDef, EventEffects, FilmPlan, FilmRecord, Fit, GameState, PersonDef, Role, Scores, TechDef, Verdict,
} from './types';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// ---------- time & money ----------

export const yearOf = (month: number) => START_YEAR + Math.floor(month / 12);
export const yearFrac = (month: number) => START_YEAR + month / 12;

export function eraOf(year: number): EraDef {
  return ERAS.find((e) => year >= e.start && year <= e.end) ?? ERAS[ERAS.length - 1];
}

/** Price level relative to 1900, interpolated on a log scale between the anchors in eras.json. */
export function costIndex(year: number): number {
  const a = COST_ANCHORS;
  if (year <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++) {
    if (year <= a[i][0]) {
      const t = (year - a[i - 1][0]) / (a[i][0] - a[i - 1][0]);
      return Math.exp(Math.log(a[i - 1][1]) + t * (Math.log(a[i][1]) - Math.log(a[i - 1][1])));
    }
  }
  return a[a.length - 1][1];
}

/** Dollars per "unit" (the scale all costs in the data tables are written in) at a given month. */
export function unitAt(month: number): number {
  const raw = UNIT_DOLLARS * costIndex(yearFrac(month));
  const mag = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / mag) * mag; // two significant figures keeps prices readable
}

// ---------- new game ----------

export function newGame(seed: number, studio = 'Sunburst Pictures'): GameState {
  return {
    version: 1,
    seed,
    studio,
    month: 0,
    cash: BAL.startCashUnits * unitAt(0),
    rep: BAL.startRep,
    depts: { writing: 1, production: 1, camera: 1, post: 1, marketing: 1 },
    techs: [],
    research: null,
    people: {},
    films: [],
    discovered: {},
    eventsSeen: [],
    pendingEvents: [],
    pendingEra: null,
    marketMods: [],
    bailouts: 0,
    needBailout: false,
    news: [{ month: 0, text: 'You open a small picture studio in a converted barn.' }],
    history: [{ month: 0, cash: BAL.startCashUnits * unitAt(0) }],
    ledger: { upkeep: 0, research: 0, upgrades: 0, events: 0 },
    tutorialDone: false,
    over: null,
  };
}

// ---------- people ----------

export interface PersonNow {
  def: PersonDef;
  id: string;
  stats: Record<string, number>;
  skill: number;          // role score before genre fit, 0..100
  fame: number;
  fee: number;            // dollars
  phase: 'rising' | 'peak' | 'fading';
  willing: boolean;
}

function arc(p: PersonDef, year: number): number {
  if (year <= p.peak) return 0.72 + 0.28 * ((year - p.debut) / Math.max(1, p.peak - p.debut));
  const hold = p.peak + 5;
  if (year <= hold) return 1;
  return 1 - 0.3 * ((year - hold) / Math.max(1, p.retire - hold));
}

function roleSkill(role: Role, stats: Record<string, number>, sound: boolean): number {
  if (role === 'writer') return sound ? 0.5 * stats.story + 0.5 * stats.dialogue : stats.story;
  if (role === 'director') return 0.5 * stats.vision + 0.5 * stats.craft;
  return sound ? 0.7 * stats.talent + 0.3 * stats.voice : stats.talent;
}

export function fameOf(state: GameState, id: string): number {
  return state.people[id]?.fame ?? PERSON[id].fame;
}

/** Everyone working in the industry this year, with their current (career-adjusted) stats and fee. */
export function peopleNow(state: GameState): PersonNow[] {
  const year = yearOf(state.month);
  const unit = unitAt(state.month);
  const sound = state.techs.includes('sync_sound');
  const active = PEOPLE.filter((p) => year >= p.debut && year <= p.retire);
  const list = active.map((p): PersonNow => {
    const m = clamp(arc(p, year), 0.5, 1);
    const stats = Object.fromEntries(Object.entries(p.stats).map(([k, v]) => [k, Math.round(v * m)]));
    const fame = fameOf(state, p.id);
    const avg = Object.values(stats).reduce((a, b) => a + b, 0) / Object.values(stats).length;
    const feeUnits = (BAL.feeBase + Math.pow(avg / 100, 2) * BAL.feeSkill + (fame / 100) * BAL.feeFame) * BAL.feeRole[p.role];
    return {
      def: p, id: p.id, stats, fame,
      skill: roleSkill(p.role, stats, sound),
      fee: Math.round(feeUnits * unit),
      phase: year < p.peak - 1 ? 'rising' : year <= p.peak + 5 ? 'peak' : 'fading',
      willing: fame <= state.rep + BAL.refuseGap,
    };
  });
  // The least famous person in each role will always take the job, so the studio can never be locked out.
  for (const role of ['writer', 'director', 'actor'] as Role[]) {
    const pool = list.filter((p) => p.def.role === role);
    if (pool.length && !pool.some((p) => p.willing)) {
      pool.sort((a, b) => a.fame - b.fame)[0].willing = true;
    }
  }
  return list;
}

export function genreFit(p: PersonDef, genre: string): number {
  if (p.loves.includes(genre)) return BAL.loveFit;
  if (p.weak.includes(genre)) return BAL.weakFit;
  return 1;
}

// ---------- catalogue: what is unlocked right now ----------

export function availableGenres(state: GameState) {
  const year = yearOf(state.month);
  return GENRES.filter((g) => year >= g.year && (!g.tech || state.techs.includes(g.tech)));
}
export function tierUnlocked(state: GameState, tierId: string): boolean {
  const t = TIER[tierId];
  return (!t.tech || state.techs.includes(t.tech)) && (!t.dept || state.depts.production >= t.dept);
}
export function availableCampaigns(state: GameState) {
  return CAMPAIGNS.filter((c) => !c.tech || state.techs.includes(c.tech));
}
export function availableTechs(state: GameState): TechDef[] {
  const year = yearOf(state.month);
  return TECHS.filter((t) => year >= t.year && !state.techs.includes(t.id));
}
export function themeFit(genre: string, theme: string): Fit {
  const t = THEME[theme];
  return t.great.includes(genre) ? 'great' : t.poor.includes(genre) ? 'poor' : 'ok';
}

/** The genre audiences are craving and the one they are bored of. Changes every few years. */
export function trendAt(seed: number, year: number): { hot: string; cold: string } {
  const period = Math.floor((year - START_YEAR) / BAL.trendYears);
  const periodStart = START_YEAR + period * BAL.trendYears;
  const pool = GENRES.filter((g) => g.year <= periodStart).map((g) => g.id);
  const hot = pool[Math.floor(rand(seed, 'hot', period) * pool.length)];
  const rest = pool.filter((g) => g !== hot);
  const cold = rest[Math.floor(rand(seed, 'cold', period) * rest.length)];
  return { hot, cold };
}

// ---------- film formula ----------

function craft(state: GameState, dept: DeptId): number {
  const max = eraOf(yearOf(state.month)).maxDeptLevel;
  return BAL.craftBase + BAL.craftRange * ((state.depts[dept] - 1) / (max - 1));
}

/** 0..25 (+novelty): how up to date the studio is in one tech category. Unowned tech hurts more as it becomes standard. */
function techScore(state: GameState, category: TechDef['category']): number {
  const yf = yearFrac(state.month);
  const avail = TECHS.filter((t) => t.category === category && t.year <= yf);
  if (!avail.length) return BAL.techScoreMax;
  let lag = 0;
  let novelty = 0;
  for (const t of avail) {
    const ramp = clamp((yf - t.year) / BAL.techRampYears, 0, 1);
    if (state.techs.includes(t.id)) novelty += BAL.techNovelty * (1 - ramp);
    else lag += ramp;
  }
  return BAL.techScoreMax * (1 - lag / avail.length) + novelty;
}

export interface PlanCheck {
  ok: boolean;
  errors: string[];
  costs: { production: number; talent: number; marketing: number; total: number };
  months: number;
}

export function checkPlan(state: GameState, plan: Partial<FilmPlan>): PlanCheck {
  const unit = unitAt(state.month);
  const people = peopleNow(state);
  const errors: string[] = [];
  const tier = plan.tier ? TIER[plan.tier] : undefined;
  const camp = plan.campaign ? CAMPAIGN[plan.campaign] : undefined;
  let talent = 0;
  for (const [key, role] of [['writer', 'writer'], ['director', 'director'], ['lead', 'actor']] as const) {
    const id = plan[key];
    if (!id) { errors.push(`Choose a ${key === 'lead' ? 'lead actor' : role}.`); continue; }
    const p = people.find((x) => x.id === id);
    if (!p || p.def.role !== role) errors.push(`${PERSON[id]?.name ?? id} is not available.`);
    else if (!p.willing) errors.push(`${p.def.name} will not work for a studio of your standing.`);
    else talent += p.fee;
  }
  if (!plan.genre || !availableGenres(state).some((g) => g.id === plan.genre)) errors.push('Choose a genre.');
  if (!plan.theme || !THEME[plan.theme]) errors.push('Choose a theme.');
  if (!plan.audience || !AUDIENCE[plan.audience]) errors.push('Choose an audience.');
  if (!tier) errors.push('Choose a budget.');
  else if (!tierUnlocked(state, tier.id)) errors.push(`${tier.name} budgets are not unlocked yet.`);
  if (!camp) errors.push('Choose a campaign.');
  else if (camp.tech && !state.techs.includes(camp.tech)) errors.push(`${camp.name} is not unlocked yet.`);
  const production = Math.round((tier?.cost ?? 0) * unit);
  const marketing = Math.round((camp?.cost ?? 0) * unit);
  const total = production + talent + marketing;
  if (!errors.length && total > state.cash) errors.push('Not enough cash for this production.');
  if (state.over) errors.push('The studio has closed.');
  return { ok: errors.length === 0, errors, costs: { production, talent, marketing, total }, months: tier?.months ?? 0 };
}

/** Cheapest film the studio could possibly make right now. Below this, the bank has to step in. */
export function minFilmCost(state: GameState): number {
  const people = peopleNow(state).filter((p) => p.willing);
  const cheapest = (role: Role) => Math.min(...people.filter((p) => p.def.role === role).map((p) => p.fee));
  return Math.round(TIERS[0].cost * unitAt(state.month)) + cheapest('writer') + cheapest('director') + cheapest('actor');
}

function verdictOf(roi: number): Verdict {
  return roi < 0.8 ? 'flop' : roi < 1.15 ? 'modest' : roi < 2 ? 'hit' : roi < 3.2 ? 'smash' : 'blockbuster';
}

/** Make and release a film. Deterministic: same state + same plan => same result. */
export function produceFilm(input: GameState, plan: FilmPlan): { state: GameState; film: FilmRecord } {
  const check = checkPlan(input, plan);
  if (!check.ok) throw new Error(check.errors.join(' '));
  const state = clone(input);
  const n = state.films.length + 1;
  const year0 = yearOf(state.month);
  const era = eraOf(year0);
  const people = peopleNow(state);
  const writer = people.find((p) => p.id === plan.writer)!;
  const director = people.find((p) => p.id === plan.director)!;
  const lead = people.find((p) => p.id === plan.lead)!;
  const tier = TIER[plan.tier];
  const camp = CAMPAIGN[plan.campaign];
  const genre = GENRE[plan.genre];
  const sound = state.techs.includes('sync_sound');
  const color = state.techs.includes('color');
  const notes: FilmRecord['notes'] = [];

  // --- quality ---
  const fit = (p: typeof writer) => clamp(p.skill * genreFit(p.def, plan.genre), 0, 100);
  const scores: Scores = {
    script: fit(writer) * 0.75 + craft(state, 'writing') * 0.25,
    direction: fit(director),
    acting: fit(lead),
    visuals: craft(state, 'camera') + techScore(state, 'camera'),
    production: tier.value * 0.6 + (craft(state, 'production') + techScore(state, 'production')) * 0.4,
    post: craft(state, 'post') + techScore(state, 'post'),
  };
  for (const k of Object.keys(scores) as (keyof Scores)[]) scores[k] = Math.round(clamp(scores[k], 1, 100));
  const w = BAL.qualityWeights;
  const tf = themeFit(plan.genre, plan.theme);
  const base =
    scores.script * w.script + scores.direction * w.direction + scores.acting * w.acting +
    scores.visuals * w.visuals + scores.production * w.production + scores.post * w.post;
  const noise = (rand(state.seed, 'q', n) * 2 - 1) * BAL.noise;
  const quality = Math.round(clamp(base * BAL.themeFit[tf] + noise, 1, 100));
  if (tf === 'great') notes.push({ text: `${genre.name} and ${THEME[plan.theme].name} are a perfect match`, good: true });
  if (tf === 'poor') notes.push({ text: `${THEME[plan.theme].name} was an odd fit for a ${genre.name}`, good: false });
  for (const p of [writer, director, lead]) {
    if (p.def.loves.includes(plan.genre)) notes.push({ text: `${p.def.name} was born for ${genre.name}`, good: true });
    if (p.def.weak.includes(plan.genre)) notes.push({ text: `${p.def.name} struggled with ${genre.name}`, good: false });
  }

  // --- box office ---
  const unit = unitAt(state.month);
  const releaseMonth = state.month + tier.months;
  const releaseYear = yearOf(releaseMonth);
  const trend = trendAt(state.seed, releaseYear);
  // Audiences expect more from a famous studio, so the bar rises with reputation.
  const pivot = BAL.appealPivot + state.rep * BAL.appealRepPivot;
  let mult = tier.reach * Math.pow(quality / pivot, BAL.appealPower);
  mult *= genre.taste[era.id];
  if (trend.hot === plan.genre) { mult *= BAL.trendHot; notes.push({ text: `Audiences are craving ${genre.name}`, good: true }); }
  if (trend.cold === plan.genre) { mult *= BAL.trendCold; notes.push({ text: `Audiences are bored of ${genre.name}`, good: false }); }
  let streak = 0;
  for (let i = state.films.length - 1; i >= 0 && state.films[i].genre === plan.genre; i--) streak++;
  const fatigue = BAL.fatigue[Math.min(streak, BAL.fatigue.length - 1)];
  if (fatigue < 1) { mult *= fatigue; notes.push({ text: `Too many ${genre.name} pictures in a row: the public wants something new`, good: false }); }
  mult *= camp.reach * (1 + 0.05 * (state.depts.marketing - 1));
  mult *= 1 + (lead.stats.charisma / 100) * (lead.fame / 100) * 0.5;
  if (lead.fame >= 60) notes.push({ text: `${lead.def.name}'s name on the marquee sold tickets`, good: true });
  mult *= 0.85 + (state.rep / 100) * 0.45;
  mult *= AUDIENCE[plan.audience].size[era.id] * genre.audience[plan.audience];
  for (const t of TECHS) {
    if (t.essential && !state.techs.includes(t.id) && releaseYear > t.essential.after) {
      mult *= t.essential.mult;
      notes.push({ text: t.essential.label, good: false });
    }
  }
  for (const m of state.marketMods) if (m.untilMonth > releaseMonth) mult *= m.mult;
  mult *= 1 + (rand(state.seed, 'g', n) * 2 - 1) * BAL.grossNoise;
  const gross = Math.round(BAL.baseGross * mult * unit);

  // --- apply ---
  const total = check.costs.total;
  state.cash -= total;
  advance(state, tier.months);
  state.cash += gross;
  const profit = gross - total;
  const verdict = verdictOf(gross / Math.max(1, total));
  // The better known the studio, the better a film has to be to add to its name.
  const repBar = BAL.repBar + state.rep * BAL.repBarSlope;
  const repDelta = Math.round(clamp((quality - repBar) / 5, -4, 5) + (profit > 0 ? 0.5 : -0.5));
  state.rep = clamp(state.rep + repDelta, 0, 100);
  const fameGain = Math.round(clamp((quality - 55) / 6 + (profit > 0 ? 2 : -2), -5, 9));
  const fameDelta: Record<string, number> = {};
  for (const p of [writer, director, lead]) {
    const before = fameOf(state, p.id);
    const after = clamp(before + fameGain, 0, 100);
    state.people[p.id] = { fame: after, films: (state.people[p.id]?.films ?? 0) + 1 };
    fameDelta[p.id] = after - before;
  }
  state.discovered[`${plan.genre}|${plan.theme}`] = tf;

  const film: FilmRecord = {
    ...plan, n, year: releaseYear, month: releaseMonth, color, sound, quality, scores, themeFit: tf,
    costs: check.costs, gross, profit, verdict, repDelta, fameDelta, notes,
  };
  state.films.push(film);
  state.history.push({ month: state.month, cash: state.cash });
  if (verdict === 'smash' || verdict === 'blockbuster') state.news.push({ month: state.month, text: `"${film.title}" is the talk of the town.` });
  settle(state);
  return { state, film };
}

// ---------- time passing ----------

/** Move the calendar forward: pay upkeep, progress research, announce arrivals, queue events. Mutates. */
function advance(state: GameState, months: number): void {
  for (let i = 0; i < months; i++) {
    const unit = unitAt(state.month);
    const upkeep = DEPTS.reduce((s, d) => s + (state.depts[d.id] - 1), 0) * DEPT_UPKEEP * unit;
    state.cash -= upkeep;
    state.ledger.upkeep += upkeep;
    if (state.research) {
      state.research.monthsLeft -= 1;
      if (state.research.monthsLeft <= 0) {
        const t = TECH[state.research.id];
        state.techs.push(t.id);
        state.news.push({ month: state.month, text: `Research complete: ${t.name}.` });
        state.research = null;
      }
    }
    const before = yearOf(state.month);
    state.month += 1;
    const after = yearOf(state.month);
    if (after !== before) onNewYear(state, after);
  }
  state.cash = Math.round(state.cash);
}

function onNewYear(state: GameState, year: number): void {
  for (const p of PEOPLE) {
    if (p.debut === year) state.news.push({ month: state.month, text: `New face in town: ${p.name}, ${p.role}.` });
    if (p.retire + 1 === year) state.news.push({ month: state.month, text: `${p.name} has retired from pictures.` });
  }
  for (const t of TECHS) if (t.year === year) state.news.push({ month: state.month, text: `New technology to research: ${t.name}.` });
  for (const g of GENRES) if (g.year === year && year > START_YEAR && !g.tech) state.news.push({ month: state.month, text: `A new genre is emerging: ${g.name}.` });
  for (const e of EVENTS) {
    if (e.year <= year && !state.eventsSeen.includes(e.id) && !state.pendingEvents.includes(e.id)) state.pendingEvents.push(e.id);
  }
  const era = ERAS.find((e) => e.start === year);
  if (era && year > START_YEAR) state.pendingEra = era.id;
  state.marketMods = state.marketMods.filter((m) => m.untilMonth > state.month);
  if (state.news.length > 60) state.news = state.news.slice(-60);
}

/** After anything that changes cash or the date: check for the end of the game or the need for a bailout. */
function settle(state: GameState): void {
  if (state.over) return;
  if (yearOf(state.month) > END_YEAR) {
    state.over = 'finale';
    state.pendingEvents = [];
    return;
  }
  state.needBailout = false;
  if (state.cash < minFilmCost(state)) {
    if (state.bailouts < BAL.maxBailouts) state.needBailout = true;
    else state.over = 'bankrupt';
  }
}

// ---------- studio actions ----------

export function upgradeCost(state: GameState, dept: DeptId): number | null {
  const level = state.depts[dept];
  if (level >= eraOf(yearOf(state.month)).maxDeptLevel) return null;
  return Math.round(DEPT_UPGRADE_COST[level] * unitAt(state.month));
}

/** Investments may never eat the money needed to make the next (cheapest) picture. */
export function canSpend(state: GameState, cost: number): boolean {
  return !state.over && state.cash - cost >= minFilmCost(state);
}

export function upgradeDept(input: GameState, dept: DeptId): GameState {
  const cost = upgradeCost(input, dept);
  if (cost === null || !canSpend(input, cost)) return input;
  const state = clone(input);
  state.cash -= cost;
  state.ledger.upgrades += cost;
  state.depts[dept] += 1;
  settle(state);
  return state;
}

export const techCost = (state: GameState, id: string) => Math.round(TECH[id].cost * unitAt(state.month));

export function startResearch(input: GameState, id: string): GameState {
  const t = TECH[id];
  if (!t || input.research || input.over || input.techs.includes(id) || yearOf(input.month) < t.year) return input;
  const cost = techCost(input, id);
  if (!canSpend(input, cost)) return input;
  const state = clone(input);
  state.cash -= cost;
  state.ledger.research += cost;
  state.research = { id, monthsLeft: t.months };
  settle(state);
  return state;
}

export function eventAffordable(state: GameState, effects: EventEffects): boolean {
  return !effects.cash || effects.cash > 0 || state.cash + effects.cash * unitAt(state.month) >= 0;
}

export function resolveEvent(input: GameState, eventId: string, option: number): GameState {
  const ev = EVENT[eventId];
  if (!ev || !input.pendingEvents.includes(eventId)) return input;
  const fx = ev.options[option].effects;
  if (!eventAffordable(input, fx)) return input;
  const state = clone(input);
  state.pendingEvents = state.pendingEvents.filter((e) => e !== eventId);
  state.eventsSeen.push(eventId);
  if (fx.cash) {
    const d = Math.round(fx.cash * unitAt(state.month));
    state.cash += d;
    state.ledger.events += d;
  }
  if (fx.rep) state.rep = clamp(state.rep + fx.rep, 0, 100);
  if (fx.tech && !state.techs.includes(fx.tech)) {
    state.techs.push(fx.tech);
    if (state.research?.id === fx.tech) state.research = null;
    state.news.push({ month: state.month, text: `Acquired: ${TECH[fx.tech].name}.` });
  }
  if (fx.market) state.marketMods.push({ mult: fx.market.mult, untilMonth: state.month + fx.market.years * 12, label: fx.market.label });
  if (fx.months) advance(state, fx.months);
  state.news.push({ month: state.month, text: `${ev.title}: ${ev.options[option].label.toLowerCase()}.` });
  settle(state);
  return state;
}

export function dismissEra(input: GameState): GameState {
  if (!input.pendingEra) return input;
  const state = clone(input);
  state.pendingEra = null;
  return state;
}

/** The bank keeps the lights on, at a price. Limited to a few times per game. */
export function takeBailout(input: GameState): GameState {
  if (!input.needBailout) return input;
  const state = clone(input);
  const grant = Math.max(0, -state.cash) + Math.round(BAL.bailoutUnits * unitAt(state.month)) + minFilmCost(state);
  state.cash += grant;
  state.ledger.events += grant;
  state.rep = clamp(state.rep - BAL.bailoutRep, 0, 100);
  state.bailouts += 1;
  state.needBailout = false;
  state.news.push({ month: state.month, text: 'The bank bailed out the studio. Your name took a knock.' });
  state.history.push({ month: state.month, cash: state.cash });
  return state;
}

// ---------- summary ----------

export function legacy(state: GameState) {
  const hits = state.films.filter((f) => f.verdict === 'hit' || f.verdict === 'smash' || f.verdict === 'blockbuster').length;
  const masterpieces = state.films.filter((f) => f.quality >= 90).length;
  const worth = state.cash / unitAt(state.month);
  const score = Math.max(0, Math.round(state.rep * 10 + hits * 5 + masterpieces * 25 + worth * 2));
  const rank = score >= 2200 ? 'Legend of the Silver Screen' : score >= 1500 ? 'Hollywood Royalty' : score >= 900 ? 'Major Studio' : score >= 450 ? 'Respected Independent' : 'Poverty Row';
  return { hits, masterpieces, worth, score, rank };
}
