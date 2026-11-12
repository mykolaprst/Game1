import erasJson from '../data/eras.json';
import genresJson from '../data/genres.json';
import themesJson from '../data/themes.json';
import techsJson from '../data/techs.json';
import peopleJson from '../data/people.json';
import studioJson from '../data/studio.json';
import eventsJson from '../data/events.json';
import type {
  AudienceDef, CampaignDef, DeptDef, EraDef, EventDef, GenreDef, PersonDef, TechDef, ThemeDef, TierDef,
} from './types';

export const START_YEAR: number = erasJson.startYear;
export const END_YEAR: number = erasJson.endYear;
export const UNIT_DOLLARS: number = erasJson.unitDollars;
export const COST_ANCHORS = erasJson.costAnchors as [number, number][];
export const ERAS = erasJson.eras as unknown as EraDef[];
export const GENRES = genresJson as unknown as GenreDef[];
export const THEMES = themesJson as ThemeDef[];
export const TECHS = techsJson as unknown as TechDef[];
export const PEOPLE = peopleJson as unknown as PersonDef[];
export const DEPTS = studioJson.departments as unknown as DeptDef[];
export const TIERS = studioJson.tiers as unknown as TierDef[];
export const AUDIENCES = studioJson.audiences as AudienceDef[];
export const CAMPAIGNS = studioJson.campaigns as unknown as CampaignDef[];
export const EVENTS = eventsJson as unknown as EventDef[];
export const DEPT_UPGRADE_COST: number[] = studioJson.deptUpgradeCost;
export const DEPT_UPKEEP: number = studioJson.deptUpkeepPerLevel;
export const BAL = studioJson.balance;

function index<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((x) => [x.id, x]));
}
export const GENRE = index(GENRES);
export const THEME = index(THEMES);
export const TECH = index(TECHS);
export const PERSON = index(PEOPLE);
export const TIER = index(TIERS);
export const AUDIENCE = index(AUDIENCES);
export const CAMPAIGN = index(CAMPAIGNS);
export const EVENT = index(EVENTS);
export const DEPT = index(DEPTS);
