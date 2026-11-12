import { useMemo, useState } from 'preact/hooks';
import { AUDIENCES, GENRE, GENRES, THEMES, TIERS, CAMPAIGNS, TECH, THEME, TIER } from '../sim/data';
import {
  availableCampaigns, availableGenres, checkPlan, peopleNow, tierUnlocked, trendAt, unitAt, yearOf,
} from '../sim/game';
import { generateTitle } from '../sim/titles';
import type { FilmPlan, GameState, Role } from '../sim/types';
import { Icon, PersonCard, Poster } from './bits';
import { money, sfx } from './util';

const STEPS = ['Concept', 'Budget', 'Writer', 'Director', 'Star', 'Release'] as const;
const TIPS = [
  'Pick what kind of picture to make. Some themes suit a genre better than others. You only find out which by trying them.',
  'A bigger budget buys production value and a wider release, but takes longer and costs more if it flops.',
  'The script is the biggest single part of a film\'s quality. Writers who love your genre do their best work.',
  'A director turns the script into a picture. Rising talent is cheap now and gets better every year.',
  'Your star\'s talent lifts the film; their fame and charisma sell tickets.',
  'Name your picture and decide how loudly to announce it. Then roll camera!',
];

export function Wizard({ game, onCancel, onRoll }: { game: GameState; onCancel: () => void; onRoll: (plan: FilmPlan) => void }) {
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<Partial<FilmPlan>>({ audience: 'general', tier: 'shoestring', campaign: 'posters' });
  const [salt, setSalt] = useState(0);
  const [customTitle, setCustomTitle] = useState<string | null>(null);

  const year = yearOf(game.month);
  const unit = unitAt(game.month);
  const people = useMemo(() => peopleNow(game), [game]);
  const genres = availableGenres(game);
  const trend = trendAt(game.seed, year);
  const title = customTitle ?? (plan.genre && plan.theme ? generateTitle(game.seed, game.films.length * 31 + salt, plan.genre, plan.theme) : '');
  const full = { ...plan, title: title.trim() || 'Untitled Picture' };
  const check = checkPlan(game, full);
  const set = (patch: Partial<FilmPlan>) => { sfx('tap'); setPlan({ ...plan, ...patch }); };

  const stepDone = [
    !!plan.genre && !!plan.theme && !!plan.audience,
    !!plan.tier && tierUnlocked(game, plan.tier),
    !!plan.writer, !!plan.director, !!plan.lead,
    check.ok,
  ][step];

  const pickList = (role: Role, key: 'writer' | 'director' | 'lead') => {
    const sortKey = (p: (typeof people)[number]) => (p.willing ? 0 : 1000) - p.skill * (plan.genre && p.def.loves.includes(plan.genre) ? 1.08 : 1);
    return (
      <div class="list">
        {people.filter((p) => p.def.role === role).sort((a, b) => sortKey(a) - sortKey(b)).map((p) => (
          <PersonCard p={p} genre={plan.genre} selected={plan[key] === p.id} onPick={() => set({ [key]: p.id })} />
        ))}
      </div>
    );
  };

  return (
    <div class="overlay wizard">
      <div class="wiz-head">
        <button class="ghost" onClick={step === 0 ? onCancel : () => setStep(step - 1)} aria-label="Back"><Icon name="back" /></button>
        <div>
          <div class="eyebrow">New picture · step {step + 1} of {STEPS.length}</div>
          <h2>{STEPS[step]}</h2>
        </div>
      </div>
      <div class="wiz-dots">{STEPS.map((_, i) => <i class={i <= step ? 'on' : ''} />)}</div>

      <div class="wiz-body">
        {!game.tutorialDone && game.films.length === 0 && <div class="tip"><b>Director's note</b>{TIPS[step]}</div>}

        {step === 0 && (
          <>
            <h3>Genre</h3>
            <div class="chips">
              {genres.map((g) => (
                <button class={`chip ${plan.genre === g.id ? 'on' : ''}`} onClick={() => { setCustomTitle(null); set({ genre: g.id }); }}>
                  {g.name}
                  {trend.hot === g.id && <em class="hot">hot</em>}
                  {trend.cold === g.id && <em class="cold">tired</em>}
                </button>
              ))}
            </div>
            {GENRES.length > genres.length && <p class="hint">More genres arrive with new years and new technology.</p>}
            <h3>Theme</h3>
            <div class="chips">
              {THEMES.map((t) => {
                const known = plan.genre ? game.discovered[`${plan.genre}|${t.id}`] : undefined;
                return (
                  <button class={`chip ${plan.theme === t.id ? 'on' : ''}`} onClick={() => { setCustomTitle(null); set({ theme: t.id }); }}>
                    {t.name}
                    {known && <em class={known}>{known === 'great' ? 'great fit' : known === 'poor' ? 'poor fit' : 'fine'}</em>}
                  </button>
                );
              })}
            </div>
            <h3>Audience</h3>
            <div class="segment">
              {AUDIENCES.map((a) => (
                <button class={plan.audience === a.id ? 'on' : ''} onClick={() => set({ audience: a.id })}>{a.name}</button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <div class="list">
            {TIERS.map((t) => {
              const open = tierUnlocked(game, t.id);
              return (
                <button class={`option ${plan.tier === t.id ? 'selected' : ''}`} disabled={!open} onClick={() => set({ tier: t.id })}>
                  <div>
                    <b>{t.name}</b>
                    <span>{open ? `${t.desc} ${t.months} months.` : `Needs ${[t.tech && TECH[t.tech].name, t.dept && `Production & Sets level ${t.dept}`].filter(Boolean).join(' and ')}.`}</span>
                  </div>
                  <strong>{money(Math.round(t.cost * unit))}</strong>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && pickList('writer', 'writer')}
        {step === 3 && pickList('director', 'director')}
        {step === 4 && pickList('actor', 'lead')}

        {step === 5 && plan.genre && plan.director && plan.lead && (
          <>
            <div class="release">
              <Poster film={{ title: full.title, genre: plan.genre, color: game.techs.includes('color'), director: plan.director, lead: plan.lead }} />
              <div class="release-side">
                <label class="field">
                  <span>Title</span>
                  <input value={title} maxLength={40} onInput={(e) => setCustomTitle((e.target as HTMLInputElement).value)} />
                </label>
                <button class="small" onClick={() => { sfx('tap'); setCustomTitle(null); setSalt(salt + 1); }}><Icon name="dice" /> Another title</button>
                <p class="hint">{GENRE[plan.genre].name} · {THEME[plan.theme!].name} · {TIER[plan.tier!].name}</p>
              </div>
            </div>
            <h3>Campaign</h3>
            <div class="list">
              {CAMPAIGNS.map((c) => {
                const open = availableCampaigns(game).includes(c);
                if (!open && TECH[c.tech!].year > year) return null;
                return (
                  <button class={`option ${plan.campaign === c.id ? 'selected' : ''}`} disabled={!open} onClick={() => set({ campaign: c.id })}>
                    <div><b>{c.name}</b><span>{open ? c.desc : `Research ${TECH[c.tech!].name} first.`}</span></div>
                    <strong>{c.cost ? money(Math.round(c.cost * unit)) : 'Free'}</strong>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div class="wiz-foot">
        <div class="cost">
          <span>Cost so far</span>
          <b class={check.costs.total > game.cash ? 'bad' : ''}>{money(check.costs.total)}</b>
          <small>of {money(game.cash)} cash</small>
        </div>
        {step < STEPS.length - 1 ? (
          <button class="primary" disabled={!stepDone} onClick={() => { sfx('tap'); setStep(step + 1); }}>Next</button>
        ) : (
          <button class="primary" disabled={!check.ok} onClick={() => onRoll(full as FilmPlan)}>Roll camera</button>
        )}
      </div>
      {step === STEPS.length - 1 && !check.ok && <div class="wiz-error">{check.errors[0]}</div>}
    </div>
  );
}
