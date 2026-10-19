export const MANUAL_SECTIONS = [
  { id: 'start', images: ['sign-in'] },
  { id: 'board', images: ['board'] },
  { id: 'issue', images: ['issue-detail'] },
  { id: 'assign', images: ['assign'] },
  { id: 'plan', images: ['project-plan'] },
  { id: 'initiatives', images: ['initiatives'] },
  { id: 'dashboards', images: ['dashboards'] },
  { id: 'agents', images: ['ai-agents'] },
  { id: 'groups', images: ['groups'] },
  { id: 'settings', images: ['states', 'custom-fields', 'templates'] },
  { id: 'import', images: ['import-export'] },
  { id: 'members', images: ['members', 'notifications'] },
  { id: 'mcp', images: ['mcp'] },
  { id: 'account', images: [] },
  { id: 'help', images: [] },
] as const;

export type ManualSection = (typeof MANUAL_SECTIONS)[number];
export type ManualSectionId = ManualSection['id'];
export type ManualImage = ManualSection['images'][number];

export const MANUAL_STEPS = [1, 2, 3, 4, 5] as const;

export const MANUAL_IMAGE_SIZE = { width: 1458, height: 812 };
