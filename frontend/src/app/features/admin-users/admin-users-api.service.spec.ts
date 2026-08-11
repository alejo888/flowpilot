import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminUsersApiService } from './admin-users-api.service';
import { AdminUser } from './admin-user.model';

describe('AdminUsersApiService', () => {
  let service: AdminUsersApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminUsersApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminUsersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the full admin user list', () => {
    const users: AdminUser[] = [
      { id: 1, name: 'Admin', email: 'admin@flowpilot.local', role: 'ADMINISTRADOR', active: true },
      { id: 2, name: 'Member', email: 'member@flowpilot.local', role: 'MIEMBRO_EQUIPO', active: true },
    ];
    let result: AdminUser[] | undefined;

    service.listUsers().subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/admin/users');
    expect(req.request.method).toBe('GET');
    req.flush(users);

    expect(result).toEqual(users);
  });

  it('sends a status update request', () => {
    const updated: AdminUser = {
      id: 2,
      name: 'Member',
      email: 'member@flowpilot.local',
      role: 'MIEMBRO_EQUIPO',
      active: false,
    };
    let result: AdminUser | undefined;

    service.setStatus(2, { active: false }).subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/admin/users/2/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ active: false });
    req.flush(updated);

    expect(result?.active).toBe(false);
  });

  it('sends a role change request', () => {
    const updated: AdminUser = {
      id: 2,
      name: 'Member',
      email: 'member@flowpilot.local',
      role: 'ADMINISTRADOR',
      active: true,
    };
    let result: AdminUser | undefined;

    service.changeRole(2, { role: 'ADMINISTRADOR' }).subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/admin/users/2/role');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ role: 'ADMINISTRADOR' });
    req.flush(updated);

    expect(result?.role).toBe('ADMINISTRADOR');
  });
});
