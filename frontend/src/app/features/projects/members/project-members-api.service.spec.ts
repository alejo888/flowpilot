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
});
