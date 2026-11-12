import { useEffect, useState } from 'preact/hooks';
import { CAMPAIGN, ERAS, EVENT, PERSON, TIER } from '../sim/data';
import { eventAffordable, legacy, unitAt } from '../sim/game';
import type { EraId, FilmRecord, GameState } from '../sim/types';
import { Bar, Poster, Sprite, VERDICT, filmLine } from './bits';
import { asset, isSoundOn, money, sfx, useCountUp } from './util';

/** A short "in production" interlude between the plan and the results. Tap to skip. */
export function Producing({ film, onDone }: { film: FilmRecord; onDone: () => void }) {
  const [phase, setPhase] = useState(0);
  const phases = [
    { sprite: 'writing', text: `${PERSON[film.writer].name} is finishing the script` },
    { sprite: 'camera', text: `${PERSON[film.director].name} is on the floor with ${PERSON[film.lead].name}` },
    { sprite: 'post', text: 'Cutting, titles and prints' },
    { sprite: 'marketing', text: `${CAMPAIGN[film.campaign].name}: opening night` },
  ];
  useEffect(() => {
    if (phase >= phases.length) { onDone(); return; }
    const t = setTimeout(() => setPhase(phase + 1), 750);
    return () => clearTimeout(t);
  }, [phase]);
  const p = phases[Math.min(phase, phases.length - 1)];
  return (
    <div class="overlay center producing" onClick={onDone}>
      <div class="eyebrow">{TIER[film.tier].name} production · {TIER[film.tier].months} months</div>
      <h2>{film.title}</h2>
      <div class="bounce" key={phase}><Sprite name={p.sprite} size={132} /></div>
      <p>{p.text}…</p>
      <div class="progress wide"><i style={{ width: `${(100 * (phase + 1)) / phases.length}%` }} /></div>
      <small class="muted">Tap to skip</small>
    </div>
  );
}

const BLURB = [
  [90, 'A masterpiece. They will still be showing this in fifty years.'],
  [80, 'A triumph. The critics are running out of adjectives.'],
  [68, 'A fine picture, well made and warmly received.'],
  [55, 'Perfectly watchable. Nobody asked for their nickel back.'],
  [42, 'Forgettable. The second reel dragged.'],
  [0, 'A disaster. The projectionist walked out.'],
] as const;

export function Result({ film, animate, onClose }: { film: FilmRecord; animate: boolean; onClose: () => void }) {
  const q = useCountUp(film.quality, animate ? 900 : 1, animate ? 300 : 0);
  const g = useCountUp(film.gross, animate ? 1600 : 1, animate ? 1100 : 0);
  useEffect(() => {
    if (!animate || !isSoundOn()) return;
    const t = setTimeout(() => sfx(film.verdict === 'flop' ? 'flop' : film.verdict === 'modest' ? 'cash' : 'hit'), 1200);
    return () => clearTimeout(t);
  }, []);
  const blurb = BLURB.find(([min]) => film.quality >= min)![1];
  return (
    <div class="overlay result">
      <div class="result-top">
        <Poster film={film} big />
        <div class={`stamp ${film.verdict} ${animate ? 'in' : ''}`}>{VERDICT[film.verdict]}</div>
      </div>
      <div class="result-body">
        <p class="muted center-text">{filmLine(film)}</p>
        <div class="scores">
          <div><span class="eyebrow">Critics</span><b class="big-num">{Math.round(q)}</b></div>
          <div><span class="eyebrow">Box office</span><b class="big-num">{money(g)}</b></div>
          <div><span class="eyebrow">Profit</span><b class={`big-num ${film.profit >= 0 ? 'good' : 'bad'}`}>{film.profit >= 0 ? '+' : ''}{money(film.profit)}</b></div>
        </div>
        <p class="blurb">“{blurb}”</p>

        <section class="card">
          <Bar label="Script" value={film.scores.script} />
          <Bar label="Direction" value={film.scores.direction} />
          <Bar label="Acting" value={film.scores.acting} />
          <Bar label="Visuals" value={film.scores.visuals} />
          <Bar label="Production" value={film.scores.production} />
          <Bar label="Post" value={film.scores.post} />
        </section>

        {film.notes.length > 0 && (
          <section class="card notes">
            {film.notes.map((n) => <p class={n.good ? 'good' : 'bad'}>{n.good ? '▲' : '▼'} {n.text}</p>)}
          </section>
        )}

        <section class="card ledger">
          <div><span>Production</span><b>{money(-film.costs.production)}</b></div>
          <div><span>Writer, director and star</span><b>{money(-film.costs.talent)}</b></div>
          <div><span>Campaign</span><b>{money(-film.costs.marketing)}</b></div>
          <div><span>Studio reputation</span><b class={film.repDelta >= 0 ? 'good' : 'bad'}>{film.repDelta >= 0 ? '+' : ''}{film.repDelta}</b></div>
          {Object.entries(film.fameDelta).filter(([, d]) => d !== 0).map(([id, d]) => (
            <div><span>{PERSON[id].name}'s fame</span><b class={d >= 0 ? 'good' : 'bad'}>{d >= 0 ? '+' : ''}{d}</b></div>
          ))}
        </section>
      </div>
      <div class="wiz-foot single"><button class="primary" onClick={onClose}>{animate ? 'Continue' : 'Close'}</button></div>
    </div>
  );
}

