import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProjectMember } from './project-member.model';
import { ProjectMembersComponent } from './project-members.component';
import { ProjectMembersStore } from './project-members.store';
import { UserSummary } from './user-summary.model';

function member(id: number, userId: number): ProjectMember {
  return {
    id,
    projectId: 10,
    userId,
    role: 'DEVELOPER',
    joinedAt: '2026-08-01T00:00:00Z',
  };
}

function user(id: number, name: string, email: string): UserSummary {
  return { id, name, email };
}

describe('ProjectMembersComponent', () => {
  let fixture: ComponentFixture<ProjectMembersComponent>;
  let storeStub: {
    members: ReturnType<typeof signal<ProjectMember[]>>;
    users: ReturnType<typeof signal<UserSummary[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    adding: ReturnType<typeof signal<boolean>>;
    lastAdded: ReturnType<typeof signal<ProjectMember | null>>;
    error: ReturnType<typeof signal<string | null>>;
    memberUserIds: ReturnType<typeof signal<Set<number>>>;
    loadMembers: ReturnType<typeof vi.fn>;
    loadUsers: ReturnType<typeof vi.fn>;
    addMember: ReturnType<typeof vi.fn>;
  };

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProjectMembersComponent],
      providers: [provideRouter([]), { provide: ProjectMembersStore, useValue: storeStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectMembersComponent);
    fixture.componentRef.setInput('projectId', 10);
    fixture.detectChanges();
  }

  beforeEach(() => {
    storeStub = {
      members: signal([]),
      users: signal([]),
      loading: signal(false),
      adding: signal(false),
      lastAdded: signal(null),
      error: signal(null),
      memberUserIds: signal(new Set<number>()),
      loadMembers: vi.fn(),
      loadUsers: vi.fn(),
      addMember: vi.fn(),
    };
  });

  it('loads the roster and the user directory for the given project on init', async () => {
    await setup();

    expect(storeStub.loadMembers).toHaveBeenCalledWith(10);
    expect(storeStub.loadUsers).toHaveBeenCalled();
  });

  it('shows the loading state while the store is fetching', async () => {
    storeStub.loading.set(true);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="members-loading"]')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="members-empty"]')).toBeFalsy();
  });

  it('shows the empty state with copy explaining the owner is not auto-appended', async () => {
    storeStub.loading.set(false);
    storeStub.members.set([]);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const emptyState = compiled.querySelector('[data-testid="members-empty"]');
    expect(emptyState?.textContent).toContain('no tiene miembros');
    expect(emptyState?.textContent).toContain('dueño');
  });

  it('renders each member with its resolved name/email once the directory has loaded, plus role and join date', async () => {
    storeStub.members.set([member(1, 7), member(2, 8)]);
    storeStub.users.set([user(7, 'Ada Lovelace', 'ada@flowpilot.local'), user(8, 'Alan Turing', 'alan@flowpilot.local')]);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('[data-testid="member-user"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Ada Lovelace');
    expect(rows[0].textContent).toContain('ada@flowpilot.local');
    expect(rows[1].textContent).toContain('Alan Turing');
    expect(compiled.querySelector('[data-testid="member-row-1"] [data-testid="member-role"]')?.textContent).toContain(
      'Desarrollador',
    );
    expect(
      compiled.querySelector('[data-testid="member-row-1"] [data-testid="member-joined-at"]')?.textContent,
    ).toContain('2026-08-01T00:00:00Z');
  });

  it('falls back to the Usuario #id placeholder while the directory has not resolved a member yet', async () => {
    storeStub.members.set([member(1, 7)]);
    storeStub.users.set([]);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="member-user"]')?.textContent).toContain('Usuario #7');
  });

  it('displays the store error from ProblemDetail', async () => {
    storeStub.error.set('No se pudieron cargar los miembros');
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="project-members-error"]')?.textContent).toContain(
      'No se pudieron cargar los miembros',
    );
  });

  it('renders a back-link to the projects list', async () => {
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('[data-testid="members-projects-link"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/projects');
  });

  it('narrows selectable users in the picker by name/email filter text', async () => {
    storeStub.users.set([
      user(7, 'Ada Lovelace', 'ada@flowpilot.local'),
      user(8, 'Alan Turing', 'alan@flowpilot.local'),
    ]);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const filterInput = compiled.querySelector('[data-testid="member-add-filter"]') as HTMLInputElement;
    filterInput.value = 'ada';
    filterInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = compiled.querySelectorAll('[data-testid="member-add-user-select"] option');
    // First option is the empty placeholder; the rest are the filtered users.
    expect(options).toHaveLength(2);
    expect(options[1].textContent).toContain('Ada Lovelace');
  });

  it('excludes users already on the roster from the picker', async () => {
    storeStub.users.set([
      user(7, 'Ada Lovelace', 'ada@flowpilot.local'),
      user(8, 'Alan Turing', 'alan@flowpilot.local'),
    ]);
    storeStub.memberUserIds.set(new Set([7]));
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const options = compiled.querySelectorAll('[data-testid="member-add-user-select"] option');
    expect(options).toHaveLength(2);
    expect(options[1].textContent).toContain('Alan Turing');
  });

  it('blocks submit with a client-side error when no user or role is selected', async () => {
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const form = compiled.querySelector('[data-testid="member-add-form"]') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(compiled.querySelector('[data-testid="member-add-error"]')).toBeTruthy();
    expect(storeStub.addMember).not.toHaveBeenCalled();
  });

  it('submits the selected user and role to the store', async () => {
    storeStub.users.set([user(7, 'Ada Lovelace', 'ada@flowpilot.local')]);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const userSelect = compiled.querySelector('[data-testid="member-add-user-select"]') as HTMLSelectElement;
    userSelect.value = '7';
    userSelect.dispatchEvent(new Event('change'));

    const roleSelect = compiled.querySelector('[data-testid="member-add-role-select"]') as HTMLSelectElement;
    roleSelect.value = 'DEVELOPER';
    roleSelect.dispatchEvent(new Event('change'));

    const form = compiled.querySelector('[data-testid="member-add-form"]') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(compiled.querySelector('[data-testid="member-add-error"]')).toBeFalsy();
    expect(storeStub.addMember).toHaveBeenCalledWith(10, 7, 'DEVELOPER');
  });

  it('clears the picker selection and filter after a successful add', async () => {
    storeStub.users.set([user(7, 'Ada Lovelace', 'ada@flowpilot.local')]);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const filterInput = compiled.querySelector('[data-testid="member-add-filter"]') as HTMLInputElement;
    filterInput.value = 'ada';
    filterInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    storeStub.lastAdded.set(member(3, 7));
    fixture.detectChanges();

    const filterInputAfter = compiled.querySelector('[data-testid="member-add-filter"]') as HTMLInputElement;
    expect(filterInputAfter.value).toBe('');
  });
});
