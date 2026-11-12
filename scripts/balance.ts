// Headless balance simulator: plays many seeded careers with each scripted strategy and reports how they do.
//   npm run balance            (200 seeds)
//   npm run balance -- 1000    (more seeds)
import { STRATEGIES, playCareer, type Strategy } from '../src/sim/bots';
import { legacy } from '../src/sim/game';

const N = Number(process.argv[2] ?? 200);
type Row = { score: number[]; worth: number[]; rep: number[]; q: number[]; films: number[]; bankrupt: number; bailouts: number; wins: number };
const rows = Object.fromEntries(
  STRATEGIES.map((s) => [s, { score: [], worth: [], rep: [], q: [], films: [], bankrupt: 0, bailouts: 0, wins: 0 }]),
) as unknown as Record<Strategy, Row>;

for (let seed = 1; seed <= N; seed++) {
  let best: Strategy = STRATEGIES[0];
  let bestScore = -Infinity;
  for (const s of STRATEGIES) {
    const r = playCareer(seed, s);
    const score = r.over === 'bankrupt' ? 0 : legacy(r.state).score;
    const row = rows[s];
    row.score.push(score); row.worth.push(r.worth); row.rep.push(r.rep); row.q.push(r.avgQuality); row.films.push(r.films);
    row.bailouts += r.bailouts;
    if (r.over === 'bankrupt') row.bankrupt++;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  rows[best].wins++;
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`\nBalance report: ${N} seeded careers per strategy (1900-1985)\n`);
console.log('strategy     win%  score(med)  worth(med, units)   rep  avgQ  films  bankrupt%  bailouts/career');
for (const s of STRATEGIES) {
  const r = rows[s];
  console.log(
    s.padEnd(12),
    ((100 * r.wins) / N).toFixed(0).padStart(4) + '%',
    med(r.score).toFixed(0).padStart(10),
    med(r.worth).toFixed(0).padStart(18),
    avg(r.rep).toFixed(0).padStart(6),
    avg(r.q).toFixed(0).padStart(5),
    avg(r.films).toFixed(0).padStart(6),
    ((100 * r.bankrupt) / N).toFixed(0).padStart(9) + '%',
    (r.bailouts / N).toFixed(2).padStart(12),
  );
}
console.log('\nwin% = share of seeds where that strategy had the best legacy score.');
