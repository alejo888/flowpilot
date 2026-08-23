import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpIconComponent } from '../../shared/ui/icon.component';
import { FpDialogComponent } from '../../shared/ui/dialog.component';
import { columnAccent } from './column-accent';
import { WorkItem, WorkItemCreateRequest, WorkItemUpdateRequest } from './board.model';
import { BoardStore } from './board.store';
import { CommentsStore } from '../comments/comments.store';

type WorkItemForm = {
  title: string;
  description: string;
  assignedUserId: number | null;
};

const emptyForm = (): WorkItemForm => ({ title: '', description: '', assignedUserId: null });

/**
 * Minimal kanban board (spec: kanban-board). Fetches a project's board
 * columns + work items via {@link BoardStore} and renders them grouped by
 * column, with CDK drag-and-drop between/within columns calling
 * `PUT /api/work-items/{id}/move` on drop. Routed at
 * `projects/:projectId/board` (see `app.routes.ts`).
 */
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    RouterLink,
        CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    FormsModule,
    DatePipe,
    FpButtonComponent,
        FpIconComponent,
    FpCardComponent,
    FpDialogComponent,
  ],
  template: `
    <div class="board" cdkDropListGroup>
      <header class="board-header"><a class="project-back-link" routerLink="/projects"><fp-icon name="arrow-left" /> Volver a proyectos</a>
        <div>
          <p class="eyebrow">Tablero Kanban</p>
          <h2>Trabajo del proyecto</h2>
        </div>
        <fp-button type="button" icon="add" (click)="startCreate()">Crear tarea</fp-button>
      </header>

      @if (error(); as message) {
        <p data-testid="board-error" class="board-error">{{ message }}</p>
      }

      @if (success(); as message) {
        <p data-testid="board-success" class="board-success" role="status">{{ message }}</p>
      }

      @if (showCreateForm()) {
        <form class="task-panel" data-testid="create-form" (ngSubmit)="submitCreate()">
          <h3>Nueva tarea</h3>
          <div class="form-grid">
            <label>
              Título
              <input name="create-title" required [(ngModel)]="createForm.title" />
            </label>
            <label>
              Usuario asignado (opcional)
              <input name="create-assignee" type="number" [(ngModel)]="createForm.assignedUserId" />
            </label>
            <label class="full-width">
              Descripción
              <textarea name="create-description" rows="3" [(ngModel)]="createForm.description"></textarea>
            </label>
          </div>
          <div class="panel-actions">
            <fp-button type="submit" icon="save" [disabled]="isMutating()">Guardar tarea</fp-button>
            <fp-button variant="secondary" icon="close" type="button" (click)="cancelCreate()">Cancelar</fp-button>
          </div>
        </form>
      }

      <div class="board-layout" data-testid="board-layout">
        <div class="board-column-tabs" role="tablist" aria-label="Columnas del tablero">
          @for (column of columns(); track column.id) {
            <button
              type="button"
              class="board-column-tab"
              data-testid="column-tab"
              role="tab"
              [attr.aria-selected]="column.id === activeColumnId()"
              [class.board-column-tab--active]="column.id === activeColumnId()"
              (click)="activeColumnId.set(column.id)"
            >
              {{ column.name }}
            </button>
          }
        </div>

        <div class="board-columns">
          @for (column of columns(); track column.id; let $i = $index) {
            <section
              class="board-column"
              [class.board-column--inactive-mobile]="column.id !== activeColumnId()"
              [style.--fp-column-accent]="columnAccent(column.name, $i)"
            >
              <h3 data-testid="column-name" class="board-column-name">{{ column.name }}</h3>
              <div
                class="board-column-list"
                cdkDropList
                [id]="'column-' + column.id"
                [cdkDropListData]="column.id"
                (cdkDropListDropped)="onDrop($event)"
              >
                @for (item of columnItems(column.id); track item.id) {
                  <fp-card class="board-card" cdkDrag [cdkDragData]="item">
                    <button class="card-title" type="button" (click)="openDetail(item)">
                      <span data-testid="work-item-title">{{ item.title }}</span>
                    </button>
                    @if (item.assignedUserId !== null) {
                      <span class="assignee">Asignado a {{ item.assignedUserName ?? '#' + item.assignedUserId }}</span>
                    }
                  </fp-card>
                }
              </div>
            </section>
          }
        </div>

        @if (selectedItem(); as item) {
          <div class="detail-backdrop" data-testid="detail-backdrop" (click)="closeDetail()"></div>
          <aside class="task-panel detail-panel" data-testid="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-panel-title" aria-describedby="detail-panel-description">
            <div class="detail-header">
              <div>
                <p class="eyebrow">Detalle</p>
                <h3 id="detail-panel-title">{{ item.title }}</h3>
                    <p id="detail-panel-description" class="sr-only">Editá los datos de la tarea o movela a otra columna.</p>
              </div>
              <fp-button
                variant="secondary"
                type="button"
                ariaLabel="Cerrar detalle"
                testId="detail-panel-close"
                (click)="closeDetail()"
                icon="close"></fp-button
              >
            </div>

            <label class="move-to-column">
              Columna
              <select
                data-testid="move-to-column-select"
                aria-label="Mover tarea a otra columna"
                (change)="onMoveToColumn(item, $any($event.target).value)"
              >
                @for (column of columns(); track column.id) {
                  <option [value]="column.id" [selected]="column.id === item.columnId">{{ column.name }}</option>
                }
              </select>
            </label>

            <section class="work-comments" aria-labelledby="work-comments-title"><h4 id="work-comments-title">Comentarios</h4>
              <form data-testid="work-comment-form" (ngSubmit)="submitWorkComment()"><label for="work-comment">Agregar comentario</label><textarea id="work-comment" rows="3" maxlength="4000" [(ngModel)]="commentDraft" name="work-comment" [disabled]="commentSubmitting()"></textarea><fp-button type="submit" icon="comment" [disabled]="commentSubmitting() || !commentDraft.trim()">Comentar</fp-button></form>
              @if (commentLoading()) { <p role="status" aria-live="polite">Cargando comentarios...</p> } @if (commentError(); as message) { <p class="board-error" role="alert">{{ message }}</p> } @for (comment of workComments(); track comment.id) { <article class="work-comment"><div class="comment-meta"><strong>{{ comment.authorName || 'Usuario' }}</strong><span>{{ comment.createdAt | date:'d MMM y, HH:mm' }}</span></div>@if (editingCommentId() === comment.id) { <textarea rows="3" aria-label="Editar comentario" [value]="editingContent()" (input)="editingContent.set($any($event.target).value)"></textarea><fp-button type="button" icon="save" ariaLabel="Guardar comentario" (click)="saveComment(comment.id)">Guardar comentario</fp-button> } @else { <p>{{ comment.content }}</p>@if (canEdit(comment)) { <div class="comment-actions"><fp-button type="button" variant="secondary" icon="edit" ariaLabel="Editar comentario" (click)="startEdit(comment)">Editar</fp-button><fp-button type="button" variant="danger" icon="delete" ariaLabel="Eliminar comentario" (click)="confirmDeleteComment(comment.id)">Eliminar</fp-button></div> } }</article> }
            </section>

            <form (ngSubmit)="submitUpdate(item.id)">
              <div class="form-grid stacked">
                <label>
                  Título
                  <input name="edit-title" required [(ngModel)]="editForm.title" />
                </label>
                <label>
                  Usuario asignado (opcional)
                  <input name="edit-assignee" type="number" [(ngModel)]="editForm.assignedUserId" />
                </label>
                <label>
                  Descripción
                  <textarea name="edit-description" rows="6" [(ngModel)]="editForm.description"></textarea>
                </label>
              </div>
              <div class="panel-actions wrap">
                <fp-button type="submit" icon="save" [disabled]="isMutating()">Guardar cambios</fp-button>
                <fp-button
                  variant="danger"
                  type="button"
                  icon="delete"
                   testId="detail-delete-button"
                  [disabled]="isMutating()"
                  (click)="confirmDelete(item)"
                >
                  Eliminar tarea
                </fp-button>
              </div>
            </form>
          </aside>
        }

        @if (deletingCommentId(); as commentId) {
          <fp-dialog
            data-testid="comment-delete-dialog"
            label="comment-delete-dialog-title"
            describedById="comment-delete-dialog-description"
            (closed)="cancelDeleteComment()"
          >
            <h3 id="comment-delete-dialog-title">Eliminar comentario</h3>
            <p id="comment-delete-dialog-description">¿Seguro que querés eliminar este comentario? Esta acción no se puede deshacer.</p>
            <div class="panel-actions">
              <fp-button variant="danger" icon="delete" type="button" (click)="deleteCommentConfirmed()">Sí, eliminar</fp-button>
              <fp-button variant="secondary" icon="close" type="button" (click)="cancelDeleteComment()">Cancelar</fp-button>
            </div>
          </fp-dialog>
        }

        @if (deleteCandidate(); as itemToDelete) {
          <fp-dialog
            data-testid="delete-dialog"
            label="delete-dialog-title"
            describedById="delete-dialog-description"
            (closed)="cancelDelete()"
          >
            <h3 id="delete-dialog-title">Eliminar tarea</h3>
            <p id="delete-dialog-description">¿Seguro que querés eliminar la tarea "{{ itemToDelete.title }}"? Esta acción no se puede deshacer.</p>
            <div class="panel-actions">
              <fp-button variant="danger" icon="delete" type="button" (click)="deleteConfirmed()">Sí, eliminar</fp-button>
              <fp-button variant="secondary" icon="close" type="button" (click)="cancelDelete()">Cancelar</fp-button>
            </div>
          </fp-dialog>
        }
      </div>
    </div>
  `,
  styleUrl: './board.component.scss',
})
export class BoardComponent {
  private readonly store = inject(BoardStore);

