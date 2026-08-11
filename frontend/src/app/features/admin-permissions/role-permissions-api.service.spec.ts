import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { RolePermissionsApiService } from './role-permissions-api.service';
import { RolePermissionMatrixResponse } from './role-permission.model';

describe('RolePermissionsApiService', () => {
  let service: RolePermissionsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RolePermissionsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RolePermissionsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the full matrix', () => {
    const response: RolePermissionMatrixResponse = {
      roles: ['PROJECT_MANAGER'],
      permissions: [{ key: 'MEMBER_ADD', label: 'Agregar miembros', description: 'desc' }],
      grants: [{ role: 'PROJECT_MANAGER', permission: 'MEMBER_ADD', granted: true }],
      updatedAt: '2026-01-01T00:00:00Z',
    };
    let result: RolePermissionMatrixResponse | undefined;

    service.getMatrix().subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/admin/role-permissions');
    expect(req.request.method).toBe('GET');
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('sends a bulk replace request', () => {
    const response: RolePermissionMatrixResponse = {
      roles: ['PROJECT_MANAGER'],
      permissions: [{ key: 'MEMBER_ADD', label: 'Agregar miembros', description: 'desc' }],
      grants: [{ role: 'PROJECT_MANAGER', permission: 'MEMBER_ADD', granted: false }],
      updatedAt: '2026-01-02T00:00:00Z',
    };
    let result: RolePermissionMatrixResponse | undefined;

    service
      .replaceAll({
        grants: [{ role: 'PROJECT_MANAGER', permission: 'MEMBER_ADD', granted: false }],
        expectedUpdatedAt: '2026-01-01T00:00:00Z',
      })
      .subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/admin/role-permissions');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      grants: [{ role: 'PROJECT_MANAGER', permission: 'MEMBER_ADD', granted: false }],
      expectedUpdatedAt: '2026-01-01T00:00:00Z',
    });
    req.flush(response);

    expect(result?.updatedAt).toBe('2026-01-02T00:00:00Z');
  });
});
