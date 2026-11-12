import type { ComponentChildren } from 'preact';
import { GENRE, PERSON, THEME } from '../sim/data';
import type { PersonNow } from '../sim/game';
import type { FilmRecord, Verdict } from '../sim/types';
import { asset, cap, money } from './util';

export const VERDICT: Record<Verdict, string> = {
  flop: 'Flop', modest: 'Broke even', hit: 'Hit', smash: 'Smash hit', blockbuster: 'Blockbuster',
};

export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    studio: 'M3 21V9l5 3V9l5 3V4h8v17H3zm13-13v2h2V8h-2zm0 4v2h2v-2h-2zM6 15v3h3v-3H6zm5 0v3h3v-3h-3z',
    films: 'M4 4h16v16H4V4zm2 2v2h2V6H6zm0 4v2h2v-2H6zm0 4v2h2v-2H6zm10-8v2h2V6h-2zm0 4v2h2v-2h-2zm0 4v2h2v-2h-2zm-6-8v12h4V6h-4z',
    people: 'M9 11a4 4 0 110-8 4 4 0 010 8zm-7 9c0-3.5 3-6 7-6s7 2.5 7 6H2zm15-9a3 3 0 110-6 3 3 0 010 6zm1 2c2.5.5 4 2.3 4 5h-4c0-2-.6-3.6-1.7-4.8.5-.1 1.1-.2 1.7-.2z',
    research: 'M9 3h6v2h-1v4.5l5 8.6A2 2 0 0117.3 21H6.7A2 2 0 015 18.100l5-8.600V5H9V3zm2.900 8L9 16h6l-2.900-5h-.2z',
    finance: 'M3 20h18v2H3v-2zm2-8h3v7H5v-7zm5-5h3v12h-3V7zm5 3h3v9h-3v-9zM19.500 2l1.500 5-2-.7-4.500 4.900-3-2.400-5 4.300-1.300-1.500 6.200-5.400 3 2.400 3.200-3.500-2-.7L19.500 2z',
    gear: 'M12 8a4 4 0 100 8 4 4 0 000-8zm9.400 5l-2 .4a7.500 7.500 0 01-.8 1.900l1.200 1.700-1.800 1.800-1.700-1.200c-.6.4-1.200.6-1.900.8l-.4 2h-2.600l-.4-2a7.500 7.500 0 01-1.900-.8L7.400 18.800 5.600 17l1.200-1.700a7.500 7.500 0 01-.8-1.900l-2-.4v-2.600l2-.4c.2-.7.4-1.300.8-1.900L5.600 6.400 7.400 4.600l1.700 1.200c.6-.4 1.200-.6 1.900-.8l.4-2h2.600l.4 2c.7.2 1.300.4 1.900.8l1.700-1.200 1.800 1.800-1.200 1.700c.4.6.6 1.200.8 1.900l2 .4V13z',
    back: 'M15 5l-7 7 7 7 1.500-1.500L11 12l5.500-5.500L15 5z',
    dice: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm3 3.500a1.500 1.500 0 100 3 1.500 1.500 0 000-3zm8 0a1.500 1.500 0 100 3 1.500 1.500 0 000-3zm-4 4a1.500 1.500 0 100 3 1.500 1.500 0 000-3zm-4 4a1.500 1.500 0 100 3 1.500 1.500 0 000-3zm8 0a1.500 1.500 0 100 3 1.500 1.500 0 000-3z',
  };
  return (
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} fill="currentColor" fill-rule="evenodd" />
    </svg>
  );
}

export function Sprite({ name, size = 44 }: { name: string; size?: number }) {
  return <img class="sprite" src={asset(`sprite-${name}`)} width={size} height={size} alt="" />;
}

export function Portrait({ id, size = 52 }: { id: string; size?: number }) {
  return <img class="portrait" src={asset(`person-${id}`)} width={size} height={size} alt="" loading="lazy" />;
}

export function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div class="bar-row">
      <span class="bar-label">{label}</span>
      <span class="bar"><span class="bar-fill" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></span>
      <span class="bar-num">{Math.round(value)}</span>
    </div>
  );
}

export function Pips({ level, max }: { level: number; max: number }) {
  return (
    <span class="pips" aria-label={`Level ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => <i class={i < level ? 'on' : ''} />)}
    </span>
  );
}

/** A film poster: genre artwork with the title set over it. Black-and-white until the studio owns colour. */
export function Poster({ film, big }: { film: Pick<FilmRecord, 'title' | 'genre' | 'color' | 'director' | 'lead'>; big?: boolean }) {
  return (
    <div class={`poster ${film.color ? '' : 'mono'} ${big ? 'big' : ''}`}>
      <img src={asset(`poster-${film.genre}`)} alt="" loading="lazy" />
      <div class="poster-shade" />
      <div class="poster-title">{film.title}</div>
      <div class="poster-credit">
        {PERSON[film.lead]?.name}
        <small>directed by {PERSON[film.director]?.name}</small>
      </div>
    </div>
  );
}

export function PersonCard({ p, genre, selected, onPick, extra }: {
  p: PersonNow; genre?: string; selected?: boolean; onPick?: () => void; extra?: ComponentChildren;
}) {
  const loves = genre && p.def.loves.includes(genre);
  const weak = genre && p.def.weak.includes(genre);
  const Tag = onPick ? 'button' : 'div';
  return (
    <Tag class={`person ${selected ? 'selected' : ''} ${p.willing ? '' : 'unwilling'}`} onClick={p.willing ? onPick : undefined} disabled={onPick ? !p.willing : undefined}>
      <Portrait id={p.id} />
      <div class="person-main">
        <div class="person-name">
          {p.def.name}
          <span class={`tag ${p.phase}`}>{cap(p.phase)}</span>
          {loves && <span class="tag good">Loves {GENRE[genre!].name}</span>}
          {weak && <span class="tag bad">Weak at {GENRE[genre!].name}</span>}
        </div>
        <div class="person-stats">
          {Object.entries(p.stats).map(([k, v]) => <span><b>{v}</b> {k}</span>)}
          <span><b>{p.fame}</b> fame</span>
        </div>
        {!genre && <div class="person-loves">Best in {p.def.loves.map((g) => GENRE[g].name).join(', ')}</div>}
        {!p.willing && <div class="person-note">Won't sign with a studio of your standing yet</div>}
        {extra}
      </div>
      <div class="person-fee">{money(p.fee)}</div>
    </Tag>
  );
}

export const filmLine = (f: FilmRecord) => `${GENRE[f.genre].name} · ${THEME[f.theme].name} · ${f.year}`;
