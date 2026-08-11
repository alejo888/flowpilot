import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AdminUsersApiService } from './admin-users-api.service';
import { AdminUser } from './admin-user.model';
import { AdminUsersStore } from './admin-users.store';

function user(id: number, role: AdminUser['role'], active: boolean, name = `User ${id}`): AdminUser {
  return { id, name, email: `user${id}@flowpilot.local`, role, active };
}

describe('AdminUsersStore', () => {
  let apiSpy: {
    listUsers: ReturnType<typeof vi.fn>;
    setStatus: ReturnType<typeof vi.fn>;
    changeRole: ReturnType<typeof vi.fn>;
  };
  let store: AdminUsersStore;

  beforeEach(() => {
    apiSpy = {
      listUsers: vi.fn(),
      setStatus: vi.fn(),
      changeRole: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [AdminUsersStore, { provide: AdminUsersApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(AdminUsersStore);
  });

  it('loads the full user list', () => {
    apiSpy.listUsers.mockReturnValue(
      of([user(1, 'ADMINISTRADOR', true), user(2, 'MIEMBRO_EQUIPO', true)]),
    );

    store.load();

    expect(store.users()).toHaveLength(2);
    expect(store.activeAdministratorCount()).toBe(1);
  });

  it('replaces the user in place after a successful status change', () => {
    apiSpy.listUsers.mockReturnValue(of([user(2, 'MIEMBRO_EQUIPO', true)]));
    apiSpy.setStatus.mockReturnValue(of(user(2, 'MIEMBRO_EQUIPO', false)));
    store.load();

    store.setStatus(2, false);

    expect(store.users()[0].active).toBe(false);
    expect(apiSpy.setStatus).toHaveBeenCalledWith(2, { active: false });
  });

  it('surfaces the server error and leaves state untouched when the last-admin guard rejects a deactivation', () => {
    apiSpy.listUsers.mockReturnValue(of([user(1, 'ADMINISTRADOR', true)]));
    apiSpy.setStatus.mockReturnValue(
      throwError(() => new Error('Cannot deactivate or demote the last active Administrador')),
    );
    store.load();

    store.setStatus(1, false);

    expect(store.users()[0].active).toBe(true);
    expect(store.error()).toBe('Cannot deactivate or demote the last active Administrador');
  });

  it('replaces the user in place after a successful role change', () => {
    apiSpy.listUsers.mockReturnValue(of([user(2, 'MIEMBRO_EQUIPO', true)]));
    apiSpy.changeRole.mockReturnValue(of(user(2, 'ADMINISTRADOR', true)));
    store.load();

    store.changeRole(2, 'ADMINISTRADOR');

    expect(store.users()[0].role).toBe('ADMINISTRADOR');
    expect(apiSpy.changeRole).toHaveBeenCalledWith(2, { role: 'ADMINISTRADOR' });
  });
});