  readonly projectId = input.required<number, number | string>({ transform: numberAttribute });

  readonly columns = this.store.columns;
  readonly selectedItem = this.store.selectedItem;
  readonly error = this.store.error;
  readonly success = this.store.success;
  readonly isMutating = this.store.isMutating;
  readonly itemsByColumn = computed(() => this.store.itemsByColumn());
  readonly showCreateForm = signal(false);
      readonly deleteCandidate = signal<WorkItem | null>(null);
      private readonly commentsStore = inject(CommentsStore, { optional: true });
      readonly workComments = computed(() => this.commentsStore?.workItemComments() ?? []);
      readonly commentLoading = computed(() => this.commentsStore?.workItemLoading() ?? false);
      readonly commentSubmitting = computed(() => this.commentsStore?.submitting() ?? false);
      readonly commentError = computed(() => this.commentsStore?.error() ?? null);
      readonly editingCommentId = signal<number | null>(null); readonly editingContent = signal(''); commentDraft = '';
      readonly deletingCommentId = signal<number | null>(null);

  /** Which column the mobile single-column view shows; desktop ignores this. */
  readonly activeColumnId = signal<number | null>(null);

  /** Bound in the template to set each column's `--fp-column-accent`. */
  protected readonly columnAccent = columnAccent;

