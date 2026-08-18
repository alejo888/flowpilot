/**
 * Maps a project's domain status to the `fp-badge` semantic variant used by
 * the design system (design: sdd/flowpilot-redesign D2). Keeps domain
 * vocabulary out of `shared/ui` — `fp-badge` only knows about
 * success/warning/danger/neutral.
 */
export function projectStatusBadgeVariant(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'ACTIVO':
      return 'success';
    case 'PAUSADO':
      return 'warning';
    case 'CANCELADO':
      return 'danger';
    default:
      return 'neutral';
  }
}
