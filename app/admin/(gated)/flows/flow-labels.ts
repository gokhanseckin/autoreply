// Human-readable labels for flow enum values. The DB stores compact codes
// (`tr`/`en`, `comment`/`dm`/`story_reply`); the admin UI shows these instead
// of the raw code so a saved flow never reads back as "en" or "story_reply".

export const LANGUAGE_LABELS: Record<string, string> = {
  tr: 'Turkish',
  en: 'English',
};

export const TRIGGER_LABELS: Record<string, string> = {
  comment: 'Post comment',
  dm: 'DM keyword',
  story_reply: 'Story reply / comment',
};

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? code;
}

export function triggerLabel(code: string): string {
  return TRIGGER_LABELS[code] ?? code;
}
