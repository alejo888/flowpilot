import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { AuthStore } from './auth.store';
import { adminGuard, authGuard } from './auth.guard';

describe('authGuard', () => {
  let authStoreStub: { isAuthenticated: () => boolean; isAdmin: () => boolean };
  let router: Router;

  function runGuard(guard: typeof authGuard, url: string): boolean | UrlTree {
    const state = { url } as RouterStateSnapshot;
    const route = {} as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => guard(route, state)) as boolean | UrlTree;
  }

  beforeEach(() => {
    authStoreStub = {
      isAuthenticated: () => false,
      isAdmin: () => false,
    };

    TestBed.configureTestingModule({
      providers: [{ provide: AuthStore, useValue: authStoreStub }],
    });
    router = TestBed.inject(Router);
  });

  it('redirects an unauthenticated user to /login with returnUrl equal to the requested URL', () => {
    const result = runGuard(authGuard, '/projects/1/board');

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login?returnUrl=%2Fprojects%2F1%2Fboard');
  });

  it('allows activation for an authenticated user', () => {
    authStoreStub.isAuthenticated = () => true;

    const result = runGuard(authGuard, '/projects/1/board');

    expect(result).toBe(true);
  });
});

describe('adminGuard', () => {
  let authStoreStub: { isAuthenticated: () => boolean; isAdmin: () => boolean };
  let router: Router;

  function runGuard(url: string): boolean | UrlTree {
    const state = { url } as RouterStateSnapshot;
    const route = {} as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => adminGuard(route, state)) as boolean | UrlTree;
  }

  beforeEach(() => {
    authStoreStub = {
      isAuthenticated: () => false,
      isAdmin: () => false,
    };

    TestBed.configureTestingModule({
      providers: [{ provide: AuthStore, useValue: authStoreStub }],
    });
    router = TestBed.inject(Router);
  });

  it('redirects an unauthenticated user to /login with returnUrl equal to the requested admin URL', () => {
    const result = runGuard('/admin/users');

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login?returnUrl=%2Fadmin%2Fusers');
  });

  it('allows activation for an authenticated administrator', () => {
    authStoreStub.isAuthenticated = () => true;
    authStoreStub.isAdmin = () => true;

    const result = runGuard('/admin/users');

    expect(result).toBe(true);
  });

  it('denies an authenticated non-admin and redirects to home', () => {
    authStoreStub.isAuthenticated = () => true;
    authStoreStub.isAdmin = () => false;

    const result = runGuard('/admin/users');

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('fails closed and denies access when the role claim cannot be determined (isAdmin false)', () => {
    // Simulates a forged/garbled/missing role claim: decodeRole() already
    // resolved to null upstream, so isAdmin() is false exactly like a
    // legitimate non-admin user — the guard must not distinguish the two.
    authStoreStub.isAuthenticated = () => true;
    authStoreStub.isAdmin = () => false;

    const result = runGuard('/admin/permissions');

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });
});
