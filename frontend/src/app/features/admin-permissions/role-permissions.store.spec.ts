import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { RolePermissionsApiService } from './role-permissions-api.service';
import { RolePermissionMatrixResponse } from './role-permission.model';
import { RolePermissionsStore } from './role-permissions.store';

function matrix(updatedAt: string, granted: boolean): RolePermissionMatrixResponse {
  return {
    roles: ['PROJECT_MANAGER', 'DEVELOPER'],
    permissions: [
      { key: 'MEMBER_ADD', label: 'Agregar miembros', description: 'desc' },
      { key: 'WORKITEM_MOVE', label: 'Mover tareas', description: 'desc' },
    ],
    grants: [
      { role: 'PROJECT_MANAGER', permission: 'MEMBER_ADD', granted },
      { role: 'PROJECT_MANAGER', permission: 'WORKITEM_MOVE', granted: true },
      { role: 'DEVELOPER', permission: 'MEMBER_ADD', granted: false },
      { role: 'DEVELOPER', permission: 'WORKITEM_MOVE', granted: true },
    ],
    updatedAt,
  };
}

describe('RolePermissionsStore', () => {
  let apiSpy: {
    getMatrix: ReturnType<typeof vi.fn>;
    replaceAll: ReturnType<typeof vi.fn>;
  };
  let store: RolePermissionsStore;

  beforeEach(() => {
    apiSpy = { getMatrix: vi.fn(), replaceAll: vi.fn() };
    TestBed.configureTestingModule({
      providers: [RolePermissionsStore, { provide: RolePermissionsApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(RolePermissionsStore);
  });

  it('loads the matrix and starts with no dirty cells', () => {
    apiSpy.getMatrix.mockReturnValue(of(matrix('2026-01-01T00:00:00Z', false)));

    store.load();

    expect(store.roles()).toEqual(['PROJECT_MANAGER', 'DEVELOPER']);
    expect(store.isGranted('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(false);
    expect(store.hasDirtyChanges()).toBe(false);
    expect(store.isDirty('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(false);
  });

  it('marks a toggled cell dirty and un-marks it when toggled back', () => {
    apiSpy.getMatrix.mockReturnValue(of(matrix('2026-01-01T00:00:00Z', false)));
    store.load();

    store.toggle('PROJECT_MANAGER', 'MEMBER_ADD');

    expect(store.isGranted('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(true);
    expect(store.isDirty('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(true);
    expect(store.hasDirtyChanges()).toBe(true);

    store.toggle('PROJECT_MANAGER', 'MEMBER_ADD');

    expect(store.isGranted('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(false);
    expect(store.isDirty('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(false);
    expect(store.hasDirtyChanges()).toBe(false);
  });

  it('saves the full grant set with expectedUpdatedAt and clears dirty state on success', () => {
    apiSpy.getMatrix.mockReturnValue(of(matrix('2026-01-01T00:00:00Z', false)));
    store.load();
    store.toggle('PROJECT_MANAGER', 'MEMBER_ADD');
    apiSpy.replaceAll.mockReturnValue(of(matrix('2026-01-02T00:00:00Z', true)));

    store.save();

    expect(apiSpy.replaceAll).toHaveBeenCalledWith({
      grants: expect.arrayContaining([
        { role: 'PROJECT_MANAGER', permission: 'MEMBER_ADD', granted: true },
      ]),
      expectedUpdatedAt: '2026-01-01T00:00:00Z',
    });
    expect(store.hasDirtyChanges()).toBe(false);
    expect(store.conflict()).toBe(false);
  });

  it('sets the conflict flag on a 409 without discarding the local edit', () => {
    apiSpy.getMatrix.mockReturnValue(of(matrix('2026-01-01T00:00:00Z', false)));
    store.load();
    store.toggle('PROJECT_MANAGER', 'MEMBER_ADD');
    apiSpy.replaceAll.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'stale' } })),
    );

    store.save();

    expect(store.conflict()).toBe(true);
    expect(store.isGranted('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(true);
    expect(store.isDirty('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(true);
  });

  it('reloadAfterConflict discards local edits and clears the conflict flag', () => {
    apiSpy.getMatrix
      .mockReturnValueOnce(of(matrix('2026-01-01T00:00:00Z', false)))
      .mockReturnValueOnce(of(matrix('2026-01-02T00:00:00Z', true)));
    store.load();
    store.toggle('PROJECT_MANAGER', 'MEMBER_ADD');
    apiSpy.replaceAll.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'stale' } })),
    );
    store.save();

    store.reloadAfterConflict();

    expect(store.conflict()).toBe(false);
    expect(store.hasDirtyChanges()).toBe(false);
    expect(store.isGranted('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(true);
  });

  it('sets a plain error message on a non-409 failure', () => {
    apiSpy.getMatrix.mockReturnValue(of(matrix('2026-01-01T00:00:00Z', false)));
    store.load();
    store.toggle('PROJECT_MANAGER', 'MEMBER_ADD');
    apiSpy.replaceAll.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { detail: 'boom' } })),
    );

    store.save();

    expect(store.conflict()).toBe(false);
    expect(store.error()).toBeTruthy();
  });

  it('resets all state when AuthStore.isAuthenticated transitions to false (logout)', () => {
    const isAuthenticated = signal(true);
    TestBed.resetTestingModule();
    apiSpy = { getMatrix: vi.fn(), replaceAll: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        RolePermissionsStore,
        { provide: RolePermissionsApiService, useValue: apiSpy },
        { provide: AuthStore, useValue: { isAuthenticated } },
      ],
    });
    store = TestBed.inject(RolePermissionsStore);
    apiSpy.getMatrix.mockReturnValue(of(matrix('2026-01-01T00:00:00Z', false)));
    store.load();
    store.toggle('PROJECT_MANAGER', 'MEMBER_ADD');
    expect(store.roles()).toEqual(['PROJECT_MANAGER', 'DEVELOPER']);
    expect(store.hasDirtyChanges()).toBe(true);

    isAuthenticated.set(false);
    TestBed.tick();

    expect(store.roles()).toEqual([]);
    expect(store.permissions()).toEqual([]);
    expect(store.updatedAt()).toBeNull();
    expect(store.hasDirtyChanges()).toBe(false);
    expect(store.isGranted('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.conflict()).toBe(false);
    expect(store.saving()).toBe(false);
  });
});
