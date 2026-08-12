import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProjectMember } from './project-member.model';
import { ProjectMembersComponent } from './project-members.component';
import { ProjectMembersStore } from './project-members.store';

function member(id: number, userId: number): ProjectMember {
  return {
    id,
    projectId: 10,
    userId,
    role: 'DEVELOPER',
    joinedAt: '2026-08-01T00:00:00Z',
  };
}

describe('ProjectMembersComponent', () => {
  let fixture: ComponentFixture<ProjectMembersComponent>;
  let storeStub: {
    members: ReturnType<typeof signal<ProjectMember[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    loadMembers: ReturnType<typeof vi.fn>;
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
      loading: signal(false),
      error: signal(null),
      loadMembers: vi.fn(),
    };
  });

  it('loads the roster for the given project on init', async () => {
    await setup();

    expect(storeStub.loadMembers).toHaveBeenCalledWith(10);
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

  it('renders each member with a Usuario #id placeholder, role, and join date', async () => {
    storeStub.members.set([member(1, 7), member(2, 8)]);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('[data-testid="member-user"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Usuario #7');
    expect(rows[1].textContent).toContain('Usuario #8');
    expect(compiled.querySelector('[data-testid="member-row-1"] [data-testid="member-role"]')?.textContent).toContain(
      'Desarrollador',
    );
    expect(
      compiled.querySelector('[data-testid="member-row-1"] [data-testid="member-joined-at"]')?.textContent,
    ).toContain('2026-08-01T00:00:00Z');
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
});
