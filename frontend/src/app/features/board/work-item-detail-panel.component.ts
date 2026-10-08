import { Component, DestroyRef, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpIconComponent } from '../../shared/ui/icon.component';
import { AcceptanceCriteriaEditorComponent } from './acceptance-criteria-editor.component';
import { AiCriteriaStore, mergeCriteria } from './ai-criteria.store';
import { AiStoryImprovementStore } from './ai-story-improvement.store';
import { WorkItem } from './board.model';
import { BoardStore } from './board.store';
import { CriteriaOverflowNoticeComponent } from './criteria-overflow-notice.component';
import { StoryImprovementPreviewComponent } from './story-improvement-preview.component';
import { WorkItemCommentsComponent } from './work-item-comments.component';
import { emptyForm, formFromItem, requestFromForm } from './work-item-form';

/**
 * Body of the board's work-item detail overlay: header, parent/child hints,
 * the "Generar subtareas" link, the move-to-column select, comments, the edit
 * form (parent select, acceptance criteria, AI criteria and story improvement)
 * and the delete action.
 *
 * Attribute selector on `<aside>` so the board keeps owning the overlay
 * element itself (`data-testid="detail-panel"`, `role="dialog"`, aria
 * labelling, layout classes) with no extra wrapper. Every permission gate is
 * an input computed by the board (fail-closed while the project is loading);
 * moving and deleting are emitted back to the board, which owns the column
 * index math and the delete confirmation dialog.
 */
@Component({
  selector: 'aside[fpWorkItemDetailPanel]',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    FpButtonComponent,
    FpIconComponent,
    AcceptanceCriteriaEditorComponent,
    CriteriaOverflowNoticeComponent,
    StoryImprovementPreviewComponent,
    WorkItemCommentsComponent,
  ],
  template: `
    @let item = workItem();

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
        (click)="closed.emit()"
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

    @if (canGenerateSubtasks() && !item.parentWorkItemId) {
      <a
        class="panel-link"
        data-testid="generate-subtasks"
        [routerLink]="['/projects', projectId(), 'ai', 'subtasks']"
        [queryParams]="{ workItemId: item.id }"
      ><fp-icon name="add" /> Generar subtareas</a>
    }

    <label class="move-to-column">
      Columna
      <select
        data-testid="move-to-column-select"
        aria-label="Mover tarea a otra columna"
        [disabled]="!canMoveWorkItem()"
        (change)="moveRequested.emit($any($event.target).value)"
      >
        @for (column of columns(); track column.id) {
          <option [value]="column.id" [selected]="column.id === item.columnId">{{ column.name }}</option>
        }
      </select>
    </label>

    <fp-work-item-comments [workItemId]="item.id" [canComment]="canComment()" />

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
            <select
              data-testid="parent-select"
              name="edit-parent"
              [disabled]="(item.childCount ?? 0) > 0"
              [(ngModel)]="editForm.parentWorkItemId"
            >
              <option [ngValue]="null">Sin tarea padre</option>
              @for (candidate of eligibleParents(); track candidate.id) {
                <option [ngValue]="candidate.id">{{ candidate.title }}</option>
              }
            </select>
          </label>
        }
      </div>

      <fp-acceptance-criteria-editor
        data-testid="acceptance-criteria-editor"
        [criteria]="editForm.acceptanceCriteria ?? []"
        [disabled]="!canEditWorkItem()"
        (criteriaChange)="onCriteriaChange($event)"
      />

      @if (canGenerateCriteria()) {
        <div class="panel-actions wrap">
          <fp-button
            type="button"
            icon="add"
            testId="generate-criteria"
            [disabled]="aiCriteriaLoading()"
            (click)="generateCriteria(item.id)"
          >Generar criterios con IA</fp-button>
          <fp-button
            type="button"
            icon="add"
            testId="improve-story"
            [disabled]="aiStoryLoading()"
            (click)="improveStory(item.id)"
          >Mejorar historia con IA</fp-button>
        </div>
      }
      @if (aiCriteriaError(); as criteriaError) {
        <p data-testid="generate-criteria-error" class="board-error" role="alert">{{ criteriaError }}</p>
      }
      @if (aiStoryError(); as storyError) {
        <p data-testid="improve-story-error" class="board-error" role="alert">{{ storyError }}</p>
      }
      @if (aiStorySuggestion(); as suggestion) {
        <fp-story-improvement-preview
          data-testid="improve-story-preview"
          [description]="suggestion.description"
          [criteria]="suggestion.criteria"
          [existingCriteria]="editForm.acceptanceCriteria ?? []"
          (apply)="applyStoryImprovement()"
          (discard)="discardStoryImprovement()"
        />
      }
      @if (aiCriteriaDraft(); as draft) {
        <div data-testid="criteria-suggestion-block">
          <fp-acceptance-criteria-editor
            data-testid="criteria-suggestion-editor"
            label="Criterios sugeridos"
            [criteria]="draft"
            (criteriaChange)="setCriteriaDraft($event)"
          />
          <fp-criteria-overflow-notice [overflow]="aiCriteriaOverflow()" />
          <div class="panel-actions wrap">
            <fp-button type="button" icon="save" testId="accept-criteria" (click)="acceptCriteria()">Añadir a la tarea</fp-button>
            <fp-button type="button" variant="secondary" icon="close" testId="discard-criteria" (click)="discardCriteria()">Descartar</fp-button>
          </div>
        </div>
      }

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
          (click)="deleteRequested.emit(item)"
        >
          Eliminar tarea
        </fp-button>
      </div>
    </form>
  `,
  styleUrl: './work-item-detail-panel.component.scss',
})
export class WorkItemDetailPanelComponent {
  private readonly store = inject(BoardStore);

