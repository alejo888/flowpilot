import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthApiService } from './auth-api.service';
import { AccessTokenResponse } from './auth.model';
import { AuthStore } from './auth.store';

describe('AuthStore', () => {
  let apiSpy: {
    login: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let store: AuthStore;

  beforeEach(() => {
    apiSpy = {
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [AuthStore, { provide: AuthApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(AuthStore);
  });

  it('sets the access token and isAuthenticated on successful login', () => {
    const response: AccessTokenResponse = { accessToken: 'token-1', expiresIn: 900 };
    apiSpy.login.mockReturnValue(of(response));

    store.login('user@flowpilot.local', 'secret');

    expect(store.accessToken()).toBe('token-1');
    expect(store.isAuthenticated()).toBe(true);
    expect(apiSpy.login).toHaveBeenCalledWith({
      email: 'user@flowpilot.local',
      password: 'secret',
    });
  });

  it('surfaces the RFC7807 detail and stays unauthenticated on invalid credentials', () => {
    apiSpy.login.mockReturnValue(
      throwError(() => ({ status: 401, error: { detail: 'Invalid email or password' } })),
    );

    store.login('user@flowpilot.local', 'wrong');

    expect(store.error()).toBe('Invalid email or password');
    expect(store.isAuthenticated()).toBe(false);
  });

  it('resolves true and populates the session when hydration succeeds', () => {
    const response: AccessTokenResponse = { accessToken: 'token-2', expiresIn: 900 };
    apiSpy.refresh.mockReturnValue(of(response));

    let result: boolean | undefined;
    let threw = false;
    store.hydrate().subscribe({
      next: (value) => (result = value),
      error: () => (threw = true),
    });

    expect(threw).toBe(false);
    expect(result).toBe(true);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('resolves false without throwing when hydration fails', () => {
    apiSpy.refresh.mockReturnValue(throwError(() => ({ status: 401 })));

    let result: boolean | undefined;
    let threw = false;
    store.hydrate().subscribe({
      next: (value) => (result = value),
      error: () => (threw = true),
    });

    expect(threw).toBe(false);
    expect(result).toBe(false);
    expect(store.isAuthenticated()).toBe(false);
  });

  it('clears local state on logout regardless of the api outcome', () => {
    apiSpy.login.mockReturnValue(of({ accessToken: 'token-3', expiresIn: 900 }));
    store.login('user@flowpilot.local', 'secret');
    expect(store.isAuthenticated()).toBe(true);

    apiSpy.logout.mockReturnValue(throwError(() => ({ status: 500 })));

    store.logout();

    expect(store.accessToken()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('shares a single in-flight refresh call across two concurrent subscribers', () => {
    const response: AccessTokenResponse = { accessToken: 'token-4', expiresIn: 900 };
    apiSpy.refresh.mockReturnValue(of(response));

    const results: string[] = [];
    const first = store.refresh();
    const second = store.refresh();
    first.subscribe((token: string) => results.push(token));
    second.subscribe((token: string) => results.push(token));

    expect(apiSpy.refresh).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['token-4', 'token-4']);
  });
});
