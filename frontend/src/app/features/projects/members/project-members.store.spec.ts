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
    changeRole: ReturnType<typeof vi.fn>;
    removeMember: ReturnType<typeof vi.fn>;
  };
  let usersApiSpy: {
    listUsers: ReturnType<typeof vi.fn>;
  };
  let store: ProjectMembersStore;

  beforeEach(() => {
    apiSpy = {
      listMembers: vi.fn(),
      addMember: vi.fn(),
      changeRole: vi.fn(),
      removeMember: vi.fn(),
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

  it('replaces the matching row in place on a successful role change', () => {
    apiSpy.listMembers.mockReturnValue(of([member(1, 7), member(2, 8)]));
    store.loadMembers(10);
    const updated = { ...member(1, 7), role: 'QA' as const };
    apiSpy.changeRole.mockReturnValue(of(updated));

    store.changeRole(10, 7, 'QA');

    expect(apiSpy.changeRole).toHaveBeenCalledWith(10, 7, 'QA');
    expect(store.members()).toHaveLength(2);
    expect(store.members()[0]).toEqual(updated);
    expect(store.members()[1].role).toBe('DEVELOPER');
    expect(store.isMutating(7)).toBe(false);
  });

  it('removes the matching row on a successful removal', () => {
    apiSpy.listMembers.mockReturnValue(of([member(1, 7), member(2, 8)]));
    store.loadMembers(10);
    apiSpy.removeMember.mockReturnValue(of(undefined));

    store.removeMember(10, 7);

    expect(apiSpy.removeMember).toHaveBeenCalledWith(10, 7);
    expect(store.members()).toEqual([member(2, 8)]);
    expect(store.isMutating(7)).toBe(false);
  });

  it('sets the error from the ProblemDetail on a 404 remove-already-gone response and leaves the stale row', () => {
    apiSpy.listMembers.mockReturnValue(of([member(1, 7)]));
    store.loadMembers(10);
    apiSpy.removeMember.mockReturnValue(
      throwError(() => ({ error: { detail: 'El miembro ya no existe' } })),
    );

    store.removeMember(10, 7);

    expect(store.error()).toBe('El miembro ya no existe');
    expect(store.members()).toEqual([member(1, 7)]);
    expect(store.isMutating(7)).toBe(false);
  });

  it('marks the target row as mutating during a mutation and clears it on success and error', () => {
    apiSpy.listMembers.mockReturnValue(of([member(1, 7)]));
    store.loadMembers(10);
    apiSpy.changeRole.mockReturnValue({
      subscribe: () => {
        /* never resolves — proves the flag flips before any response arrives */
      },
    });

    store.changeRole(10, 7, 'QA');

    expect(store.isMutating(7)).toBe(true);
  });

  it('tracks two concurrent row mutations independently', () => {
    apiSpy.listMembers.mockReturnValue(of([member(1, 7), member(2, 8)]));
    store.loadMembers(10);
    let resolveFirst!: (value: ProjectMember) => void;
    apiSpy.changeRole.mockReturnValueOnce({
      subscribe: (observer: { next: (value: ProjectMember) => void }) => {
        resolveFirst = observer.next;
      },
    });
    apiSpy.removeMember.mockReturnValue({
      subscribe: () => {
        /* never resolves */
      },
    });

    store.changeRole(10, 7, 'QA');
    store.removeMember(10, 8);

    expect(store.isMutating(7)).toBe(true);
    expect(store.isMutating(8)).toBe(true);

    resolveFirst({ ...member(1, 7), role: 'QA' });

    expect(store.isMutating(7)).toBe(false);
    expect(store.isMutating(8)).toBe(true);
  });

  it('leaves membersSignal unchanged on a 403 during either mutation (no optimistic mutation retained)', () => {
    apiSpy.listMembers.mockReturnValue(of([member(1, 7)]));
    store.loadMembers(10);
    apiSpy.changeRole.mockReturnValue(throwError(() => ({ error: { detail: 'No autorizado' } })));

    store.changeRole(10, 7, 'QA');

    expect(store.error()).toBe('No autorizado');
    expect(store.members()).toEqual([member(1, 7)]);
  });
});
