import { pick, rand } from './rng';

const ADJ: Record<string, string[]> = {
  comedy: ['Runaway', 'Slippery', 'Hapless', 'Merry', 'Bumbling', 'Madcap', 'Unlucky', 'Giddy'],
  drama: ['Broken', 'Silent', 'Last', 'Forgotten', 'Bitter', 'Quiet', 'Longest', 'Fading'],
  western: ['Lonesome', 'Dusty', 'Crooked', 'Last', 'Lawless', 'Burning', 'Iron', 'Wild'],
  romance: ['Tender', 'Midnight', 'Secret', 'Stolen', 'Endless', 'Borrowed', 'Summer', 'Scarlet'],
  adventure: ['Lost', 'Hidden', 'Savage', 'Golden', 'Perilous', 'Uncharted', 'Daring', 'Emerald'],
  war: ['Distant', 'Fallen', 'Thundering', 'Brave', 'Final', 'Scorched', 'Unbroken', 'Grey'],
  horror: ['Crawling', 'Whispering', 'Black', 'Screaming', 'Cursed', 'Hollow', 'Restless', 'Pale'],
  musical: ['Dancing', 'Singing', 'Glittering', 'Swinging', 'Starlit', 'Gilded', 'Footloose', 'Sparkling'],
  crime: ['Crooked', 'Dark', 'Double', 'Cold', 'Naked', 'Dirty', 'Sleepless', 'Blind'],
  scifi: ['Crimson', 'Silent', 'Invisible', 'Atomic', 'Distant', 'Seventh', 'Forbidden', 'Electric'],
};
const NOUN: Record<string, string[]> = {
  frontier: ['Trail', 'Canyon', 'Homestead', 'Stagecoach', 'Prairie', 'Territory'],
  love_triangle: ['Promise', 'Affair', 'Letter', 'Rival', 'Heart', 'Vow'],
  big_city: ['Avenue', 'Skyline', 'Boulevard', 'Tenement', 'Streetcar', 'Metropolis'],
  haunted_house: ['Manor', 'Attic', 'Staircase', 'Cellar', 'Guest', 'Shadow'],
  heist: ['Vault', 'Score', 'Getaway', 'Diamond', 'Alibi', 'Double-Cross'],
  battlefield: ['Trench', 'Regiment', 'Ridge', 'Brigade', 'Frontline', 'Salute'],
  royal_court: ['Crown', 'Duchess', 'Throne', 'Masquerade', 'Heir', 'Coronet'],
  circus: ['Ringmaster', 'Trapeze', 'Big Top', 'Carousel', 'Sideshow', 'Tightrope'],
  high_seas: ['Voyage', 'Galleon', 'Tide', 'Mutiny', 'Lighthouse', 'Horizon'],
  outer_space: ['Planet', 'Comet', 'Orbit', 'Moon', 'Signal', 'Rocket'],
  small_town: ['Main Street', 'County Fair', 'Neighbour', 'Harvest', 'Porch', 'Mill'],
  rags_to_riches: ['Fortune', 'Millionaire', 'Chorus Girl', 'Newsboy', 'Penthouse', 'Dream'],
};
const PLACE = ['Montana', 'Paris', 'Shanghai', 'Santa Rosa', 'the Yukon', 'Havana', 'Vienna', 'Cairo', 'Broadway', 'the Rio Grande', 'Singapore', 'Monte Carlo'];

/** Fictional title built from the genre's adjectives and the theme's nouns. */
export function generateTitle(seed: number, salt: number, genre: string, theme: string): string {
  const adj = pick(ADJ[genre] ?? ADJ.drama, seed, 'adj', salt);
  const noun = pick(NOUN[theme] ?? NOUN.big_city, seed, 'noun', salt);
  const form = Math.floor(rand(seed, 'form', salt) * 5);
  switch (form) {
    case 0: return `The ${adj} ${noun}`;
    case 1: return `${adj} ${noun}`;
    case 2: return `The ${noun} of ${pick(PLACE, seed, 'place', salt)}`;
    case 3: return `${noun} at Midnight`;
    default: return `A ${adj} ${noun}`.replace(/^A ([AEIOU])/, 'An $1');
  }
}
