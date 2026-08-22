import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { WorkItem } from '../board/board.model';
import { BacklogApiService } from './backlog-api.service';
import { Sprint } from './backlog.model';

function sprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 7,
    projectId: 10,
    name: 'Sprint 1',
    goal: 'First slice',
    startDate: '2026-01-01',
    endDate: '2026-01-14',
    status: 'PLANNED',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function item(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 20,
    projectId: 10,
    columnId: 1,
    title: 'Task',
    description: null,
    assignedUserId: null,
    assignedUserName: null,
    position: 1024,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('BacklogApiService', () => {
  let service: BacklogApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BacklogApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BacklogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('gets work items and sprints for a project', () => {
    service.getWorkItems(10).subscribe();
    service.listSprints(10).subscribe();

    const itemsRequest = httpMock.expectOne('/api/projects/10/work-items');
    expect(itemsRequest.request.method).toBe('GET');
    itemsRequest.flush([item()]);
    const sprintsRequest = httpMock.expectOne('/api/projects/10/sprints');
    expect(sprintsRequest.request.method).toBe('GET');
    sprintsRequest.flush([sprint()]);
  });

  it('sends sprint create and update payloads', () => {
    const request = {
      name: 'New sprint',
      goal: null,
      startDate: '2026-02-01',
      endDate: '2026-02-14',
    };

    service.createSprint(10, request).subscribe();
    const create = httpMock.expectOne('/api/projects/10/sprints');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(request);
    create.flush(sprint(request));

    service.updateSprint(7, request).subscribe();
    const update = httpMock.expectOne('/api/sprints/7');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(request);
    update.flush(sprint(request));
  });

  it('starts and completes a sprint with empty POST bodies', () => {
    service.startSprint(7).subscribe();
    const start = httpMock.expectOne('/api/sprints/7/start');
    expect(start.request.method).toBe('POST');
    expect(start.request.body).toEqual({});
    start.flush(sprint({ status: 'ACTIVE' }));

    service.completeSprint(7).subscribe();
    const complete = httpMock.expectOne('/api/sprints/7/complete');
    expect(complete.request.method).toBe('POST');
    expect(complete.request.body).toEqual({});
    complete.flush(sprint({ status: 'COMPLETED' }));
  });

  it('updates a work item with its complete assignment and sprint payload', () => {
    const request = {
      title: 'Assigned task',
      description: 'Details',
      assignedUserId: 42,
      sprintId: null,
    };

    service.updateWorkItemSprint(20, request).subscribe();

    const update = httpMock.expectOne('/api/work-items/20');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(request);
    update.flush(item(request));
  });
});
