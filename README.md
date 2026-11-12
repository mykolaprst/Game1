# Film Industry Tycoon

Run a picture studio from the hand-cranked silents of 1900 to the summer blockbusters of 1985.
Portrait, one-thumb, offline, no ads, no timers.

This is the MVP from the product plan: the film loop, five departments, 17 technologies, 48 people with
careers, three eras, historical event cards, a guided first film, and saves.

## Play and develop

```bash
npm install
npm run dev        # local dev server
npm run build      # type-check and build to dist/ (static files, works from any folder)
npm test           # simulation tests
npm run balance    # headless balance simulator (add "-- 1000" for more seeds)
npm run assets     # re-slice assets-src/ into public/assets/
```

The build is plain static files. To ship on iOS and Android, wrap `dist/` with Capacitor.

## How it is put together

| Layer | Where | Notes |
| --- | --- | --- |
| Data | `src/data/*.json` | Every number and every piece of content: eras, genres, themes, techs, people, events, budgets, campaigns, balance constants. Tune here, no code changes. |
| Simulation | `src/sim/` | Pure functions, `(state, input) -> new state`. No DOM, no storage. Deterministic: the same seed and the same choices always give the same result. |
| UI | `src/ui/` | Preact. Reads state, calls simulation functions, saves to `localStorage` after every change. |

`src/sim/bots.ts` holds scripted players. `scripts/balance.ts` plays whole careers with each of them and
reports who wins, who goes bankrupt and how rich they get.

## The film formula

Quality is a weighted mix of script, direction, acting, visuals, production value and post-production.
People bring the first three (scaled by where they are in their career and whether they love the genre);
departments, technology and budget bring the rest. Theme fit nudges the total.

Box office starts from quality and is multiplied by: budget reach, the era's taste for the genre, the current
trend (one hot genre, one tired one, changing every three years), genre fatigue if you repeat yourself,
the campaign, star power, studio reputation, audience fit, missing must-have technology (sound, later colour)
and world events.

Prices follow a cost index that rises about 5,000-fold between 1900 and 1985, so a $500 short in 1900 and a
$25M epic in 1977 are the same kind of decision.

## Art

All art was generated with GPT Image 2.6 on fal.ai (15 images) and lives in `assets-src/`.
`scripts/build-assets.mjs` slices the sheets into 79 small WebP files in `public/assets/`.

- App icon, three era backdrops
- Twelve poster illustrations (ten genres, premiere night, closed studio); titles are set in HTML on top
- 48 portraits, one sheet of twelve per generation
- Six event illustrations
- Eight transparent sprites (departments, research, coins, star)

Posters are shown in black and white until the studio researches colour.

## Not in the MVP

Rivals, awards, scandals, the 1985 to 2018 digital era, localization and store packaging are later phases
in the plan.
