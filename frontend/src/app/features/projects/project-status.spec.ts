import { projectStatusBadgeVariant } from './project-status';

describe('projectStatusBadgeVariant', () => {
  it('maps ACTIVO to the success badge variant', () => {
    expect(projectStatusBadgeVariant('ACTIVO')).toBe('success');
  });

  it('maps PAUSADO to the warning badge variant', () => {
    expect(projectStatusBadgeVariant('PAUSADO')).toBe('warning');
  });

  it('maps CANCELADO to the danger badge variant', () => {
    expect(projectStatusBadgeVariant('CANCELADO')).toBe('danger');
  });

  it('maps PLANIFICACION to the neutral badge variant', () => {
    expect(projectStatusBadgeVariant('PLANIFICACION')).toBe('neutral');
  });

  it('maps FINALIZADO to the neutral badge variant', () => {
    expect(projectStatusBadgeVariant('FINALIZADO')).toBe('neutral');
  });

  it('falls back to the neutral badge variant for an unknown status', () => {
    expect(projectStatusBadgeVariant('SOMETHING_UNKNOWN')).toBe('neutral');
  });
});
