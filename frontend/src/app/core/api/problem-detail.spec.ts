import { HttpErrorResponse } from '@angular/common/http';

import { problemDetail } from './problem-detail';

describe('problemDetail', () => {
  const fallback = 'No se pudo completar la acción';

  it('returns the RFC 7807 detail from an HTTP error body', () => {
    const err = new HttpErrorResponse({ status: 409, error: { detail: 'Ya existe un proyecto con ese código' } });

    expect(problemDetail(err, fallback)).toBe('Ya existe un proyecto con ese código');
  });

  it('returns the detail from a plain error-shaped object', () => {
    expect(problemDetail({ error: { detail: 'Detalle del servidor' } }, fallback)).toBe('Detalle del servidor');
  });

  it('falls back when the error has no body', () => {
    expect(problemDetail(new HttpErrorResponse({ status: 0 }), fallback)).toBe(fallback);
    expect(problemDetail({}, fallback)).toBe(fallback);
  });

  it('falls back when the body has no detail', () => {
    expect(problemDetail({ error: { title: 'Bad Request' } }, fallback)).toBe(fallback);
  });

  it('falls back when the detail is empty or not a string', () => {
    expect(problemDetail({ error: { detail: '' } }, fallback)).toBe(fallback);
    expect(problemDetail({ error: { detail: 42 } }, fallback)).toBe(fallback);
    expect(problemDetail({ error: { detail: null } }, fallback)).toBe(fallback);
  });

  it('falls back for null, undefined and non-object errors', () => {
    expect(problemDetail(null, fallback)).toBe(fallback);
    expect(problemDetail(undefined, fallback)).toBe(fallback);
    expect(problemDetail('boom', fallback)).toBe(fallback);
  });
});
