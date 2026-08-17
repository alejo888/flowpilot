import { columnAccent } from './column-accent';

describe('columnAccent', () => {
  it('maps "Por hacer" to the neutral accent', () => {
    expect(columnAccent('Por hacer', 0)).toBe('#9a9186');
  });

  it('maps "En progreso" to the focus-blue accent', () => {
    expect(columnAccent('En progreso', 1)).toBe('#2a6f8c');
  });

  it('maps "En revisión" to the warning accent', () => {
    expect(columnAccent('En revisión', 2)).toBe('#c68a1d');
  });

  it('maps "Terminado" to the success accent', () => {
    expect(columnAccent('Terminado', 3)).toBe('#2f7d5a');
  });

  it('matches case-insensitively', () => {
    expect(columnAccent('EN PROGRESO', 0)).toBe('#2a6f8c');
    expect(columnAccent('terminado', 0)).toBe('#2f7d5a');
  });

  it('matches accent-insensitively (diacritics stripped)', () => {
    expect(columnAccent('En revision', 0)).toBe('#c68a1d');
  });

  it('falls back to an index-based palette entry for an unrecognized name', () => {
    expect(columnAccent('Backlog', 1)).toBe('#2a6f8c');
    expect(columnAccent('Bloqueado', 2)).toBe('#c68a1d');
  });

  it('defaults to the neutral accent for an unrecognized name at index 0', () => {
    expect(columnAccent('Backlog', 0)).toBe('#9a9186');
  });

  it('wraps the palette for an out-of-range index on an unrecognized name', () => {
    expect(columnAccent('Backlog', 5)).toBe(columnAccent('Backlog', 1));
  });
});
