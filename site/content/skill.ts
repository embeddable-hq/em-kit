import { BRAND } from '../config';

// Where the Claude Code skill is served, and the command that installs it.
// Its text is skillMarkdown in llms.ts.

export const SKILL_NAME = 'emkit';
export const SKILL_PATH = `/skills/${SKILL_NAME}/SKILL.md`;

export const skillInstall = (origin: string = BRAND.url) =>
  `mkdir -p .claude/skills/${SKILL_NAME} && curl -fsSL ${origin}${SKILL_PATH} -o .claude/skills/${SKILL_NAME}/SKILL.md`;
