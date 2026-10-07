import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpIconComponent } from '../../shared/ui/icon.component';
import { FpDialogComponent } from '../../shared/ui/dialog.component';
import { AiConfigService } from '../../core/ai/ai-config.service';
import { BoardColumnComponent } from './board-column.component';
import { WorkItemDetailPanelComponent } from './work-item-detail-panel.component';
import { columnAccent } from './column-accent';
import { emptyForm, requestFromForm } from './work-item-form';
import { WorkItem } from './board.model';
import { BoardStore } from './board.store';
import { CommentsStore } from '../comments/comments.store';
import { hasPermission } from '../projects/project.model';
import { ProjectsStore } from '../projects/projects.store';

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
    FormsModule,
    FpButtonComponent,
    FpIconComponent,
    FpDialogComponent,
    BoardColumnComponent,
    WorkItemDetailPanelComponent,
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
              fpBoardColumn
              class="board-column"
              [class.board-column--inactive-mobile]="column.id !== activeColumnId()"
              [style.--fp-column-accent]="columnAccent(column.name, $i)"
              [column]="column"
              [items]="columnItems(column.id)"
              [canMove]="canMoveWorkItem()"
              (itemDropped)="onDrop($event)"
              (itemOpened)="openDetail($event)"
            ></section>
          }
        </div>

        @if (selectedItem(); as item) {
          <div class="detail-backdrop" data-testid="detail-backdrop" (click)="closeDetail()"></div>
          <aside
            fpWorkItemDetailPanel
            class="task-panel detail-panel"
            data-testid="detail-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-panel-title"
            aria-describedby="detail-panel-description"
            [workItem]="item"
            [projectId]="projectId()"
            [canEditWorkItem]="canEditWorkItem()"
            [canDeleteWorkItem]="canDeleteWorkItem()"
            [canMoveWorkItem]="canMoveWorkItem()"
            [canComment]="canComment()"
            [canGenerateSubtasks]="canGenerateSubtasks()"
            [canGenerateCriteria]="canGenerateCriteria()"
            (closed)="closeDetail()"
            (moveRequested)="onMoveToColumn(item, $event)"
            (deleteRequested)="confirmDelete($event)"
          ></aside>
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
  private readonly aiEnabled = inject(AiConfigService).aiEnabled;
  /**
   * The "Generar subtareas" panel action ends in a `WORKITEM_CREATE`-guarded
   * batch create, so gate the entrypoint on the assistant flag AND that same
   * permission (same control-gating convention as the other panel controls).
   * The per-item "not itself a subtask" check stays in the template.
   */
  readonly canGenerateSubtasks = computed(
    () => this.aiEnabled() && hasPermission(this.project(), 'WORKITEM_CREATE'),
  );
  /**
   * The AI acceptance-criteria draft is attached through the same
   * `PUT /api/work-items/{id}` as a manual criteria edit, so the "Generar
   * criterios con IA" button is gated on the assistant flag AND `WORKITEM_EDIT`
   * (diverging from the subtasks entrypoint's `WORKITEM_CREATE`). The criteria
   * editor itself stays usable without AI — only this button (and the story
   * improvement one, same attach path) depends on it.
   */
  readonly canGenerateCriteria = computed(
    () => this.aiEnabled() && hasPermission(this.project(), 'WORKITEM_EDIT'),
  );

  readonly columns = this.store.columns;
  readonly selectedItem = this.store.selectedItem;
  readonly error = this.store.error;
  readonly success = this.store.success;
  readonly isMutating = this.store.isMutating;
  readonly itemsByColumn = computed(() => this.store.itemsByColumn());
  readonly showCreateForm = signal(false);
  readonly deleteCandidate = signal<WorkItem | null>(null);
  /** Only used to load the open item's comments; the comments child renders and writes them. */
  private readonly commentsStore = inject(CommentsStore, { optional: true });

  /** Which column the mobile single-column view shows; desktop ignores this. */
  readonly activeColumnId = signal<number | null>(null);

  /** Bound in the template to set each column's `--fp-column-accent`. */
  protected readonly columnAccent = columnAccent;

  createForm = emptyForm();

  constructor() {
    effect(() => {
      this.store.load(this.projectId());
      this.projectsStore.loadProject(this.projectId());
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
