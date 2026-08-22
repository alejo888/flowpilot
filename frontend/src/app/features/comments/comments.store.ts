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
    forkJoin({ comments: this.api.listProject(projectId, { limit: 20, offset: 0 }), activity: this.api.listActivity(projectId, { limit: 20, offset: 0 }) }).subscribe({
      next: ({ comments, activity }) => { if (requestId !== this.projectRequest) return; this.projectComments.set(comments); this.activity.set(activity); this.loading.set(false); },
      error: (err: unknown) => { if (requestId !== this.projectRequest) return; this.error.set(errorMessage(err, 'No se pudieron cargar los comentarios y la actividad')); this.loading.set(false); },
    });
  }

  loadWorkItem(workItemId: number): void {
    const requestId = ++this.workItemRequest;
    this.workItemLoading.set(true); this.error.set(null);
    this.api.listWorkItem(workItemId, { limit: 20, offset: 0 }).subscribe({
      next: comments => { if (requestId !== this.workItemRequest) return; this.workItemComments.set(comments); this.workItemLoading.set(false); },
      error: err => { if (requestId !== this.workItemRequest) return; this.error.set(errorMessage(err, 'No se pudieron cargar los comentarios')); this.workItemLoading.set(false); },
    });
  }

  createProject(projectId: number, content: string): void { this.submit(this.api.createProject(projectId, { content }), this.projectComments); }
  createWorkItem(workItemId: number, content: string): void { this.submit(this.api.createWorkItem(workItemId, { content }), this.workItemComments); }
  update(commentId: number, content: string, target: 'project' | 'workItem'): void {
    this.submit(this.api.update(commentId, { content }), target === 'project' ? this.projectComments : this.workItemComments);
  }

  private submit(request: ReturnType<CommentsApiService['createProject']>, target: typeof this.projectComments): void {
    const previous = target(); this.submitting.set(true); this.error.set(null);
    request.subscribe({ next: comment => { target.set([comment, ...previous.filter(item => item.id !== comment.id)]); this.submitting.set(false); }, error: err => { this.error.set(errorMessage(err, 'No se pudo guardar el comentario')); this.submitting.set(false); } });
  }
}

function errorMessage(err: unknown, fallback: string): string { return (err as { error?: { detail?: string } })?.error?.detail ?? fallback; }
