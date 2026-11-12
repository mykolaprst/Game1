import { useEffect, useRef, useState } from 'preact/hooks';
import {
  availableTechs, dismissEra, eraOf, newGame, produceFilm, resolveEvent, startResearch, takeBailout, upgradeDept, yearOf,
} from '../sim/game';
import type { DeptId, FilmPlan, FilmRecord, GameState } from '../sim/types';
import { Icon, Sprite } from './bits';
import { BailoutModal, EraModal, EventModal, Finale, Intro, Menu, Producing, Result } from './modals';
import { FilmsTab, FinanceTab, PeopleTab, ResearchTab, StudioTab } from './tabs';
import {
  asset, clearAuto, dateLabel, isSoundOn, loadAuto, loadSlot, money, saveAuto, saveSlot, setSound, sfx,
} from './util';
import { Wizard } from './wizard';

type Tab = 'studio' | 'films' | 'people' | 'research' | 'finance';
type Overlay =
  | null
  | { kind: 'wizard' }
  | { kind: 'producing'; film: FilmRecord }
  | { kind: 'result'; film: FilmRecord; animate: boolean }
  | { kind: 'menu' };

const TABS: { id: Tab; label: string }[] = [
  { id: 'studio', label: 'Studio' }, { id: 'films', label: 'Films' }, { id: 'people', label: 'People' },
  { id: 'research', label: 'Research' }, { id: 'finance', label: 'Finance' },
];

export function App() {
  const [saved] = useState(() => loadAuto());
  const [game, setGameRaw] = useState<GameState | null>(null);
  const [tab, setTab] = useState<Tab>('studio');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [viewOver, setViewOver] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundOn());
  const [hasSlot, setHasSlot] = useState(() => !!loadSlot());
  const scroll = useRef<HTMLElement>(null);

  const setGame = (g: GameState) => { setGameRaw(g); saveAuto(g); };
  useEffect(() => { scroll.current?.scrollTo(0, 0); }, [tab]);

  if (!game) {
    return (
      <div class="shell" data-era="sound">
        <Intro
          hasSave={!!saved}
          onContinue={() => saved && setGameRaw(saved)}
          onNew={(name) => { sfx('roll'); setGame(newGame(Math.floor(Math.random() * 2 ** 31), name)); }}
        />
      </div>
    );
  }

  const era = eraOf(yearOf(game.month));
  const act = {
    makeFilm: () => { sfx('tap'); setOverlay({ kind: 'wizard' }); },
    upgrade: (d: DeptId) => { sfx('cash'); setGame(upgradeDept(game, d)); },
    research: (id: string) => { sfx('cash'); setGame(startResearch(game, id)); },
    openFilm: (film: FilmRecord) => setOverlay({ kind: 'result', film, animate: false }),
  };
  const roll = (plan: FilmPlan) => {
    sfx('roll');
    const { state, film } = produceFilm(game, plan);
    setGame({ ...state, tutorialDone: state.tutorialDone || state.films.length >= 1 });
    setOverlay({ kind: 'producing', film });
  };
  const restart = () => { clearAuto(); setGameRaw(null); setOverlay(null); setViewOver(false); setTab('studio'); };

  // Things the world throws at the studio, shown one at a time once no other screen is open.
  let interrupt = null;
  if (!overlay) {
    if (game.pendingEra) interrupt = <EraModal era={game.pendingEra} onClose={() => setGame(dismissEra(game))} />;
    else if (game.pendingEvents.length) interrupt = <EventModal game={game} id={game.pendingEvents[0]} onPick={(i) => { sfx('tap'); setGame(resolveEvent(game, game.pendingEvents[0], i)); }} />;
    else if (game.needBailout) interrupt = <BailoutModal game={game} onTake={() => { sfx('cash'); setGame(takeBailout(game)); }} />;
    else if (game.over && !viewOver) interrupt = <Finale game={game} onNew={restart} onView={() => setViewOver(true)} />;
  }

  return (
    <div class="shell" data-era={era.id}>
      <header class="top" style={{ backgroundImage: `url(${asset(`bg-${era.id}`)})` }}>
        <div class="top-shade" />
        <div class="top-row">
          <div>
            <div class="studio-name">{game.studio}</div>
            <div class="date">{dateLabel(game.month)} · {era.name}</div>
          </div>
          <button class="ghost light" onClick={() => setOverlay({ kind: 'menu' })} aria-label="Menu"><Icon name="gear" /></button>
        </div>
        <div class="stats">
          <div class="stat"><Sprite name="coins" size={30} /><div><small>Cash</small><b class={game.cash < 0 ? 'bad' : ''}>{money(game.cash)}</b></div></div>
          <div class="stat"><Sprite name="star" size={30} /><div><small>Reputation</small><b>{game.rep}</b></div></div>
          <div class="stat"><Sprite name="camera" size={30} /><div><small>Pictures</small><b>{game.films.length}</b></div></div>
        </div>
      </header>

      <main class="scroll" ref={scroll}>
        {game.over && <button class="card banner" onClick={() => setViewOver(false)}>The studio's story has ended. Tap for the final reckoning.</button>}
        {tab === 'studio' && <StudioTab game={game} act={act} />}
        {tab === 'films' && <FilmsTab game={game} act={act} />}
        {tab === 'people' && <PeopleTab game={game} />}
        {tab === 'research' && <ResearchTab game={game} act={act} />}
        {tab === 'finance' && <FinanceTab game={game} />}
      </main>

      <nav class="tabs">
        {TABS.map((t) => (
          <button class={tab === t.id ? 'on' : ''} onClick={() => { sfx('tap'); setTab(t.id); }}>
            <Icon name={t.id} />
            <span>{t.label}</span>
            {t.id === 'research' && !game.research && !game.over && availableTechs(game).length > 0 && <i class="dot" />}
          </button>
        ))}
      </nav>

      {overlay?.kind === 'wizard' && <Wizard game={game} onCancel={() => setOverlay(null)} onRoll={roll} />}
      {overlay?.kind === 'producing' && <Producing film={overlay.film} onDone={() => setOverlay({ kind: 'result', film: overlay.film, animate: true })} />}
      {overlay?.kind === 'result' && <Result film={overlay.film} animate={overlay.animate} onClose={() => { setOverlay(null); if (overlay.animate) setTab('studio'); }} />}
      {overlay?.kind === 'menu' && (
        <Menu
          hasSlot={hasSlot}
          soundOn={soundOn}
          onClose={() => setOverlay(null)}
          onSave={() => { if (saveSlot(game)) setHasSlot(true); }}
          onLoad={() => { const s = loadSlot(); if (s) { setGame(s); setViewOver(false); setOverlay(null); } }}
          onSound={() => { setSound(!soundOn); setSoundOn(!soundOn); }}
          onNew={restart}
        />
      )}
      {interrupt}
    </div>
  );
}
