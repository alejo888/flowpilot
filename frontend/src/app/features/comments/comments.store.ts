import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CommentsApiService } from './comments-api.service';
import { ActivityEvent, Comment } from './comments.model';

@Injectable({ providedIn: 'root' })
export class CommentsStore {
  private readonly api = inject(CommentsApiService);
  private readonly auth = inject(AuthStore, { optional: true });
  readonly projectComments = signal<Comment[]>([]);
  readonly workItemComments = signal<Comment[]>([]);
  readonly activity = signal<ActivityEvent[]>([]);
  readonly loading = signal(false);
  readonly workItemLoading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly currentUserId = this.auth?.currentUserId ?? signal<number | null>(null);
  private projectRequest = 0;
  private workItemRequest = 0;

  loadProject(projectId: number): void {
    const requestId = ++this.projectRequest;
    this.loading.set(true); this.error.set(null);
    this.projectComments.set([]); this.activity.set([]);
    forkJoin({ comments: this.api.listProject(projectId, { limit: 20, offset: 0 }), activity: this.api.listActivity(projectId, { limit: 20, offset: 0 }) }).subscribe({
      next: ({ comments, activity }) => { if (requestId !== this.projectRequest) return; this.projectComments.set(comments); this.activity.set(activity); this.loading.set(false); },
      error: (err: unknown) => { if (requestId !== this.projectRequest) return; this.error.set(errorMessage(err, 'No se pudieron cargar los comentarios y la actividad')); this.loading.set(false); },
    });
  }

  loadWorkItem(workItemId: number): void {
    const requestId = ++this.workItemRequest;
    this.workItemLoading.set(true); this.error.set(null);
    this.workItemComments.set([]);
    this.api.listWorkItem(workItemId, { limit: 20, offset: 0 }).subscribe({
      next: comments => { if (requestId !== this.workItemRequest) return; this.workItemComments.set(comments); this.workItemLoading.set(false); },
      error: err => { if (requestId !== this.workItemRequest) return; this.error.set(errorMessage(err, 'No se pudieron cargar los comentarios')); this.workItemLoading.set(false); },
    });
  }

  createProject(projectId: number, content: string): Promise<boolean> { return this.submit(this.api.createProject(projectId, { content }), this.projectComments, 'prepend'); }
  createWorkItem(workItemId: number, content: string): Promise<boolean> { return this.submit(this.api.createWorkItem(workItemId, { content }), this.workItemComments, 'prepend'); }
  /**
   * Unlike create, an edited comment must keep its original position in the
   * list (backend order is `createdAt DESC, id DESC` and `createdAt` doesn't
   * change on edit) rather than jump to the front.
   */
  update(commentId: number, content: string, target: 'project' | 'workItem'): Promise<boolean> {
    return this.submit(this.api.update(commentId, { content }), target === 'project' ? this.projectComments : this.workItemComments, 'replace');
  }
  delete(commentId: number, target: 'project' | 'workItem'): Promise<boolean> {
    const list = target === 'project' ? this.projectComments : this.workItemComments;
    const previous = list(); this.submitting.set(true); this.error.set(null);
    return new Promise(resolve => this.api.delete(commentId).subscribe({
      next: () => { list.set(previous.filter(item => item.id !== commentId)); this.submitting.set(false); resolve(true); },
      error: err => { this.error.set(errorMessage(err, 'No se pudo eliminar el comentario')); this.submitting.set(false); resolve(false); },
    }));
  }

  /**
   * Resolves `true` only once the server confirmed the write, so callers can
   * keep their local UI state (draft text, edit mode) on failure instead of
   * discarding what the user typed.
   *
   * `mode` controls where the returned comment lands in `target`: 'prepend'
   * (create) puts it at the front, matching backend order (`createdAt DESC`)
   * for a brand-new comment; 'replace' (update) swaps it in at its existing
   * array position so editing an older comment doesn't reorder the list.
   */
  private submit(request: ReturnType<CommentsApiService['createProject']>, target: typeof this.projectComments, mode: 'prepend' | 'replace'): Promise<boolean> {
    const previous = target(); this.submitting.set(true); this.error.set(null);
    return new Promise(resolve => request.subscribe({
      next: comment => {
        target.set(
          mode === 'prepend'
            ? [comment, ...previous.filter(item => item.id !== comment.id)]
            : previous.map(item => (item.id === comment.id ? comment : item)),
        );
        this.submitting.set(false); resolve(true);
      },
      error: err => { this.error.set(errorMessage(err, 'No se pudo guardar el comentario')); this.submitting.set(false); resolve(false); },
    }));
  }
}

function errorMessage(err: unknown, fallback: string): string { return (err as { error?: { detail?: string } })?.error?.detail ?? fallback; }
