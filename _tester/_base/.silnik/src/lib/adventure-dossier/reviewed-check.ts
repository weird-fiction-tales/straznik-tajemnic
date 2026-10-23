/** Data-only contract shared by item access and NPC transitions. */
export interface DossierItemAccessCheck {
  id: string;
  skill_names: string[];
  difficulty: 'regular' | 'hard' | 'extreme';
}
export function isReviewedDossierCheck(value: unknown): value is DossierItemAccessCheck {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const check = value as Record<string, unknown>;
  return Object.keys(check).every(k => ['id','skill_names','difficulty'].includes(k)) &&
    typeof check.id === 'string' && /^[a-zA-Z0-9._:-]{1,200}$/.test(check.id) &&
    Array.isArray(check.skill_names) && check.skill_names.length > 0 && check.skill_names.length <= 16 &&
    check.skill_names.every(n => typeof n === 'string' && n.trim().length > 0 && n.length <= 200) &&
    ['regular','hard','extreme'].includes(String(check.difficulty));
}
