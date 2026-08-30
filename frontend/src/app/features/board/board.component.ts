import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FpBadgeComponent } from '../../shared/ui/badge.component';
import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpIconComponent } from '../../shared/ui/icon.component';
import { FpDialogComponent } from '../../shared/ui/dialog.component';
import { columnAccent } from './column-accent';
import { WorkItem, WorkItemCreateRequest, WorkItemPriority, WorkItemUpdateRequest } from './board.model';
import { BoardStore } from './board.store';
import { CommentsStore } from '../comments/comments.store';
import { hasPermission } from '../projects/project.model';
import { ProjectsStore } from '../projects/projects.store';

type WorkItemForm = {
  title: string;
  description: string;
  assignedUserId: number | null;
  /**
   * Not edited in this screen (sprint assignment lives in the backlog screen),
   * but round-tripped so a board edit never drops the item's current sprint:
   * `PUT /api/work-items/{id}` treats an omitted `sprintId` as an explicit
   * "move to backlog" (that null IS the backlog screen's unassign contract).
   */
  sprintId?: number | null;
  /**
   * Not edited in this screen (no priority UI here yet), but round-tripped
   * the same way as `sprintId` above so submitting the edit form never wipes
   * the item's current priority back to the backend default.
   */
  priority?: WorkItemPriority | null;
  /**
   * The item's parent work item (single-level hierarchy). Edited by the
   * detail panel's parent `<select>` and round-tripped like `sprintId`
   * above so a board edit never silently clears an existing parent link
   * (`PUT /api/work-items/{id}` treats an omitted `parentWorkItemId` as an
   * explicit clear).
   */
  parentWorkItemId?: number | null;
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
    FpBadgeComponent,
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
        <fp-button type="button" icon="add" [disabled]="!canCreateWorkItem()" (click)="startCreate()">Crear tarea</fp-button>
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
            <fp-button type="submit" icon="save" [disabled]="isMutating() || !canCreateWorkItem()">Guardar tarea</fp-button>
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
                  <fp-card class="board-card" cdkDrag [cdkDragData]="item" [cdkDragDisabled]="!canMoveWorkItem()">
                    <button class="card-title" type="button" (click)="openDetail(item)">
                      <span data-testid="work-item-title">{{ item.title }}</span>
                    </button>
                    @if (item.assignedUserId !== null) {
                      <span class="assignee">Asignado a {{ item.assignedUserName ?? '#' + item.assignedUserId }}</span>
                    }
                    @if (item.parentWorkItemTitle) {
                      <span class="assignee">↳ historia: {{ item.parentWorkItemTitle }}</span>
                    }
                    @if (item.childCount) {
                      <fp-badge data-testid="child-count-badge">
                        {{ item.childCount }} {{ item.childCount === 1 ? 'subtarea' : 'subtareas' }}
                      </fp-badge>
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

            @if (item.parentWorkItemTitle) {
              <p data-testid="detail-parent" class="assignee">Tarea padre: {{ item.parentWorkItemTitle }}</p>
            }
            @if (item.childCount) {
              <p data-testid="detail-child-count" class="assignee">
                {{ item.childCount }} {{ item.childCount === 1 ? 'subtarea' : 'subtareas' }}
              </p>
            }

            <label class="move-to-column">
              Columna
              <select
                data-testid="move-to-column-select"
                aria-label="Mover tarea a otra columna"
                [disabled]="!canMoveWorkItem()"
                (change)="onMoveToColumn(item, $any($event.target).value)"
              >
                @for (column of columns(); track column.id) {
                  <option [value]="column.id" [selected]="column.id === item.columnId">{{ column.name }}</option>
                }
              </select>
            </label>

            <section class="work-comments" aria-labelledby="work-comments-title"><h4 id="work-comments-title">Comentarios</h4>
              <form data-testid="work-comment-form" (ngSubmit)="submitWorkComment()"><label for="work-comment">Agregar comentario</label><textarea id="work-comment" rows="3" maxlength="4000" [(ngModel)]="commentDraft" name="work-comment" [disabled]="commentSubmitting()"></textarea><fp-button type="submit" icon="comment" [disabled]="commentSubmitting() || !commentDraft.trim() || !canComment()">Comentar</fp-button></form>
              @if (commentLoading()) { <p role="status" aria-live="polite">Cargando comentarios...</p> } @if (sectionCommentError(); as message) { <p class="board-error" role="alert">{{ message }}</p> } @for (comment of workComments(); track comment.id) { <article class="work-comment"><div class="comment-meta"><strong>{{ comment.authorName || 'Usuario' }}</strong><span>{{ comment.createdAt | date:'d MMM y, HH:mm' }}</span></div>@if (editingCommentId() === comment.id) { <textarea rows="3" aria-label="Editar comentario" [value]="editingContent()" (input)="editingContent.set($any($event.target).value)"></textarea><fp-button type="button" icon="save" ariaLabel="Guardar comentario" (click)="saveComment(comment.id)">Guardar comentario</fp-button> } @else { <p>{{ comment.content }}</p>@if (canEdit(comment)) { <div class="comment-actions"><fp-button type="button" variant="secondary" icon="edit" ariaLabel="Editar comentario" (click)="startEdit(comment)">Editar</fp-button><fp-button type="button" variant="danger" icon="delete" ariaLabel="Eliminar comentario" (click)="confirmDeleteComment(comment.id)">Eliminar</fp-button></div> } }</article> }
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
                @if (canEditWorkItem()) {
                  <label>
                    Tarea padre
                    <select data-testid="parent-select" name="edit-parent" [(ngModel)]="editForm.parentWorkItemId">
                      <option [ngValue]="null">Sin tarea padre</option>
                      @for (candidate of eligibleParents(); track candidate.id) {
                        <option [ngValue]="candidate.id">{{ candidate.title }}</option>
                      }
                    </select>
                  </label>
                }
              </div>
              @if ((item.childCount ?? 0) > 0) {
                <p data-testid="delete-child-hint" class="assignee">
                  Esta tarea tiene subtareas: quitá o reasigná las subtareas antes de eliminarla.
                </p>
              }
              <div class="panel-actions wrap">
                <fp-button type="submit" icon="save" [disabled]="isMutating() || !canEditWorkItem()">Guardar cambios</fp-button>
                <fp-button
                  variant="danger"
                  type="button"
                  icon="delete"
                   testId="detail-delete-button"
                  [disabled]="isMutating() || !canDeleteWorkItem() || (item.childCount ?? 0) > 0"
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
            @if (commentError(); as message) { <p class="board-error" role="alert" data-testid="comment-delete-dialog-error">{{ message }}</p> }
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
  private readonly projectsStore = inject(ProjectsStore);

  readonly projectId = input.required<number, number | string>({ transform: numberAttribute });

  private readonly project = this.projectsStore.selectedProject;
  readonly canCreateWorkItem = computed(() => hasPermission(this.project(), 'WORKITEM_CREATE'));
  readonly canEditWorkItem = computed(() => hasPermission(this.project(), 'WORKITEM_EDIT'));
  readonly canDeleteWorkItem = computed(() => hasPermission(this.project(), 'WORKITEM_DELETE'));
  readonly canMoveWorkItem = computed(() => hasPermission(this.project(), 'WORKITEM_MOVE'));
  readonly canComment = computed(() => hasPermission(this.project(), 'COMMENT_CREATE'));

  readonly columns = this.store.columns;
  /** Board items the open item may be re-parented to (see {@link BoardStore.eligibleParents}). */
  readonly eligibleParents = this.store.eligibleParents;
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
      /**
       * `fp-dialog` is a fixed full-viewport backdrop with `aria-modal="true"`
       * and a focus trap, so an error rendered in `.work-comments` sits
       * visually behind the backdrop and outside the trap while the delete
       * confirmation dialog is open. While that dialog is open the error is
       * rendered inside the dialog instead (see `comment-delete-dialog-error`
       * below); this computed suppresses the section copy so the same
       * message is never announced twice by two `role="alert"` nodes.
       * Mirrors ProjectDetailComponent's `sectionCommentError`.
       */
      readonly sectionCommentError = computed(() => (this.deletingCommentId() === null ? this.commentError() : null));

  /** Which column the mobile single-column view shows; desktop ignores this. */
  readonly activeColumnId = signal<number | null>(null);

  /** Bound in the template to set each column's `--fp-column-accent`. */
  protected readonly columnAccent = columnAccent;

  createForm = emptyForm();
  editForm = emptyForm();

  constructor() {
    effect(() => {
      this.store.load(this.projectId());
      this.projectsStore.loadProject(this.projectId());
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

  /**
   * Local UI state (draft text, edit mode, pending delete) is only cleared once
   * the store confirms the write succeeded — otherwise a failed request would
   * silently discard what the user typed while the error message is shown.
   * Mirrors ProjectDetailComponent's comment methods (same CommentsStore
   * `Promise<boolean>` contract).
   */
  async submitWorkComment(): Promise<void> {
    const content = this.commentDraft.trim();
    const item = this.selectedItem();
    if (!content || !item || !this.commentsStore) return;
    const created = await this.commentsStore.createWorkItem(item.id, content);
    if (created) this.commentDraft = '';
  }
  canEdit(comment: import('../comments/comments.model').Comment): boolean { const id=this.commentsStore?.currentUserId(); return id!==null && id!==undefined && comment.authorId===id; }
  startEdit(comment: import('../comments/comments.model').Comment): void { this.editingCommentId.set(comment.id); this.editingContent.set(comment.content); }
  async saveComment(id: number): Promise<void> {
    const content = this.editingContent().trim();
    if (!content || !this.commentsStore) return;
    const saved = await this.commentsStore.update(id, content, 'workItem');
    if (saved) this.editingCommentId.set(null);
  }
  confirmDeleteComment(id: number): void { this.deletingCommentId.set(id); }
  cancelDeleteComment(): void { this.deletingCommentId.set(null); }
  async deleteCommentConfirmed(): Promise<void> {
    const id = this.deletingCommentId();
    if (id === null || !this.commentsStore) return;
    const deleted = await this.commentsStore.delete(id, 'workItem');
    if (deleted) this.deletingCommentId.set(null);
  }

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
    if (!this.canMoveWorkItem()) return;
    const movedItem = event.item.data;
    const targetColumnId = event.container.data;
    this.store.moveItem(movedItem.id, targetColumnId, event.currentIndex);
  }

  /**
   * `position` on `WorkItemMoveRequest` is a zero-based insertion INDEX
   * among the target column's OTHER items (api/openapi.yaml), not the
   * item's own gap-based `position` value. Sending `item.position` here
   * only happened to land at the end because the backend clamps
   * out-of-range indices — this computes the actual end-of-column index
   * instead, so "move to end of column X" is expressed correctly.
   */
  onMoveToColumn(item: WorkItem, columnId: string): void {
    const targetColumnId = Number(columnId);
    const endIndex = this.columnItems(targetColumnId).filter((existing) => existing.id !== item.id).length;
    this.store.moveItem(item.id, targetColumnId, endIndex);
  }
}

function formFromItem(item: WorkItem): WorkItemForm {
  return {
    title: item.title,
    description: item.description ?? '',
    assignedUserId: item.assignedUserId,
    sprintId: item.sprintId ?? null,
    priority: item.priority ?? null,
    parentWorkItemId: item.parentWorkItemId ?? null,
  };
}

function requestFromForm(form: WorkItemForm): WorkItemCreateRequest | WorkItemUpdateRequest | null {
  const title = form.title.trim();
  if (!title) {
    return null;
  }

  const rawAssignee = form.assignedUserId as number | string | null | undefined;
  const assignedUserId = Number(rawAssignee);

  const request: WorkItemCreateRequest | WorkItemUpdateRequest = {
    title,
    description: form.description.trim() || null,
    assignedUserId:
      rawAssignee === null || rawAssignee === undefined || rawAssignee === '' || Number.isNaN(assignedUserId)
        ? null
        : assignedUserId,
  };

  if (form.sprintId !== undefined) {
    request.sprintId = form.sprintId;
  }

  if (form.priority !== undefined) {
    request.priority = form.priority;
  }

  if (form.parentWorkItemId !== undefined) {
    request.parentWorkItemId = form.parentWorkItemId;
  }

  return request;
}
