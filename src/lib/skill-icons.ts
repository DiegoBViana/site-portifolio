/** Icon names a skill group can use (`icon:` in data/<pasta>/content/skills/*.yaml). */
export const SKILL_ICONS = ['code', 'plug', 'database', 'queue', 'cloud', 'check', 'pulse', 'layers', 'spark', 'history'] as const;
export type SkillIconName = (typeof SKILL_ICONS)[number];
