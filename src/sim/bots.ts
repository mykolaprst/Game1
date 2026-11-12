// Scripted players used by the balance simulator and the tests.
import { CAMPAIGN, DEPTS, EVENT, THEMES, TIERS } from './data';
import {
  availableCampaigns, availableGenres, availableTechs, checkPlan, dismissEra, eventAffordable, genreFit, newGame,
  peopleNow, produceFilm, resolveEvent, startResearch, takeBailout, techCost, themeFit, tierUnlocked, trendAt, unitAt,
  upgradeCost, upgradeDept, yearOf,
} from './game';
import { rand } from './rng';
import { generateTitle } from './titles';
import type { FilmPlan, GameState, Role } from './types';

export type Strategy = 'random' | 'cheapskate' | 'bigSpender' | 'balanced' | 'genreSpam' | 'noResearch' | 'noUpgrades';
export const STRATEGIES: Strategy[] = ['random', 'cheapskate', 'bigSpender', 'balanced', 'genreSpam', 'noResearch', 'noUpgrades'];

function choosePlan(state: GameState, s: Strategy, salt: number): FilmPlan | null {
  const r = (k: string) => rand(state.seed, 'bot', s, k, salt, state.films.length);
  const people = peopleNow(state).filter((p) => p.willing);
  const genres = availableGenres(state);
  const year = yearOf(state.month);
  const trend = trendAt(state.seed, year);
  const last = state.films[state.films.length - 1]?.genre;
  let genre: string;
  if (s === 'random') genre = genres[Math.floor(r('g') * genres.length)].id;
  else if (s === 'genreSpam') genre = 'comedy';
  else if (genres.some((g) => g.id === trend.hot) && trend.hot !== last) genre = trend.hot;
  else {
    const pool = genres.filter((g) => g.id !== trend.cold && g.id !== last);
    genre = pool[Math.floor(r('g') * pool.length)].id;
  }
  const smart = s !== 'random' && s !== 'cheapskate';
  const great = THEMES.filter((t) => themeFit(genre, t.id) === 'great');
  const theme = smart && great.length ? great[Math.floor(r('t') * great.length)].id : THEMES[Math.floor(r('t') * THEMES.length)].id;
  const tiers = TIERS.filter((t) => tierUnlocked(state, t.id));
  const camps = availableCampaigns(state);
  const audience = s === 'random' ? ['family', 'general', 'adult'][Math.floor(r('a') * 3)] : 'general';

  const pickPerson = (role: Role, mode: 'best' | 'cheap' | 'random', budget: number) => {
    const pool = people.filter((p) => p.def.role === role);
    if (mode === 'random') return pool[Math.floor(r(role) * pool.length)];
    const cheapest = [...pool].sort((a, b) => a.fee - b.fee)[0];
    if (mode === 'cheap') return cheapest;
    const affordable = pool.filter((p) => p.fee <= budget);
    const from = affordable.length ? affordable : [cheapest];
    return [...from].sort((a, b) => b.skill * genreFit(b.def, genre) - a.skill * genreFit(a.def, genre))[0];
  };

  // Try from the most ambitious option the strategy would pick down to the cheapest one.
  const order = s === 'cheapskate' ? [tiers[0]] : s === 'random' ? [tiers[Math.floor(r('tier') * tiers.length)], tiers[0]] : [...tiers].reverse();
  const reserve = s === 'bigSpender' ? 1.0 : 1.6; // careful bots keep a cushion
  const mode = s === 'cheapskate' ? 'cheap' : s === 'random' ? 'random' : 'best';
  for (const tier of order) {
    const perHead = (state.cash / reserve - tier.cost * unitAt(state.month)) / 3.5;
    const campList = s === 'cheapskate' ? [camps[0]] : s === 'random' ? [camps[Math.floor(r('c') * camps.length)], camps[0]] : [...camps].reverse();
    for (const camp of campList) {
      const plan: FilmPlan = {
        title: generateTitle(state.seed, state.films.length + salt, genre, theme),
        genre, theme, audience, tier: tier.id, campaign: camp.id,
        writer: pickPerson('writer', mode, perHead).id,
        director: pickPerson('director', mode, perHead).id,
        lead: pickPerson('actor', mode, perHead * 1.5).id,
      };
      const c = checkPlan(state, plan);
      const lastChance = tier === tiers[0] && camp === CAMPAIGN.none;
      if (c.ok && (reserve === 1 || mode !== 'best' || c.costs.total * reserve <= state.cash || lastChance)) return plan;
    }
  }
  // Last resort: the cheapest possible film.
  const plan: FilmPlan = {
    title: generateTitle(state.seed, state.films.length + salt, genre, theme), genre, theme, audience,
    tier: TIERS[0].id, campaign: 'none',
    writer: pickPerson('writer', 'cheap', 0).id, director: pickPerson('director', 'cheap', 0).id, lead: pickPerson('actor', 'cheap', 0).id,
  };
  return checkPlan(state, plan).ok ? plan : null;
}

