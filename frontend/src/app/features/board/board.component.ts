import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';

import { FpCardComponent } from '../../shared/ui/card.component';
import { FpDialogComponent } from '../../shared/ui/dialog.component';
import { WorkItem, WorkItemCreateRequest, WorkItemUpdateRequest } from './board.model';
import { BoardStore } from './board.store';

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
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, FormsModule, FpCardComponent, FpDialogComponent],
  template: `
    <div class="board" cdkDropListGroup>
      <header class="board-header">
        <div>
          <p class="eyebrow">Tablero Kanban</p>
          <h2>Trabajo del proyecto</h2>
        </div>
        <button class="primary-button" type="button" (click)="startCreate()">Crear tarea</button>
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
            <button class="primary-button" type="submit" [disabled]="isMutating()">Guardar tarea</button>
            <button class="ghost-button" type="button" (click)="cancelCreate()">Cancelar</button>
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
          @for (column of columns(); track column.id) {
            <section
              class="board-column"
              [class.board-column--inactive-mobile]="column.id !== activeColumnId()"
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
                      <span class="assignee">Asignado a #{{ item.assignedUserId }}</span>
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
              <button class="icon-button" type="button" aria-label="Cerrar detalle" (click)="closeDetail()">×</button>
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
                <button class="primary-button" type="submit" [disabled]="isMutating()">Guardar cambios</button>
                <button class="danger-button" type="button" [disabled]="isMutating()" (click)="confirmDelete(item)">
                  Eliminar tarea
                </button>
              </div>
            </form>
          </aside>
        }

        @if (deleteCandidate(); as itemToDelete) {
          <fp-dialog data-testid="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
            <h3 id="delete-dialog-title">Eliminar tarea</h3>
            <p id="delete-dialog-description">¿Seguro que querés eliminar la tarea "{{ itemToDelete.title }}"? Esta acción no se puede deshacer.</p>
            <div class="panel-actions">
              <button class="danger-button" type="button" (click)="deleteConfirmed()">Sí, eliminar</button>
              <button class="ghost-button" type="button" (click)="cancelDelete()">Cancelar</button>
            </div>
          </fp-dialog>
        }
      </div>
    </div>
  `,
  styles: `
    .board {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
      padding: var(--fp-space-8);
      min-height: 100%;
    }

    .board-header,
    .detail-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--fp-space-4);
    }

    .board-header h2,
    .detail-header h3,
    .task-panel h3 {
      margin: 0;
      font-family: var(--fp-font-display);
      color: var(--fp-text);
    }

    .eyebrow {
      margin: 0 0 var(--fp-space-1);
      font-family: var(--fp-font-body);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--fp-text-muted);
    }

    .board-error,
    .board-success {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
    }

    .board-error {
      color: var(--fp-danger);
    }

    .board-success {
      color: var(--fp-success, #257a4b);
    }

    .board-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--fp-space-4);
      align-items: flex-start;
    }

    // Hidden on desktop — swiping a half-cut column into view isn't a great
    // mobile pattern. Below the breakpoint this becomes the only way to
    // switch which column is visible (see .board-column--inactive-mobile).
    .board-column-tabs {
      display: none;
      gap: var(--fp-space-2);
      overflow-x: auto;
    }

    .board-column-tab {
      flex: none;
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-sm);
      background: var(--fp-surface);
      padding: var(--fp-space-2) var(--fp-space-3);
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--fp-text-muted);
      cursor: pointer;
    }

    .board-column-tab--active {
      border-color: var(--fp-accent);
      background: var(--fp-accent);
      color: var(--fp-accent-contrast);
    }

    .board-columns {
      display: flex;
      gap: var(--fp-space-4);
      align-items: flex-start;
      overflow-x: auto;
      min-width: 0;

      // CSS-only scroll shadows: two "cover" gradients scroll with the
      // content (background-attachment: local) and exactly cancel out two
      // fixed shadow gradients (attachment: scroll) at the start/end of the
      // scrollable area. Scrolling away from an edge uncovers that edge's
      // shadow — no JS scroll listener needed to know when more content is
      // off-screen in either direction.
      background:
        linear-gradient(to right, var(--fp-bg) 30%, transparent) left,
        linear-gradient(to left, var(--fp-bg) 30%, transparent) right,
        linear-gradient(to right, rgba(36, 31, 28, 0.12), transparent) left,
        linear-gradient(to left, rgba(36, 31, 28, 0.12), transparent) right;
      background-repeat: no-repeat;
      background-color: var(--fp-bg);
      background-size:
        40px 100%,
        40px 100%,
        16px 100%,
        16px 100%;
      background-attachment: local, local, scroll, scroll;
    }

    .board-column,
    .task-panel {
      background: var(--fp-bg);
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-md);
      box-shadow: var(--fp-shadow-sm);
    }

    .board-column {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-3);
      min-width: 260px;
      padding: var(--fp-space-4);
    }

    .board-column-name {
      margin: 0;
      font-family: var(--fp-font-display);
      font-optical-sizing: auto;
      font-weight: 600;
      font-size: 1.0625rem;
      color: var(--fp-text);
    }

    .board-column-list {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-2);
      min-height: 40px;
    }

    .board-card {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-1);
      padding: var(--fp-space-3);
      cursor: grab;
      font-family: var(--fp-font-body);
      font-size: 0.9375rem;
      color: var(--fp-text);
    }

    .card-title {
      appearance: none;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: 700;
      text-align: left;
      cursor: pointer;
      overflow-wrap: break-word;
    }

    .assignee {
      color: var(--fp-text-muted);
      font-size: 0.8125rem;
    }

    .task-panel {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
      padding: var(--fp-space-4);
    }

    .detail-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.32);
      z-index: 20;
    }

    .detail-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(360px, 100vw);
      border-radius: 0;
      overflow-y: auto;
      z-index: 21;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--fp-space-3);
    }

    .form-grid.stacked {
      grid-template-columns: 1fr;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-1);
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--fp-text);
    }

    input,
    select,
    textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-sm);
      padding: var(--fp-space-2) var(--fp-space-3);
      background: var(--fp-surface);
      color: var(--fp-text);
      font: 400 0.9375rem var(--fp-font-body);
    }

    textarea {
      resize: vertical;
    }

    .panel-actions {
      display: flex;
      gap: var(--fp-space-2);
      justify-content: flex-end;
    }

    .panel-actions.wrap {
      flex-wrap: wrap;
      justify-content: space-between;
    }

    .primary-button,
    .ghost-button,
    .danger-button,
    .icon-button {
      border-radius: var(--fp-radius-sm);
      padding: var(--fp-space-2) var(--fp-space-3);
      font-family: var(--fp-font-body);
      font-weight: 700;
      cursor: pointer;
    }

    .primary-button {
      border: 1px solid var(--fp-accent);
      background: var(--fp-accent);
      color: var(--fp-accent-contrast);
    }

    .ghost-button,
    .icon-button {
      border: 1px solid var(--fp-border);
      background: transparent;
      color: var(--fp-text);
    }

    .danger-button {
      border: 1px solid var(--fp-danger);
      background: transparent;
      color: var(--fp-danger);
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    @media (max-width: 900px) {
      .form-grid {
        grid-template-columns: 1fr;
      }

      .detail-panel {
        width: 100vw;
      }
    }

    // Swiping a column half into view isn't a great mobile pattern — below
    // this width, show the active column full-width with a tab strip to
    // switch instead of the desktop horizontal-scroll row.
    @media (max-width: 640px) {
      .board-column-tabs {
        display: flex;
      }

      .board-columns {
        overflow-x: visible;
        background: none;
      }

      .board-column--inactive-mobile {
        display: none;
      }

      .board-column {
        width: 100%;
      }
    }
  `,
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

  /** Which column the mobile single-column view shows; desktop ignores this. */
  readonly activeColumnId = signal<number | null>(null);

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
  }

  closeDetail(): void {
    this.store.selectItem(null);
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