export function EventModal({ game, id, onPick }: { game: GameState; id: string; onPick: (i: number) => void }) {
  const ev = EVENT[id];
  const unit = unitAt(game.month);
  return (
    <div class="overlay center event">
      <img class="event-img" src={asset(`event-${ev.image}`)} alt="" />
      <div class="eyebrow">{ev.year} · the world outside the lot</div>
      <h2>{ev.title}</h2>
      <p>{ev.text}</p>
      <div class="list">
        {ev.options.map((o, i) => {
          const ok = eventAffordable(game, o.effects);
          return (
            <button class="option" disabled={!ok} onClick={() => onPick(i)}>
              <div><b>{o.label}</b><span>{ok ? o.detail : 'You cannot afford this.'}</span></div>
              {o.effects.cash ? <strong class={o.effects.cash > 0 ? 'good' : 'bad'}>{o.effects.cash > 0 ? '+' : ''}{money(o.effects.cash * unit)}</strong> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EraModal({ era, onClose }: { era: EraId; onClose: () => void }) {
  const e = ERAS.find((x) => x.id === era)!;
  return (
    <div class="overlay center era" data-era={era}>
      <img class="era-img" src={asset(`bg-${era}`)} alt="" />
      <div class="eyebrow">{e.start} · a new era begins</div>
      <h2>{e.name}</h2>
      <p>{e.blurb}</p>
      <p class="muted">Departments can now grow to level {e.maxDeptLevel}. Tastes, costs and technology are shifting. Check the Research tab.</p>
      <button class="primary" onClick={onClose}>Onward</button>
    </div>
  );
}

export function BailoutModal({ game, onTake }: { game: GameState; onTake: () => void }) {
  return (
    <div class="overlay center">
      <Sprite name="coins" size={110} />
      <div class="eyebrow">A letter from the bank</div>
      <h2>The studio is out of money</h2>
      <p>You cannot afford to make even the cheapest picture. The bank will cover your debts and lend you enough to try again, but word gets around and your reputation will suffer.</p>
      <p class="muted">Bailouts used: {game.bailouts} of 3. After the third, the bank takes the keys.</p>
      <button class="primary" onClick={onTake}>Accept the bank's terms</button>
    </div>
  );
}

export function Finale({ game, onNew, onView }: { game: GameState; onNew: () => void; onView: () => void }) {
  const lg = legacy(game);
  const best = [...game.films].sort((a, b) => b.quality - a.quality)[0];
  const won = game.over === 'finale';
  return (
    <div class="overlay center finale">
      <img class="finale-img" src={asset(won ? 'poster-premiere' : 'poster-closed')} alt="" />
      <div class="eyebrow">{won ? '1985 · the credits roll' : 'The gates are locked'}</div>
      <h2>{won ? lg.rank : 'The bank has taken the studio'}</h2>
      <p>{won
        ? `${game.studio} made ${game.films.length} pictures across 86 years of cinema, ${lg.hits} of them hits.`
        : `${game.studio} made ${game.films.length} pictures before the money ran out.`}</p>
      <section class="card ledger">
        <div><span>Legacy score</span><b>{lg.score.toLocaleString('en-US')}</b></div>
        <div><span>Reputation</span><b>{game.rep}</b></div>
        <div><span>Masterpieces</span><b>{lg.masterpieces}</b></div>
        {best && <div><span>Finest picture</span><b>{best.title} ({best.quality})</b></div>}
      </section>
      <p class="muted">The digital era, 1985 to 2018, is planned for the next phase.</p>
      <button class="primary" onClick={onNew}>Start a new studio</button>
      <button class="small" onClick={onView}>Look around the lot</button>
    </div>
  );
}

export function Intro({ hasSave, onContinue, onNew }: { hasSave: boolean; onContinue: () => void; onNew: (name: string) => void }) {
  const [name, setName] = useState('Sunburst Pictures');
  const [naming, setNaming] = useState(!hasSave);
  return (
    <div class="overlay center intro" data-era="sound">
      <img class="logo" src={asset('icon-512')} alt="" />
      <h1>Film Industry Tycoon</h1>
      <p>Run a picture studio from the hand-cranked silents of 1900 to the summer blockbusters of 1985.</p>
      {naming ? (
        <>
          <label class="field"><span>Name your studio</span><input value={name} maxLength={28} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
          <button class="primary" onClick={() => onNew(name.trim() || 'Sunburst Pictures')}>Open the studio</button>
          {hasSave && <button class="small" onClick={() => setNaming(false)}>Back</button>}
        </>
      ) : (
        <>
          <button class="primary" onClick={onContinue}>Continue</button>
          <button class="small" onClick={() => setNaming(true)}>New studio</button>
        </>
      )}
      <small class="muted">Offline. No ads. No timers. Progress saves on this device after every picture.</small>
    </div>
  );
}

export function Menu({ hasSlot, soundOn, onClose, onSave, onLoad, onSound, onNew }: {
  hasSlot: boolean; soundOn: boolean; onClose: () => void; onSave: () => void; onLoad: () => void; onSound: () => void; onNew: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div class="sheet-back" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Studio office</h2>
        <p class="muted">The game saves by itself after every picture. The manual slot is a spare copy you control.</p>
        <button class="option" onClick={() => { onSave(); setSaved(true); }}><div><b>{saved ? 'Saved' : 'Save to manual slot'}</b><span>Overwrites the previous manual save.</span></div></button>
        <button class="option" disabled={!hasSlot && !saved} onClick={onLoad}><div><b>Load manual slot</b><span>{hasSlot || saved ? 'Go back to your saved studio.' : 'Nothing saved yet.'}</span></div></button>
        <button class="option" onClick={onSound}><div><b>Sound: {soundOn ? 'on' : 'off'}</b><span>Clicks and fanfares.</span></div></button>
        {confirm
          ? <button class="option danger" onClick={onNew}><div><b>Yes, close this studio</b><span>Your automatic save will be replaced. The manual slot is kept.</span></div></button>
          : <button class="option" onClick={() => setConfirm(true)}><div><b>Start a new studio</b><span>Begin again in 1900.</span></div></button>}
        <button class="primary" onClick={onClose}>Back to the lot</button>
      </div>
    </div>
  );
}
