import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Comment } from '../comments/comments.model';
import { CommentsStore } from '../comments/comments.store';
import { WorkItemCommentsComponent } from './work-item-comments.component';

function comment(id: number, authorId: number, content: string): Comment {
  return {
    id,
    projectId: 10,
    workItemId: 500,
    authorId,
    authorName: 'Ana',
    content,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('WorkItemCommentsComponent', () => {
  let fixture: ComponentFixture<WorkItemCommentsComponent>;
  let commentsStub: {
    workItemComments: ReturnType<typeof signal<Comment[]>>;
    workItemLoading: ReturnType<typeof signal<boolean>>;
    submitting: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    currentUserId: ReturnType<typeof signal<number | null>>;
    loadWorkItem: ReturnType<typeof vi.fn>;
    createWorkItem: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    commentsStub = {
      workItemComments: signal<Comment[]>([]),
      workItemLoading: signal(false),
      submitting: signal(false),
      error: signal<string | null>(null),
      currentUserId: signal<number | null>(4),
      loadWorkItem: vi.fn(),
      createWorkItem: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [WorkItemCommentsComponent],
      providers: [{ provide: CommentsStore, useValue: commentsStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkItemCommentsComponent);
    fixture.componentRef.setInput('workItemId', 500);
    fixture.componentRef.setInput('canComment', true);
    fixture.detectChanges();
  });

  it('keeps the draft when creating a work-item comment fails and clears it on success', async () => {
    commentsStub.createWorkItem.mockResolvedValueOnce(false);
    fixture.componentInstance.commentDraft = '  Texto importante ';

    await fixture.componentInstance.submitWorkComment();

    expect(commentsStub.createWorkItem).toHaveBeenCalledWith(500, 'Texto importante');
    expect(fixture.componentInstance.commentDraft).toBe('  Texto importante ');

    commentsStub.createWorkItem.mockResolvedValueOnce(true);
    await fixture.componentInstance.submitWorkComment();

    expect(fixture.componentInstance.commentDraft).toBe('');
  });

  it('stays in edit mode when saving a work-item comment fails and exits on success', async () => {
    commentsStub.update.mockResolvedValueOnce(false);
    fixture.componentInstance.editingCommentId.set(7);
    fixture.componentInstance.editingContent.set('Corregido');

    await fixture.componentInstance.saveComment(7);

    expect(commentsStub.update).toHaveBeenCalledWith(7, 'Corregido', 'workItem');
    expect(fixture.componentInstance.editingCommentId()).toBe(7);

    commentsStub.update.mockResolvedValueOnce(true);
    await fixture.componentInstance.saveComment(7);

    expect(fixture.componentInstance.editingCommentId()).toBeNull();
  });

  it('keeps the delete confirmation open when deleting a work-item comment fails and closes it on success', async () => {
    commentsStub.delete.mockResolvedValueOnce(false);
    fixture.componentInstance.deletingCommentId.set(7);

    await fixture.componentInstance.deleteCommentConfirmed();

    expect(commentsStub.delete).toHaveBeenCalledWith(7, 'workItem');
    expect(fixture.componentInstance.deletingCommentId()).toBe(7);

    commentsStub.delete.mockResolvedValueOnce(true);
    await fixture.componentInstance.deleteCommentConfirmed();

    expect(fixture.componentInstance.deletingCommentId()).toBeNull();
  });

  it('shows the failure reason inside the still-open comment delete dialog, not behind its backdrop', async () => {
    commentsStub.delete.mockImplementationOnce(async () => {
      commentsStub.error.set('No se pudo eliminar el comentario');
      return false;
    });
    fixture.componentInstance.deletingCommentId.set(7);
    fixture.detectChanges();

    await fixture.componentInstance.deleteCommentConfirmed();
    fixture.detectChanges();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="comment-delete-dialog"]');
    expect(dialog).not.toBeNull();
    const panel = dialog?.querySelector('.fp-dialog__panel');
    const alert = panel?.querySelector('[data-testid="comment-delete-dialog-error"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('No se pudo eliminar el comentario');
    // The section-level copy is suppressed while the dialog is open so the
    // same message is not announced twice by two `role="alert"` nodes.
    const sectionAlerts = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.work-comments [role="alert"]'),
    );
    expect(sectionAlerts).toHaveLength(0);
  });

  it('offers edit/delete only on the current user\'s own comments', () => {
    commentsStub.workItemComments.set([comment(1, 4, 'Mío'), comment(2, 9, 'Ajeno')]);
    fixture.detectChanges();

    const articles = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('article.work-comment'));
    expect(articles).toHaveLength(2);
    expect(articles[0].querySelector('.comment-actions')).not.toBeNull();
    expect(articles[1].querySelector('.comment-actions')).toBeNull();
  });

  it('disables the create button while the caller lacks COMMENT_CREATE', () => {
    fixture.componentInstance.commentDraft = 'Hola';
    fixture.componentRef.setInput('canComment', false);
    fixture.detectChanges();

    const submit = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="work-comment-form"] button[type="submit"]',
    );
    expect(submit?.disabled).toBe(true);
  });
});
