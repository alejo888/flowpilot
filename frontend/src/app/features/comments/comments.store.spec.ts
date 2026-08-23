import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CommentsApiService } from './comments-api.service';
import { Comment, ActivityEvent } from './comments.model';
import { CommentsStore } from './comments.store';

function comment(id: number, content = `Comment ${id}`): Comment {
  return { id, projectId: 10, workItemId: null, authorId: 4, authorName: 'Ada', content,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
}
function event(id: number): ActivityEvent {
  return { id, projectId: 10, actorId: 4, eventType: 'COMMENT_CREATED', displayText: 'Comment created', payload: '{}', createdAt: '2026-01-01T00:00:00Z' };
}

describe('CommentsStore', () => {
  let api: {
    listProject: ReturnType<typeof vi.fn>; listActivity: ReturnType<typeof vi.fn>; listWorkItem: ReturnType<typeof vi.fn>;
    createProject: ReturnType<typeof vi.fn>; createWorkItem: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let store: CommentsStore;

  beforeEach(() => {
    api = { listProject: vi.fn(), listActivity: vi.fn(), listWorkItem: vi.fn(), createProject: vi.fn(), createWorkItem: vi.fn(), update: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({ providers: [CommentsStore, { provide: CommentsApiService, useValue: api }] });
    store = TestBed.inject(CommentsStore);
  });

  it('loads project comments and activity together', () => {
    api.listProject.mockReturnValue(of([comment(1)]));
    api.listActivity.mockReturnValue(of([event(1)]));
    store.loadProject(10);
    expect(api.listProject).toHaveBeenCalledWith(10, { limit: 20, offset: 0 });
    expect(store.projectComments()).toEqual([comment(1)]);
    expect(store.activity()).toEqual([event(1)]);
    expect(store.loading()).toBe(false);
  });

  it('loads work-item comments and exposes errors', () => {
    api.listWorkItem.mockReturnValue(throwError(() => ({ error: { detail: 'Forbidden' } })));
    store.loadWorkItem(50);
    expect(api.listWorkItem).toHaveBeenCalledWith(50, { limit: 20, offset: 0 });
    expect(store.error()).toBe('Forbidden');
    expect(store.workItemLoading()).toBe(false);
  });

  it('creates and updates comments at the front of the selected collection', () => {
    const first = comment(1);
    const created = comment(2, 'Created');
    api.createProject.mockReturnValue(of(created));
    api.update.mockReturnValue(of(comment(1, 'Updated')));
    store.projectComments.set([first]);
    store.createProject(10, 'Created');
    expect(api.createProject).toHaveBeenCalledWith(10, { content: 'Created' });
    expect(store.projectComments()).toEqual([created, first]);
    store.update(1, 'Updated', 'project');
    expect(api.update).toHaveBeenCalledWith(1, { content: 'Updated' });
    expect(store.projectComments()).toEqual([comment(1, 'Updated'), created]);
    expect(store.submitting()).toBe(false);
  });

  it('removes a deleted comment from the selected collection', () => {
    const first = comment(1);
    const second = comment(2);
    api.delete.mockReturnValue(of(undefined));
    store.projectComments.set([first, second]);
    store.delete(1, 'project');
    expect(api.delete).toHaveBeenCalledWith(1);
    expect(store.projectComments()).toEqual([second]);
    expect(store.submitting()).toBe(false);
  });

  it('surfaces the delete error without removing the comment', () => {
    const first = comment(1);
    api.delete.mockReturnValue(throwError(() => ({ error: { detail: 'Solo el autor puede eliminarlo' } })));
    store.projectComments.set([first]);
    store.delete(1, 'project');
    expect(store.error()).toBe('Solo el autor puede eliminarlo');
    expect(store.projectComments()).toEqual([first]);
  });
});
