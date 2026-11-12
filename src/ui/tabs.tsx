import { useState } from 'preact/hooks';
import { DEPTS, DEPT_UPKEEP, GENRE, TECH, TECHS } from '../sim/data';
import {
  availableTechs, canSpend, eraOf, legacy, peopleNow, techCost, trendAt, unitAt, upgradeCost, yearOf,
} from '../sim/game';
import type { DeptId, FilmRecord, GameState, Role } from '../sim/types';
import { PersonCard, Pips, Poster, Sprite, VERDICT, filmLine } from './bits';
import { dateLabel, money } from './util';

interface Actions {
  makeFilm: () => void;
  upgrade: (d: DeptId) => void;
  research: (id: string) => void;
  openFilm: (f: FilmRecord) => void;
}

export function StudioTab({ game, act }: { game: GameState; act: Actions }) {
  const year = yearOf(game.month);
  const era = eraOf(year);
  const trend = trendAt(game.seed, year);
  const upkeep = DEPTS.reduce((s, d) => s + (game.depts[d.id] - 1), 0) * DEPT_UPKEEP * unitAt(game.month);
  return (
    <>
      <section class="card trend">
        <div class="eyebrow">At the pictures this season</div>
        <p>
          Audiences are craving <b>{GENRE[trend.hot].name}</b> and are tired of <b>{GENRE[trend.cold].name}</b>.
          {game.marketMods.map((m) => <span class={`pill ${m.mult < 1 ? 'bad' : 'good'}`}>{m.label} {m.mult < 1 ? '−' : '+'}{Math.round(Math.abs(1 - m.mult) * 100)}%</span>)}
        </p>
      </section>

      {!game.over && <button class="primary cta" onClick={act.makeFilm}>Make a picture</button>}

      {game.research && (
        <section class="card row">
          <Sprite name="research" size={40} />
          <div class="grow">
            <div class="eyebrow">In the lab</div>
            <b>{TECH[game.research.id].name}</b>
            <div class="progress"><i style={{ width: `${100 * (1 - game.research.monthsLeft / TECH[game.research.id].months)}%` }} /></div>
          </div>
          <span class="muted">{game.research.monthsLeft} mo</span>
        </section>
      )}

      <h3>Departments <small>upkeep {money(upkeep)}/month</small></h3>
      <p class="hint">Upgrades and research are only offered while you can still afford your next picture.</p>
      <section class="card flush">
        {DEPTS.map((d) => {
          const cost = upgradeCost(game, d.id);
          return (
            <div class="dept">
              <Sprite name={d.sprite} />
              <div class="grow">
                <b>{d.name}</b> <Pips level={game.depts[d.id]} max={era.maxDeptLevel} />
                <div class="muted">{d.desc}</div>
              </div>
              {cost === null
                ? <span class="muted small-note">Era max</span>
                : <button class="small" disabled={!canSpend(game, cost)} onClick={() => act.upgrade(d.id)}>Upgrade<br /><b>{money(cost)}</b></button>}
            </div>
          );
        })}
      </section>

      <h3>Studio news</h3>
      <section class="card news">
        {[...game.news].reverse().slice(0, 7).map((n) => <p><span class="muted">{dateLabel(n.month)}</span> {n.text}</p>)}
      </section>
    </>
  );
}

export function FilmsTab({ game, act }: { game: GameState; act: Actions }) {
  if (!game.films.length) {
    return <div class="empty"><Sprite name="camera" size={96} /><p>No pictures yet. Your first one is a tap away.</p><button class="primary" onClick={act.makeFilm}>Make a picture</button></div>;
  }
  return (
    <div class="film-grid">
      {[...game.films].reverse().map((f) => (
        <button class="film" onClick={() => act.openFilm(f)}>
          <Poster film={f} />
          <div class="film-meta">
            <span class={`badge ${f.verdict}`}>{VERDICT[f.verdict]}</span>
            <span class="muted">{f.year} · score {f.quality}</span>
            <b class={f.profit >= 0 ? 'good' : 'bad'}>{f.profit >= 0 ? '+' : ''}{money(f.profit)}</b>
          </div>
        </button>
      ))}
    </div>
  );
}

export function PeopleTab({ game }: { game: GameState }) {
  const [role, setRole] = useState<Role | 'all'>('all');
  const people = peopleNow(game).filter((p) => role === 'all' || p.def.role === role).sort((a, b) => b.skill - a.skill);
  return (
    <>
      <div class="segment">
        {(['all', 'writer', 'director', 'actor'] as const).map((r) => (
          <button class={role === r ? 'on' : ''} onClick={() => setRole(r)}>{r === 'all' ? 'Everyone' : r === 'actor' ? 'Actors' : `${r[0].toUpperCase()}${r.slice(1)}s`}</button>
        ))}
      </div>
      <p class="hint">Careers rise, peak and fade. Fees are paid per picture. Stars only sign with studios whose reputation is close to their fame.</p>
      <div class="list">
        {people.map((p) => (
          <PersonCard p={p} extra={game.people[p.id]?.films ? <div class="person-loves">{game.people[p.id].films} picture{game.people[p.id].films > 1 ? 's' : ''} with you</div> : null} />
        ))}
      </div>
    </>
  );
}

