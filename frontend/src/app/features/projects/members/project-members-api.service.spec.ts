import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ProjectMember } from './project-member.model';
import { ProjectMembersApiService } from './project-members-api.service';

function member(id: number, userId: number): ProjectMember {
  return {
    id,
    projectId: 10,
    userId,
    role: 'DEVELOPER',
    joinedAt: '2026-08-01T00:00:00Z',
  };
}

describe('ProjectMembersApiService', () => {
  let service: ProjectMembersApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectMembersApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProjectMembersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the roster for a project', () => {
    const members: ProjectMember[] = [member(1, 7), member(2, 8)];
    let result: ProjectMember[] | undefined;

    service.listMembers(10).subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/projects/10/members');
    expect(req.request.method).toBe('GET');
    req.flush(members);

    expect(result).toEqual(members);
  });

  it('sends an add-member request', () => {
    const created = member(3, 9);
    let result: ProjectMember | undefined;

    service.addMember(10, { userId: 9, role: 'DEVELOPER' }).subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/projects/10/members');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 9, role: 'DEVELOPER' });
    req.flush(created);

    expect(result).toEqual(created);
  });

  it('sends a change-role request', () => {
    const updated = { ...member(1, 7), role: 'QA' as const };
    let result: ProjectMember | undefined;

    service.changeRole(10, 7, 'QA').subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/projects/10/members/7');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ role: 'QA' });
    req.flush(updated);

    expect(result).toEqual(updated);
  });

  it('sends a remove-member request', () => {
    let completed = false;

    service.removeMember(10, 7).subscribe(() => (completed = true));

    const req = httpMock.expectOne('/api/projects/10/members/7');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
