import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { BoardApiService } from './board-api.service';
import { BoardColumn, WorkItem } from './board.model';

describe('BoardApiService', () => {
  let service: BoardApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BoardApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BoardApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches board columns for a project ordered by position', () => {
    const columns: BoardColumn[] = [
      { id: 1, name: 'Por hacer', position: 1024 },
      { id: 2, name: 'En progreso', position: 2048 },
    ];
    let result: BoardColumn[] | undefined;

    service.getBoardColumns(10).subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/projects/10/board-columns');
    expect(req.request.method).toBe('GET');
    req.flush(columns);

    expect(result).toEqual(columns);
  });

  it('fetches work items for a project', () => {
    const items: WorkItem[] = [
      {
        id: 500,
        projectId: 10,
        columnId: 1,
        title: 'Design schema',
        description: null,
        assignedUserId: null,
        position: 1024,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    let result: WorkItem[] | undefined;

    service.getWorkItems(10).subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/projects/10/work-items');
    expect(req.request.method).toBe('GET');
    req.flush(items);

    expect(result).toHaveLength(1);
    expect(result?.[0].title).toBe('Design schema');
  });

  it('sends a move request with the target column and index', () => {
    const moved: WorkItem = {
      id: 500,
      projectId: 10,
      columnId: 2,
      title: 'Design schema',
      description: null,
      assignedUserId: null,
      position: 2048,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    let result: WorkItem | undefined;

    service.moveWorkItem(500, { columnId: 2, position: 1 }).subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/work-items/500/move');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ columnId: 2, position: 1 });
    req.flush(moved);

    expect(result?.columnId).toBe(2);
    expect(result?.position).toBe(2048);
  });
});
