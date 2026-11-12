import { describe, expect, it } from 'vitest';
import { playCareer } from '../src/sim/bots';
import { EVENTS, GENRES, PEOPLE, TECHS, THEMES } from '../src/sim/data';
import {
  availableGenres, checkPlan, costIndex, minFilmCost, newGame, peopleNow, produceFilm, resolveEvent, startResearch,
  takeBailout, techCost, unitAt, upgradeCost, upgradeDept, yearOf,
} from '../src/sim/game';
import type { FilmPlan, GameState } from '../src/sim/types';

const firstPlan = (state: GameState): FilmPlan => {
  const people = peopleNow(state).filter((p) => p.willing).sort((a, b) => a.fee - b.fee);
  const of = (role: string) => people.find((p) => p.def.role === role)!.id;
  return {
    title: 'Test Picture', genre: 'comedy', theme: 'circus', audience: 'general', tier: 'shoestring', campaign: 'none',
    writer: of('writer'), director: of('director'), lead: of('actor'),
  };
};

describe('data tables', () => {
  it('reference only ids that exist', () => {
    const genreIds = new Set(GENRES.map((g) => g.id));
    const techIds = new Set(TECHS.map((t) => t.id));
    for (const t of THEMES) for (const g of [...t.great, ...t.poor]) expect(genreIds.has(g)).toBe(true);
    for (const p of PEOPLE) for (const g of [...p.loves, ...p.weak]) expect(genreIds.has(g)).toBe(true);
    for (const g of GENRES) if (g.tech) expect(techIds.has(g.tech)).toBe(true);
    for (const e of EVENTS) for (const o of e.options) if (o.effects.tech) expect(techIds.has(o.effects.tech)).toBe(true);
  });
  it('always has a writer, a director and an actor working, in every year', () => {
    for (let y = 1900; y <= 1985; y++) {
      for (const role of ['writer', 'director', 'actor']) {
        const n = PEOPLE.filter((p) => p.role === role && y >= p.debut && y <= p.retire).length;
        expect(n, `${role} in ${y}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it('prices rise through the century', () => {
    expect(costIndex(1900)).toBe(1);
    expect(costIndex(1927)).toBeCloseTo(150);
    expect(costIndex(1985)).toBeGreaterThan(costIndex(1960));
  });
});

describe('film production', () => {
  it('is deterministic for the same seed and plan', () => {
    const a = produceFilm(newGame(7), firstPlan(newGame(7)));
    const b = produceFilm(newGame(7), firstPlan(newGame(7)));
    expect(a.film).toEqual(b.film);
    expect(a.state).toEqual(b.state);
    const c = produceFilm(newGame(8), firstPlan(newGame(8)));
    expect(c.film.gross).not.toBe(a.film.gross);
  });
  it('does not mutate the input state and keeps the books straight', () => {
    const s0 = newGame(1);
    const snapshot = JSON.stringify(s0);
    const { state, film } = produceFilm(s0, firstPlan(s0));
    expect(JSON.stringify(s0)).toBe(snapshot);
    expect(film.profit).toBe(film.gross - film.costs.total);
    expect(state.cash).toBe(Math.round(s0.cash - film.costs.total + film.gross - state.ledger.upkeep));
    expect(state.month).toBe(3);
    expect(state.films).toHaveLength(1);
  });
  it('rejects plans the studio cannot make', () => {
    const s = newGame(1);
    expect(checkPlan(s, { ...firstPlan(s), genre: 'scifi' }).ok).toBe(false);
    expect(checkPlan(s, { ...firstPlan(s), tier: 'epic' }).ok).toBe(false);
    expect(checkPlan(s, { ...firstPlan(s), campaign: 'tv' }).ok).toBe(false);
    expect(checkPlan({ ...s, cash: 10 }, firstPlan(s)).ok).toBe(false);
    expect(() => produceFilm({ ...s, cash: 10 }, firstPlan(s))).toThrow();
  });
  it('punishes silent films once sound is standard', () => {
    const base = { ...newGame(3), month: (1934 - 1900) * 12, cash: 1e9 };
    const silent = produceFilm(base, firstPlan(base)).film;
    const withSound = { ...base, techs: ['sync_sound'] };
    const talkie = produceFilm(withSound, firstPlan(withSound)).film;
    expect(silent.gross).toBeLessThan(talkie.gross * 0.6);
    expect(silent.notes.some((n) => /sound/i.test(n.text))).toBe(true);
  });
  it('unlocks musicals only with sound', () => {
    const s = { ...newGame(1), month: (1930 - 1900) * 12 };
    expect(availableGenres(s).some((g) => g.id === 'musical')).toBe(false);
    expect(availableGenres({ ...s, techs: ['sync_sound'] }).some((g) => g.id === 'musical')).toBe(true);
  });
});

describe('studio actions', () => {
  it('upgrades and research cost money and respect limits', () => {
    let s: GameState = { ...newGame(1), cash: 1e7, month: 5 * 12 };
    const cost = upgradeCost(s, 'camera')!;
    const up = upgradeDept(s, 'camera');
    expect(up.depts.camera).toBe(2);
    expect(up.cash).toBe(s.cash - cost);
    s = upgradeDept(upgradeDept(up, 'camera'), 'camera');
    expect(s.depts.camera).toBe(3); // silent-era cap
    const r = startResearch(s, 'moving_camera');
    expect(r.research?.id).toBe('moving_camera');
    expect(r.cash).toBe(s.cash - techCost(s, 'moving_camera'));
    expect(startResearch(r, 'continuity_editing')).toBe(r); // one project at a time
    expect(startResearch(s, 'sync_sound')).toBe(s); // not invented yet
  });
  it('finishes research as months pass', () => {
    let s: GameState = startResearch({ ...newGame(1), cash: 1e7, month: 5 * 12 }, 'moving_camera');
    for (let i = 0; i < 3; i++) s = produceFilm(s, firstPlan(s)).state;
    expect(s.techs).toContain('moving_camera');
    expect(s.research).toBeNull();
  });
  it('queues and resolves historical events', () => {
    let s: GameState = { ...newGame(1), cash: 1e9, month: (1927 - 1900) * 12 - 2 };
    s = produceFilm(s, firstPlan(s)).state;
    expect(s.pendingEvents).toContain('talkies_1927');
    expect(s.pendingEra).toBe('sound');
    const after = resolveEvent(s, 'talkies_1927', 0);
    expect(after.techs).toContain('sync_sound');
    expect(after.pendingEvents).not.toContain('talkies_1927');
    expect(after.cash).toBeLessThan(s.cash);
  });
  it('offers a bailout when the studio cannot afford any film', () => {
    const s0 = newGame(2);
    const broke = produceFilm({ ...s0, cash: minFilmCost(s0) + 1 }, firstPlan(s0)).state;
    if (broke.cash < minFilmCost(broke)) {
      expect(broke.needBailout).toBe(true);
      const saved = takeBailout(broke);
      expect(saved.cash).toBeGreaterThanOrEqual(minFilmCost(saved));
      expect(saved.rep).toBeLessThanOrEqual(broke.rep);
    }
  });
});

describe('whole careers', () => {
  it('a sensible player reaches 1985 and a save survives a JSON round trip', () => {
    const r = playCareer(11, 'balanced');
    expect(r.over).not.toBeNull();
    expect(r.films).toBeGreaterThan(40);
    const loaded = JSON.parse(JSON.stringify(r.state)) as GameState;
    expect(loaded).toEqual(r.state);
    if (r.over === 'finale') expect(yearOf(r.state.month)).toBeGreaterThan(1985);
    expect(unitAt(r.state.month)).toBeGreaterThan(unitAt(0));
  });
  it('two runs of the same seed and strategy are identical', () => {
    expect(playCareer(5, 'bigSpender').state).toEqual(playCareer(5, 'bigSpender').state);
  });
});
