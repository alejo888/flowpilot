import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpDialogComponent } from '../../shared/ui/dialog.component';
import { FpIconComponent } from '../../shared/ui/icon.component';
import { FpInputComponent } from '../../shared/ui/input.component';
import { BacklogApiService } from '../backlog/backlog-api.service';
import { Sprint } from '../backlog/backlog.model';
import { BoardApiService } from '../board/board-api.service';
import { BoardColumn, WorkItem } from '../board/board.model';
import { SubtaskDraft, WorkItemBatchCreateRequest } from './ai-subtasks.model';
import { AiSubtasksStore } from './ai-subtasks.store';

/** Client-side cap — mirrors the backend batch limit (`subtasks` maxItems 10). */
const MAX_DRAFTS = 10;

type GenerationMode = 'existing' | 'text';

/**
 * AI-assisted subtask screen (spec: ai-subtask-generation, PR 3a). The user
 * either picks an existing story (mode a — preselected via `?workItemId=`) or
 * pastes free text (mode b); the backend returns a non-persisted `{title,
 * description}` draft list which the user edits here.
 *
 * A failed generate never discards typed text: {@link AiSubtasksStore.generate}
 * resolves `false` and this component only replaces its editable drafts on a
 * confirmed `true` (same contract as `CommentsStore`/`AiStoriesStore`).
 *
 * The confirm step (PR 3b) presents a required column `<select>` and an
 * optional sprint `<select>` (PLANNED/ACTIVE only), then calls the
 * transactional batch endpoint through {@link AiSubtasksStore.confirm}. On a
 * confirmed 201 the editable state is cleared and the screen navigates back to
 * the board; on failure nothing is discarded.
 */
@Component({
  selector: 'app-ai-subtasks',
  standalone: true,
  imports: [
    RouterLink,
    FpButtonComponent,
    FpCardComponent,
    FpDialogComponent,
    FpIconComponent,
    FpInputComponent,
  ],
  templateUrl: './ai-subtasks.component.html',
  styleUrl: './ai-subtasks.component.scss',
})
export class AiSubtasksComponent {
  readonly projectId = input.required<number, string>({ transform: numberAttribute });
  /** Optional `?workItemId=` query param — preselects mode (a) and the story. */
  readonly workItemId = input<number | undefined, string | undefined>(undefined, {
    transform: (value) => (value == null || value === '' ? undefined : numberAttribute(value)),
  });

  readonly store = inject(AiSubtasksStore);
  private readonly board = inject(BoardApiService);
  private readonly backlog = inject(BacklogApiService);
  private readonly router = inject(Router);

  readonly mode = signal<GenerationMode>('text');
  readonly storyText = signal('');
  readonly selectedStoryId = signal<number | null>(null);
  readonly drafts = signal<SubtaskDraft[]>([]);
  /** True while the "story already has N subtasks" confirmation dialog is open. */
  readonly confirming = signal(false);

  /** Confirm-step selections. `columnId` is required before the batch can be created. */
  readonly columnId = signal<number | null>(null);
  readonly sprintId = signal<number | null>(null);

  readonly columns = signal<BoardColumn[]>([]);
  private readonly sprints = signal<Sprint[]>([]);
  /** Only PLANNED/ACTIVE sprints accept new work items (`validateSprint` rejects COMPLETED). */
  readonly selectableSprints = computed(() =>
    this.sprints().filter((sprint) => sprint.status !== 'COMPLETED'),
  );

  private readonly workItems = signal<WorkItem[]>([]);
  /** Only top-level items can be a subtask parent (a subtask cannot have subtasks). */
  readonly stories = computed(() =>
    this.workItems().filter((item) => (item.parentWorkItemId ?? null) === null),
  );
  readonly selectedStory = computed(
    () => this.stories().find((item) => item.id === this.selectedStoryId()) ?? null,
  );

  readonly maxDrafts = MAX_DRAFTS;