  createForm = emptyForm();
  editForm = emptyForm();

  constructor() {
    effect(() => {
      this.store.load(this.projectId());
    });

    effect(() => {
      const item = this.selectedItem();
      if (item) {
        this.editForm = formFromItem(item);
      }
    });

    effect(() => {
      const columns = this.columns();
      const stillExists = columns.some((column) => column.id === this.activeColumnId());
      if (!stillExists) {
        this.activeColumnId.set(columns[0]?.id ?? null);
      }
    });
  }

  columnItems(columnId: number): WorkItem[] {
    return this.itemsByColumn()[columnId] ?? [];
  }

  startCreate(): void {
    this.store.clearSuccess();
    this.createForm = emptyForm();
    this.showCreateForm.set(true);
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
  }

  submitCreate(): void {
    const request = requestFromForm(this.createForm);
    if (!request) {
      return;
    }
    this.store.createItem(this.projectId(), request);
    this.showCreateForm.set(false);
  }

  openDetail(item: WorkItem): void {
    this.store.selectItem(item);
    this.store.loadItem(item.id);
    this.commentsStore?.loadWorkItem(item.id);
  }

  closeDetail(): void {
    this.store.selectItem(null);
  }

  submitWorkComment(): void { const content=this.commentDraft.trim(); const item=this.selectedItem(); if(content && item && this.commentsStore){this.commentsStore.createWorkItem(item.id,content);this.commentDraft='';} }
  canEdit(comment: import('../comments/comments.model').Comment): boolean { const id=this.commentsStore?.currentUserId(); return id!==null && id!==undefined && comment.authorId===id; }
  startEdit(comment: import('../comments/comments.model').Comment): void { this.editingCommentId.set(comment.id); this.editingContent.set(comment.content); }
  saveComment(id:number): void { const content=this.editingContent().trim(); if(content && this.commentsStore){this.commentsStore.update(id,content,'workItem');this.editingCommentId.set(null);} }
  confirmDeleteComment(id: number): void { this.deletingCommentId.set(id); }
  cancelDeleteComment(): void { this.deletingCommentId.set(null); }
  deleteCommentConfirmed(): void { const id = this.deletingCommentId(); if (id === null || !this.commentsStore) return; this.commentsStore.delete(id, 'workItem'); this.deletingCommentId.set(null); }

  submitUpdate(itemId: number): void {
    const request = requestFromForm(this.editForm);
    if (!request) {
      return;
    }
    this.store.updateItem(itemId, request);
  }

  confirmDelete(item: WorkItem): void {
        this.deleteCandidate.set(item);
      }

      deleteConfirmed(): void {
        const item = this.deleteCandidate();
        if (!item) return;
        this.deleteCandidate.set(null);
        this.store.deleteItem(item.id);
      }

      cancelDelete(): void {
        this.deleteCandidate.set(null);
      }

      onDrop(event: CdkDragDrop<number, number, WorkItem>): void {
    const movedItem = event.item.data;
    const targetColumnId = event.container.data;
    this.store.moveItem(movedItem.id, targetColumnId, event.currentIndex);
  }

  onMoveToColumn(item: WorkItem, columnId: string): void {
    this.store.moveItem(item.id, Number(columnId), item.position);
  }
}

function formFromItem(item: WorkItem): WorkItemForm {
  return {
    title: item.title,
    description: item.description ?? '',
    assignedUserId: item.assignedUserId,
  };
}

function requestFromForm(form: WorkItemForm): WorkItemCreateRequest | WorkItemUpdateRequest | null {
  const title = form.title.trim();
  if (!title) {
    return null;
  }

  const rawAssignee = form.assignedUserId as number | string | null | undefined;
  const assignedUserId = Number(rawAssignee);

  return {
    title,
    description: form.description.trim() || null,
    assignedUserId:
      rawAssignee === null || rawAssignee === undefined || rawAssignee === '' || Number.isNaN(assignedUserId)
        ? null
        : assignedUserId,
  };
}
