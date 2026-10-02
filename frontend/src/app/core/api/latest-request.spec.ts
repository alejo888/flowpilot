import { signal } from '@angular/core';
import { EMPTY, Subject, of, throwError } from 'rxjs';

import { LatestRequest } from './latest-request';

describe('LatestRequest', () => {
  const fallback = 'No se pudo completar la acción';
  let busy: ReturnType<typeof signal<boolean>>;
  let error: ReturnType<typeof signal<string | null>>;
  let request: LatestRequest;

  beforeEach(() => {
    busy = signal(false);
    error = signal<string | null>('error previo');
    request = new LatestRequest(busy, error);
  });

  it('marks busy and clears the error when a run starts', () => {
    const source = new Subject<number>();

    void request.run(source, { onSuccess: () => undefined, fallback });

    expect(busy()).toBe(true);
    expect(error()).toBeNull();
  });

  it('applies the value, clears busy and resolves true on success', async () => {
    const onSuccess = vi.fn();

    const ok = await request.run(of(42), { onSuccess, fallback });

    expect(ok).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith(42);
    expect(busy()).toBe(false);
    expect(error()).toBeNull();
  });

  it('sets the problem detail, clears busy and resolves false on error', async () => {
    const ok = await request.run(throwError(() => ({ error: { detail: 'Detalle del servidor' } })), {
      onSuccess: () => undefined,
      fallback,
    });

    expect(ok).toBe(false);
    expect(busy()).toBe(false);
    expect(error()).toBe('Detalle del servidor');
  });

  it('falls back to the given message when the error carries no detail', async () => {
    await request.run(throwError(() => ({})), { onSuccess: () => undefined, fallback });

    expect(error()).toBe(fallback);
  });

  it('delegates to a custom onError hook instead of setting the error signal', async () => {
    const onError = vi.fn();
    const failure = { status: 409 };

    const ok = await request.run(throwError(() => failure), { onSuccess: () => undefined, onError });

    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(busy()).toBe(false);
    expect(error()).toBeNull();
  });

  it('ignores a success that lands after invalidate()', async () => {
    const source = new Subject<number>();
    const onSuccess = vi.fn();
    const pending = request.run(source, { onSuccess, fallback });

    request.invalidate();
    source.next(1);

    expect(await pending).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('ignores an error that lands after invalidate()', async () => {
    const source = new Subject<number>();
    const onError = vi.fn();
    const pending = request.run(source, { onSuccess: () => undefined, onError });

    request.invalidate();
    error.set('estado nuevo');
    source.error({ error: { detail: 'tarde' } });

    expect(await pending).toBe(false);
    expect(onError).not.toHaveBeenCalled();
    expect(error()).toBe('estado nuevo');
  });

  it('invalidate() clears busy so a dropped request never leaves it stuck', () => {
    void request.run(new Subject<number>(), { onSuccess: () => undefined, fallback });

    request.invalidate();

    expect(busy()).toBe(false);
  });

  it('invalidate() leaves the error signal to the caller', () => {
    error.set('visible');

    request.invalidate();

    expect(error()).toBe('visible');
  });

  it('lets a newer run supersede an older one without touching its state', async () => {
    const first = new Subject<number>();
    const second = new Subject<number>();
    const seen: number[] = [];
    const firstRun = request.run(first, { onSuccess: (v) => seen.push(v), fallback });
    const secondRun = request.run(second, { onSuccess: (v) => seen.push(v), fallback });

    first.next(1);
    expect(busy()).toBe(true);
    first.error({ error: { detail: 'viejo' } });
    expect(error()).toBeNull();

    second.next(2);

    expect(await firstRun).toBe(false);
    expect(await secondRun).toBe(true);
    expect(seen).toEqual([2]);
    expect(busy()).toBe(false);
  });

  it('resolves false and clears busy when the source completes without a value', async () => {
    const ok = await request.run(EMPTY, { onSuccess: () => undefined, fallback });

    expect(ok).toBe(false);
    expect(busy()).toBe(false);
  });
});
