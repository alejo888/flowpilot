import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ProjectMember } from './project-member.model';
import { ProjectMembersApiService } from './project-members-api.service';
import { ProjectMembersStore } from './project-members.store';
import { UserSummary } from './user-summary.model';
import { UsersApiService } from './users-api.service';

function member(id: number, userId: number): ProjectMember {
  return {
    id,
    projectId: 10,
    userId,
    role: 'DEVELOPER',
    joinedAt: '2026-08-01T00:00:00Z',
  };
}

function user(id: number): UserSummary {
  return { id, name: `User ${id}`, email: `user${id}@flowpilot.local` };
}

describe('ProjectMembersStore', () => {
  let apiSpy: {
    listMembers: ReturnType<typeof vi.fn>;
    addMember: ReturnType<typeof vi.fn>;
  };
  let usersApiSpy: {
    listUsers: ReturnType<typeof vi.fn>;
  };
  let store: ProjectMembersStore;

  beforeEach(() => {
    apiSpy = {
      listMembers: vi.fn(),
      addMember: vi.fn(),
    };
    usersApiSpy = {
      listUsers: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        ProjectMembersStore,
        { provide: ProjectMembersApiService, useValue: apiSpy },
        { provide: UsersApiService, useValue: usersApiSpy },
      ],
    });
    store = TestBed.inject(ProjectMembersStore);
  });

  it('starts with an empty roster and loading false', () => {
    expect(store.members()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('sets loading true synchronously while the request is in flight', () => {
    apiSpy.listMembers.mockReturnValue({
      subscribe: () => {
        /* never resolves — proves the flag flips before any response arrives */
      },
    });

    store.loadMembers(10);

    expect(store.loading()).toBe(true);
  });

  it('loads the roster on success and clears the loading flag', () => {
    apiSpy.listMembers.mockReturnValue(of([member(1, 7), member(2, 8)]));

    store.loadMembers(10);

    expect(apiSpy.listMembers).toHaveBeenCalledWith(10);
    expect(store.members()).toHaveLength(2);
    expect(store.members()[1].userId).toBe(8);
    expect(store.loading()).toBe(false);
  });

  it('extracts the ProblemDetail detail message on failure and clears loading', () => {
    apiSpy.listMembers.mockReturnValue(
      throwError(() => ({ error: { detail: 'No se pudieron cargar los miembros: DB down' } })),
    );

    store.loadMembers(10);

    expect(store.error()).toBe('No se pudieron cargar los miembros: DB down');
    expect(store.members()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('falls back to a default error message when the ProblemDetail has no detail field', () => {
    apiSpy.listMembers.mockReturnValue(throwError(() => ({})));

    store.loadMembers(10);

    expect(store.error()).toBe('No se pudieron cargar los miembros');
  });

  it('loads the user directory into users()', () => {
    usersApiSpy.listUsers.mockReturnValue(of([user(7), user(8)]));

    store.loadUsers();

    expect(store.users()).toHaveLength(2);
    expect(store.users()[1].id).toBe(8);
  });

  it('appends the server-returned member to the roster on a successful add, without refetching', () => {
    const created = member(3, 9);
    apiSpy.addMember.mockReturnValue(of(created));

    store.addMember(10, 9, 'DEVELOPER');

    expect(apiSpy.addMember).toHaveBeenCalledWith(10, { userId: 9, role: 'DEVELOPER' });
    expect(apiSpy.listMembers).not.toHaveBeenCalled();
    expect(store.members()).toEqual([created]);
    expect(store.lastAdded()).toEqual(created);
    expect(store.adding()).toBe(false);
  });

  it('sets the error from the ProblemDetail on a 409 duplicate-member response without adding a row', () => {
    apiSpy.addMember.mockReturnValue(
      throwError(() => ({ error: { detail: 'El usuario ya es miembro del proyecto' } })),
    );

    store.addMember(10, 9, 'DEVELOPER');

    expect(store.error()).toBe('El usuario ya es miembro del proyecto');
    expect(store.members()).toEqual([]);
    expect(store.adding()).toBe(false);
  });

  it('sets the adding flag true synchronously while the add request is in flight', () => {
    apiSpy.addMember.mockReturnValue({
      subscribe: () => {
        /* never resolves — proves the flag flips before any response arrives */
      },
    });

    store.addMember(10, 9, 'DEVELOPER');

    expect(store.adding()).toBe(true);
  });
});
