import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ProjectMember } from './project-member.model';
import { ProjectMembersApiService } from './project-members-api.service';
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

describe('ProjectMembersStore', () => {
  let apiSpy: {
    listMembers: ReturnType<typeof vi.fn>;
  };
  let store: ProjectMembersStore;

  beforeEach(() => {
    apiSpy = {
      listMembers: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [ProjectMembersStore, { provide: ProjectMembersApiService, useValue: apiSpy }],
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
});
