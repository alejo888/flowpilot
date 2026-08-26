import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminPermissionsComponent } from './admin-permissions.component';
import { RolePermissionsStore } from './role-permissions.store';

describe('AdminPermissionsComponent', () => {
  let fixture: ComponentFixture<AdminPermissionsComponent>;
  let storeStub: {
    roles: ReturnType<typeof signal<string[]>>;
    permissions: ReturnType<typeof signal<{ key: string; label: string; description: string }[]>>;
    error: ReturnType<typeof signal<string | null>>;
    conflict: ReturnType<typeof signal<boolean>>;
    saving: ReturnType<typeof signal<boolean>>;
    hasDirtyChanges: ReturnType<typeof signal<boolean>>;
    load: ReturnType<typeof vi.fn>;
    isGranted: ReturnType<typeof vi.fn>;
    isDirty: ReturnType<typeof vi.fn>;
    toggle: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    reloadAfterConflict: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    storeStub = {
      roles: signal(['PROJECT_MANAGER', 'DEVELOPER']),
      permissions: signal([{ key: 'MEMBER_ADD', label: 'Agregar miembros', description: 'desc' }]),
      error: signal(null),
      conflict: signal(false),
      saving: signal(false),
      hasDirtyChanges: signal(false),
      load: vi.fn(),
      isGranted: vi.fn().mockReturnValue(false),
      isDirty: vi.fn().mockReturnValue(false),
      toggle: vi.fn(),
      save: vi.fn(),
      reloadAfterConflict: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AdminPermissionsComponent],
      providers: [{ provide: RolePermissionsStore, useValue: storeStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPermissionsComponent);
    fixture.detectChanges();
  });

  it('loads the matrix on init', () => {
    expect(storeStub.load).toHaveBeenCalled();
  });

  it('renders a grid cell per role/permission pair', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cells = compiled.querySelectorAll('[data-testid^="cell-"]');
    expect(cells.length).toBe(2);
  });

  it('toggles a cell via the store when clicked', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cell = compiled.querySelector(
      '[data-testid="cell-PROJECT_MANAGER-MEMBER_ADD"]',
    ) as HTMLInputElement;

    cell.click();

    expect(storeStub.toggle).toHaveBeenCalledWith('PROJECT_MANAGER', 'MEMBER_ADD');
  });

  it('disables every grid cell while a save is in flight', () => {
    storeStub.saving.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const cell = compiled.querySelector(
      '[data-testid="cell-PROJECT_MANAGER-MEMBER_ADD"]',
    ) as HTMLInputElement;

    expect(cell.disabled).toBe(true);
  });

  it('disables the save button when there are no dirty changes', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('[data-testid="save-button"]') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
  });

  it('enables save and calls the store when dirty', () => {
    storeStub.hasDirtyChanges.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('[data-testid="save-button"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    button.click();

    expect(storeStub.save).toHaveBeenCalled();
  });

  it('shows the reload-and-warn dialog on conflict and reloads on confirm', () => {
    storeStub.conflict.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const dialog = compiled.querySelector('[data-testid="conflict-dialog"]');
    expect(dialog).toBeTruthy();

    const reloadButton = compiled.querySelector('[data-testid="conflict-reload"]') as HTMLButtonElement;
    reloadButton.click();

    expect(storeStub.reloadAfterConflict).toHaveBeenCalled();
  });

  it('displays the store error when present', () => {
    storeStub.error.set('Request failed');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="admin-permissions-error"]')?.textContent).toContain(
      'Request failed',
    );
  });
});