  /** The open work item (the board's `selectedItem`). */
  readonly workItem = input.required<WorkItem>();
  readonly projectId = input.required<number>();
  readonly canEditWorkItem = input.required<boolean>();
  readonly canDeleteWorkItem = input.required<boolean>();
  readonly canMoveWorkItem = input.required<boolean>();
  readonly canComment = input.required<boolean>();
  /** AI assistant enabled AND `WORKITEM_CREATE` (the subtasks flow ends in a batch create). */
  readonly canGenerateSubtasks = input.required<boolean>();
  /**
   * AI assistant enabled AND `WORKITEM_EDIT`: the AI criteria / story
   * improvement drafts are attached through the same `WORKITEM_EDIT`-guarded
   * `PUT /api/work-items/{id}` as a manual edit. The criteria editor itself
   * stays usable without AI — only these buttons depend on it.
   */
  readonly canGenerateCriteria = input.required<boolean>();

  /** Close button clicked. */
  readonly closed = output<void>();
  /** Target column id (raw `<select>` value) chosen in the move select. */
  readonly moveRequested = output<string>();
  /** Delete clicked; the board asks for confirmation first. */
  readonly deleteRequested = output<WorkItem>();

  readonly columns = this.store.columns;
  /** Board items the open item may be re-parented to (see {@link BoardStore.eligibleParents}). */
  readonly eligibleParents = this.store.eligibleParents;
  readonly isMutating = this.store.isMutating;

  private readonly aiCriteria = inject(AiCriteriaStore);
  readonly aiCriteriaDraft = this.aiCriteria.draft;
  readonly aiCriteriaOverflow = this.aiCriteria.overflow;
  readonly aiCriteriaError = this.aiCriteria.error;
  readonly aiCriteriaLoading = this.aiCriteria.loading;

  /** AI story improvement (vision 7.7): same gate as criteria generation (attach path is the `WORKITEM_EDIT` PUT). */
  private readonly aiStory = inject(AiStoryImprovementStore);
  readonly aiStorySuggestion = this.aiStory.suggestion;
  readonly aiStoryError = this.aiStory.error;
  readonly aiStoryLoading = this.aiStory.loading;

  editForm = emptyForm();

  constructor() {
    effect(() => {
      this.editForm = formFromItem(this.workItem());
      // Drop any stale AI suggestions/error when the open item changes so the
      // next item never inherits them.
      this.resetAiDrafts();
    });
    // Closing the panel destroys this component: drop them then too.
    inject(DestroyRef).onDestroy(() => this.resetAiDrafts());
  }

  /**
   * The acceptance-criteria editor is a controlled child: it never mutates its
   * input, so a change event replaces the form's list with the emitted array.
   * Nothing is persisted until the edit form is submitted (`submitUpdate`).
   */
  onCriteriaChange(next: string[]): void {
    this.editForm = { ...this.editForm, acceptanceCriteria: next };
  }

  /**
   * Requests an AI acceptance-criteria draft for the open item, seeded from the
   * form's current list so unsaved manual edits are the "existing" half of the
   * union. A failed generate never touches the form (`Promise<boolean>`
   * contract) — it only surfaces the Spanish 503 via {@link aiCriteriaError}.
   */
  async generateCriteria(itemId: number): Promise<void> {
    if (this.aiCriteriaLoading()) {
      return;
    }
    await this.aiCriteria.generate(this.projectId(), itemId, this.editForm.acceptanceCriteria ?? []);
  }

  setCriteriaDraft(next: string[]): void {
    this.aiCriteria.setDraft(next);
  }

  /** Writes the accepted union draft into the edit form; the form submit persists it. */
  acceptCriteria(): void {
    const draft = this.aiCriteria.draft();
    if (!draft) {
      return;
    }
    this.editForm = { ...this.editForm, acceptanceCriteria: [...draft] };
    this.aiCriteria.discard();
  }

  /** Drops the suggestions and leaves the item's saved criteria byte-identical. */
  discardCriteria(): void {
    this.aiCriteria.discard();
  }

  /** Requests an AI story improvement; a failure only surfaces the Spanish error and never touches the form. */
  async improveStory(itemId: number): Promise<void> {
    if (this.aiStoryLoading()) {
      return;
    }
    await this.aiStory.generate(this.projectId(), itemId);
  }

  /**
   * Applies the suggestion to the edit form only: the description is replaced
   * (title untouched) and the criteria are union-merged (existing first, capped).
   * The form submit persists it.
   */
  applyStoryImprovement(): void {
    const suggestion = this.aiStory.suggestion();
    if (!suggestion) {
      return;
    }
    this.editForm = {
      ...this.editForm,
      description: suggestion.description,
      acceptanceCriteria: mergeCriteria(this.editForm.acceptanceCriteria ?? [], suggestion.criteria),
    };
    this.aiStory.discard();
  }

  /** Drops the suggestion and leaves the form byte-identical. */
  discardStoryImprovement(): void {
    this.aiStory.discard();
  }

  submitUpdate(itemId: number): void {
    const request = requestFromForm(this.editForm);
    if (!request) {
      return;
    }
    this.store.updateItem(itemId, request);
  }

  private resetAiDrafts(): void {
    this.aiCriteria.discard();
    this.aiCriteria.error.set(null);
    this.aiStory.reset();
  }
}
