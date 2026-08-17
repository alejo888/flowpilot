/**
 * Board column accent color (spec: ui-design-system; design D6). Backend
 * column names are Spanish free text, not a closed enum, so this matches
 * case- and accent-insensitively against the known default columns and
 * falls back to an index-based palette entry — never an unstyled column —
 * for any unrecognized name.
 */
const ACCENT_PALETTE = ['#9a9186', '#2a6f8c', '#c68a1d', '#2f7d5a'] as const;

const KNOWN_COLUMN_ACCENTS: Record<string, string> = {
  'por hacer': ACCENT_PALETTE[0],
  'en progreso': ACCENT_PALETTE[1],
  'en revision': ACCENT_PALETTE[2],
  terminado: ACCENT_PALETTE[3],
};

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function columnAccent(name: string, index: number): string {
  const known = KNOWN_COLUMN_ACCENTS[normalize(name)];
  if (known) {
    return known;
  }

  return ACCENT_PALETTE[index % ACCENT_PALETTE.length];
}