function invest(state: GameState, s: Strategy): GameState {
  if (s === 'cheapskate' || (s === 'random' && rand(state.seed, 'inv', state.films.length) < 0.5)) return state;
  const cushion = (s === 'bigSpender' ? 3 : 6) * unitAt(state.month);
  if (s !== 'noResearch' && !state.research) {
    const next = availableTechs(state).sort((a, b) => (b.essential ? 1 : 0) - (a.essential ? 1 : 0) || a.year - b.year)[0];
    if (next && state.cash - techCost(state, next.id) > cushion) state = startResearch(state, next.id);
  }
  if (s !== 'noUpgrades') {
    for (const d of [...DEPTS].sort((a, b) => state.depts[a.id] - state.depts[b.id])) {
      const cost = upgradeCost(state, d.id);
      if (cost !== null && state.cash - cost > cushion * 1.5) { state = upgradeDept(state, d.id); break; }
    }
  }
  return state;
}

export interface CareerResult {
  strategy: Strategy; state: GameState; films: number; worth: number; rep: number;
  over: GameState['over']; bailouts: number; avgQuality: number;
}

/** Play one whole career from 1900 to the end with a scripted strategy. */
export function playCareer(seed: number, s: Strategy, untilYear = Infinity): CareerResult {
  let state = newGame(seed);
  for (let guard = 0; guard < 2000 && !state.over && yearOf(state.month) < untilYear; guard++) {
    if (state.pendingEra) state = dismissEra(state);
    if (state.pendingEvents.length) {
      const id = state.pendingEvents[0];
      const ev = EVENT[id];
      const wantsTech = s !== 'cheapskate' && s !== 'noResearch';
      let opt = ev.options.findIndex((o) => o.effects.tech && wantsTech && eventAffordable(state, o.effects));
      if (opt < 0) opt = s === 'random' ? Math.floor(rand(seed, 'ev', id) * ev.options.length) : Math.max(0, ev.options.findIndex((o) => !o.effects.tech));
      if (!eventAffordable(state, ev.options[opt].effects)) opt = ev.options.findIndex((o) => eventAffordable(state, o.effects));
      state = resolveEvent(state, id, opt);
      continue;
    }
    if (state.needBailout) { state = takeBailout(state); continue; }
    state = invest(state, s);
    if (state.needBailout || state.over) continue;
    const plan = choosePlan(state, s, guard);
    if (!plan) throw new Error(`bot ${s} could not plan a film in ${yearOf(state.month)} with $${state.cash}`);
    state = produceFilm(state, plan).state;
  }
  const q = state.films.reduce((a, f) => a + f.quality, 0) / Math.max(1, state.films.length);
  return {
    strategy: s, state, films: state.films.length, worth: state.cash / unitAt(state.month), rep: state.rep,
    over: state.over, bailouts: state.bailouts, avgQuality: q,
  };
}
