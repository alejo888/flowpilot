import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminUser } from './admin-user.model';
import { AdminUsersComponent } from './admin-users.component';
import { AdminUsersStore } from './admin-users.store';

function user(id: number, role: AdminUser['role'], active: boolean, name = `User ${id}`): AdminUser {
  return { id, name, email: `user${id}@flowpilot.local`, role, active };
}

describe('AdminUsersComponent', () => {
  let fixture: ComponentFixture<AdminUsersComponent>;
  let storeStub: {
    users: ReturnType<typeof signal<AdminUser[]>>;
    error: ReturnType<typeof signal<string | null>>;
    load: ReturnType<typeof vi.fn>;
    setStatus: ReturnType<typeof vi.fn>;
    changeRole: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    storeStub = {
      users: signal([user(1, 'ADMINISTRADOR', true, 'Admin'), user(2, 'MIEMBRO_EQUIPO', true, 'Member')]),
      error: signal(null),
      load: vi.fn(),
      setStatus: vi.fn(),
      changeRole: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [{ provide: AdminUsersStore, useValue: storeStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    fixture.detectChanges();
  });

  it('loads the user list on init', () => {
    expect(storeStub.load).toHaveBeenCalled();
  });

  it('renders each user with role and active columns', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const roles = Array.from(compiled.querySelectorAll('[data-testid="user-role"]')).map((el) =>
      el.textContent?.trim(),
    );
    const active = Array.from(compiled.querySelectorAll('[data-testid="user-active"]')).map((el) =>
      el.textContent?.trim(),
    );
    expect(roles).toEqual(['ADMINISTRADOR', 'MIEMBRO_EQUIPO']);
    expect(active).toEqual(['Sí', 'Sí']);
  });

  it('toggles active status via the store when the button is clicked', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('[data-testid="user-row-2"] [data-testid="toggle-status"]') as HTMLButtonElement;

    button.click();

    expect(storeStub.setStatus).toHaveBeenCalledWith(2, false);
  });

  it('changes role via the store when a new role is selected', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const select = compiled.querySelector(
      '[data-testid="user-row-2"] [data-testid="role-select"]',
    ) as HTMLSelectElement;

    select.value = 'ADMINISTRADOR';
    select.dispatchEvent(new Event('change'));

    expect(storeStub.changeRole).toHaveBeenCalledWith(2, 'ADMINISTRADOR');
  });

  it('displays the store error when a change is rejected', () => {
    storeStub.error.set('Cannot deactivate or demote the last active Administrador');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="admin-users-error"]')?.textContent).toContain(
      'last active Administrador',
    );
  });
});
