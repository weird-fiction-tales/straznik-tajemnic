import { getAdventureById } from '../adventures-data';

/** The private local showcase uses these two fixed source editions only. */
export const AUTHORED_SCENARIOS = {
  'cien-nad-prabutami': { prefix: 'prabuty', language: 'pl', characterId: 'strefa11_tomasz_nowicki' },
  'englewood-murder-castle-1893': { prefix: 'englewood', language: 'en', characterId: 'coldcase_frank_geyer' },
} as const;
export type AuthoredAdventureId = keyof typeof AUTHORED_SCENARIOS;
export function isAuthoredAdventureId(id: unknown): id is AuthoredAdventureId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(AUTHORED_SCENARIOS, id);
}
export function authoredScenarioSource(id: string) {
  return isAuthoredAdventureId(id) ? getAdventureById(id) : undefined;
}
export function isShowcaseServer() {
  return process.env.ZEW_LOCAL_PLAYTEST === 'prabuty-tomasz' || process.env.ZEW_LOCAL_PLAYTEST === 'showcase-pl-en';
}
