import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { BoardApiService } from './board-api.service';
import { BoardColumn, WorkItem } from './board.model';

function item(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 500,
    projectId: 10,
    columnId: 1,
    title: 'Design schema',
    description: null,
    assignedUserId: null,
    position: 1024,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

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
    let result: WorkItem[] | undefined;

    service.getWorkItems(10).subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/projects/10/work-items');
    expect(req.request.method).toBe('GET');
    req.flush([item()]);

    expect(result).toHaveLength(1);
    expect(result?.[0].title).toBe('Design schema');
  });

  it('creates a work item in the project first column', () => {
    let result: WorkItem | undefined;

    service
      .createWorkItem(10, { title: 'Nueva tarea', description: 'Detalle', assignedUserId: 42 })
      .subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/projects/10/work-items');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Nueva tarea', description: 'Detalle', assignedUserId: 42 });
    req.flush(item({ title: 'Nueva tarea', assignedUserId: 42 }));

    expect(result?.title).toBe('Nueva tarea');
  });

  it('fetches one work item by id', () => {
    let result: WorkItem | undefined;

    service.getWorkItem(500).subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/work-items/500');
    expect(req.request.method).toBe('GET');
    req.flush(item());

    expect(result?.id).toBe(500);
  });

  it('updates a work item title description and assignee', () => {
    let result: WorkItem | undefined;

    service
      .updateWorkItem(500, { title: 'Editada', description: null, assignedUserId: null })
      .subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/work-items/500');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ title: 'Editada', description: null, assignedUserId: null });
    req.flush(item({ title: 'Editada' }));

    expect(result?.title).toBe('Editada');
  });

  it('deletes a work item by id', () => {
    let completed = false;

    service.deleteWorkItem(500).subscribe(() => (completed = true));

    const req = httpMock.expectOne('/api/work-items/500');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBe(true);
  });

  it('sends a move request with the target column and index', () => {
    let result: WorkItem | undefined;

    service.moveWorkItem(500, { columnId: 2, position: 1 }).subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/work-items/500/move');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ columnId: 2, position: 1 });
    req.flush(item({ columnId: 2, position: 2048 }));

    expect(result?.columnId).toBe(2);
    expect(result?.position).toBe(2048);
  });
});