export function ResearchTab({ game, act }: { game: GameState; act: Actions }) {
  const year = yearOf(game.month);
  const avail = availableTechs(game).filter((t) => t.id !== game.research?.id);
  const soon = TECHS.filter((t) => t.year > year).slice(0, 3);
  const owned = TECHS.filter((t) => game.techs.includes(t.id));
  return (
    <>
      {game.research ? (
        <section class="card row">
          <Sprite name="research" size={48} />
          <div class="grow">
            <div class="eyebrow">Researching</div>
            <b>{TECH[game.research.id].name}</b>
            <div class="progress"><i style={{ width: `${100 * (1 - game.research.monthsLeft / TECH[game.research.id].months)}%` }} /></div>
            <div class="muted">{game.research.monthsLeft} months left. Time passes while you make pictures.</div>
          </div>
        </section>
      ) : <p class="hint">The lab is idle. Research runs in the background while you make pictures, one project at a time.</p>}

      <h3>Ready to research</h3>
      {avail.length === 0 && <p class="hint">Nothing new right now. The next breakthrough is a few years off.</p>}
      <div class="list">
        {avail.map((t) => {
          const cost = techCost(game, t.id);
          return (
            <div class="tech">
              <div class="grow">
                <b>{t.name}</b> <span class="tag">{t.category === 'post' ? 'post-production' : t.category}</span>
                {t.essential && year >= t.year && <span class="tag bad">becoming essential</span>}
                <div class="muted">{t.desc}</div>
              </div>
              <button class="small" disabled={!!game.research || !canSpend(game, cost)} onClick={() => act.research(t.id)}>
                {t.months} months<br /><b>{money(cost)}</b>
              </button>
            </div>
          );
        })}
      </div>

      {soon.length > 0 && <>
        <h3>On the horizon</h3>
        <div class="list">
          {soon.map((t) => <div class="tech locked"><div class="grow"><b>{t.name}</b><div class="muted">Expected around {t.year}</div></div></div>)}
        </div>
      </>}

      {owned.length > 0 && <>
        <h3>Your technology</h3>
        <div class="chips static">{owned.map((t) => <span class="chip on">{t.name}</span>)}</div>
      </>}
    </>
  );
}

export function FinanceTab({ game }: { game: GameState }) {
  const gross = game.films.reduce((s, f) => s + f.gross, 0);
  const costs = game.films.reduce((s, f) => s + f.costs.total, 0);
  const lg = legacy(game);
  const pts = game.history.slice(-40);
  const max = Math.max(1, ...pts.map((p) => p.cash));
  const min = Math.min(0, ...pts.map((p) => p.cash));
  const xy = pts.map((p, i) => `${(i / Math.max(1, pts.length - 1)) * 300},${90 - ((p.cash - min) / (max - min)) * 80}`).join(' ');
  return (
    <>
      <section class="card">
        <div class="eyebrow">Cash in the bank</div>
        <div class="big-num">{money(game.cash)}</div>
        {pts.length > 1 && (
          <svg class="chart" viewBox="0 0 300 96" preserveAspectRatio="none" role="img" aria-label="Cash over recent pictures">
            <polyline points={xy} fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          </svg>
        )}
        <div class="muted">Cash after each recent picture. Prices rise through the century, so compare within a decade.</div>
      </section>

      <h3>Lifetime books</h3>
      <section class="card ledger">
        <div><span>Box office</span><b class="good">{money(gross)}</b></div>
        <div><span>Film costs</span><b>{money(-costs)}</b></div>
        <div><span>Department upkeep</span><b>{money(-game.ledger.upkeep)}</b></div>
        <div><span>Research</span><b>{money(-game.ledger.research)}</b></div>
        <div><span>Upgrades</span><b>{money(-game.ledger.upgrades)}</b></div>
        <div><span>Events and bank</span><b>{money(game.ledger.events)}</b></div>
      </section>

      <h3>Legacy</h3>
      <section class="card ledger">
        <div><span>Standing</span><b>{lg.rank}</b></div>
        <div><span>Legacy score</span><b>{lg.score.toLocaleString('en-US')}</b></div>
        <div><span>Pictures released</span><b>{game.films.length}</b></div>
        <div><span>Hits</span><b>{lg.hits}</b></div>
        <div><span>Masterpieces (score 90+)</span><b>{lg.masterpieces}</b></div>
        <div><span>Bank bailouts used</span><b>{game.bailouts} of 3</b></div>
      </section>

      {game.films.length > 0 && <>
        <h3>Recent pictures</h3>
        <section class="card ledger">
          {[...game.films].reverse().slice(0, 10).map((f) => (
            <div><span>{f.title}<small>{filmLine(f)}</small></span><b class={f.profit >= 0 ? 'good' : 'bad'}>{f.profit >= 0 ? '+' : ''}{money(f.profit)}</b></div>
          ))}
        </section>
      </>}
    </>
  );
}