  /** Identity of the generated list already copied into `drafts`, so an edit is never clobbered. */
  private seededList: SubtaskDraft[] | null = null;
  private workItemsLoadedFor: number | null = null;

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (this.workItemsLoadedFor !== projectId) {
        this.workItemsLoadedFor = projectId;
        this.board.getWorkItems(projectId).subscribe({
          next: (items) => this.workItems.set(items),
          error: () => this.workItems.set([]),
        });
        this.board.getBoardColumns(projectId).subscribe({
          next: (columns) => this.columns.set(columns),
          error: () => this.columns.set([]),
        });
        this.backlog.listSprints(projectId).subscribe({
          next: (sprints) => this.sprints.set(sprints),
          error: () => this.sprints.set([]),
        });
      }
    });

    effect(() => {
      const preselected = this.workItemId();
      if (preselected != null) {
        this.mode.set('existing');
        this.selectedStoryId.set(preselected);
      }
    });

    effect(() => {
      const generated = this.store.generated();
      if (generated && generated !== this.seededList) {
        this.seededList = generated;
        this.drafts.set(generated.map((draft) => ({ ...draft })));
      }
    });
  }

  setMode(mode: GenerationMode): void {
    this.mode.set(mode);
  }

  selectStory(value: string): void {
    this.selectedStoryId.set(value ? Number(value) : null);
  }

  selectColumn(value: string): void {
    this.columnId.set(value ? Number(value) : null);
  }

  selectSprint(value: string): void {
    this.sprintId.set(value ? Number(value) : null);
  }

  async generate(): Promise<void> {
    if (this.store.loading()) {
      return;
    }
    if (this.mode() === 'existing') {
      if (this.selectedStoryId() == null) {
        return;
      }
      if ((this.selectedStory()?.childCount ?? 0) > 0) {
        this.confirming.set(true);
        return;
      }
      await this.runGenerate();
      return;
    }
    if (!this.storyText().trim()) {
      return;
    }
    await this.runGenerate();
  }

  async confirmGenerate(): Promise<void> {
    this.confirming.set(false);
    await this.runGenerate();
  }

  cancelGenerate(): void {
    this.confirming.set(false);
  }

  private async runGenerate(): Promise<void> {
    const request =
      this.mode() === 'existing'
        ? { workItemId: this.selectedStoryId() as number }
        : { storyText: this.storyText().trim() };
    await this.store.generate(this.projectId(), request);
  }

  /** Disabled until a column is picked, at least one draft exists, and no create is in flight. */
  readonly canConfirm = computed(
    () => this.columnId() !== null && this.drafts().length > 0 && !this.store.submitting(),
  );

  async confirm(): Promise<void> {
    if (!this.canConfirm()) {
      return;
    }
    const request: WorkItemBatchCreateRequest = {
      columnId: this.columnId() as number,
      aiGenerated: true,
      aiModel: this.store.model(),
      subtasks: this.drafts().map((draft) => ({
        title: draft.title.trim(),
        description: draft.description,
      })),
    };
    if (this.mode() === 'existing' && this.selectedStoryId() != null) {
      request.parentWorkItemId = this.selectedStoryId() as number;
    }
    if (this.sprintId() != null) {
      request.sprintId = this.sprintId() as number;
    }

    const ok = await this.store.confirm(this.projectId(), request);
    if (!ok) {
      return;
    }
    this.drafts.set([]);
    this.columnId.set(null);
    this.sprintId.set(null);
    this.seededList = null;
    await this.router.navigate(['/projects', this.projectId(), 'board']);
  }

  addDraft(): void {
    if (this.drafts().length >= MAX_DRAFTS) {
      return;
    }
    this.drafts.set([...this.drafts(), { title: '', description: '' }]);
  }

  removeDraft(index: number): void {
    this.drafts.set(this.drafts().filter((_, i) => i !== index));
  }

  updateDraftTitle(index: number, value: string): void {
    this.drafts.set(
      this.drafts().map((draft, i) => (i === index ? { ...draft, title: value } : draft)),
    );
  }

  updateDraftDescription(index: number, value: string): void {
    this.drafts.set(
      this.drafts().map((draft, i) => (i === index ? { ...draft, description: value } : draft)),
    );
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
