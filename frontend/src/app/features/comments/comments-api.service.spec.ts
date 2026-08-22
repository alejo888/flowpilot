import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CommentsApiService } from './comments-api.service';

describe('CommentsApiService', () => {
  let service: CommentsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CommentsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommentsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('uses comment and activity URLs with pagination parameters', () => {
    service.listProject(10, { limit: 20, offset: 4 }).subscribe();
    const list = httpMock.expectOne('/api/projects/10/comments?limit=20&offset=4');
    expect(list.request.method).toBe('GET');
    list.flush([]);

    service.listWorkItem(50).subscribe();
    const work = httpMock.expectOne('/api/work-items/50/comments');
    expect(work.request.method).toBe('GET');
    work.flush([]);

    service.listActivity(10).subscribe();
    const activity = httpMock.expectOne('/api/projects/10/activity');
    expect(activity.request.method).toBe('GET');
    activity.flush([]);
  });

  it('sends project/work-item create and update payloads', () => {
    const request = { content: 'A useful note' };
    service.createProject(10, request).subscribe();
    const project = httpMock.expectOne('/api/projects/10/comments');
    expect(project.request.method).toBe('POST');
    expect(project.request.body).toEqual(request);
    project.flush({});

    service.createWorkItem(50, request).subscribe();
    const work = httpMock.expectOne('/api/work-items/50/comments');
    expect(work.request.method).toBe('POST');
    expect(work.request.body).toEqual(request);
    work.flush({});

    service.update(7, request).subscribe();
    const update = httpMock.expectOne('/api/comments/7');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(request);
    update.flush({});
  });
});
