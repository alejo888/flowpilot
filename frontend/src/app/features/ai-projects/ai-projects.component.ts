import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpIconComponent } from '../../shared/ui/icon.component';
import { FpInputComponent } from '../../shared/ui/input.component';
import { AiProjectEpicsEditorComponent } from './ai-project-epics-editor.component';
import {
  EpicEdit,
  ProjectDraftResponse,
  ProjectWithBacklogRequest,
  hasBlankTitle,
} from './ai-projects.model';
import { AiProjectsStore } from './ai-projects.store';

const MAX_DESCRIPTION = 2000;

/**
 * AI project creation screen (vision 7.4). Step 1: the user describes the
 * project; step 2: the returned non-persisted draft (project fields + epics
 * with stories) is edited and confirmed, creating everything in one
 * transaction with `aiGenerated: true` provenance.
 *
 * A failed generate or confirm never discards typed text: {@link AiProjectsStore}
 * resolves `false` and editable fields are only cleared on success. The
 * component navigates to the new board; the store stays Router-free.
 */
@Component({
  selector: 'app-ai-projects',
  standalone: true,
  imports: [
    RouterLink,
    FpButtonComponent,
    FpCardComponent,
    FpIconComponent,
    FpInputComponent,
    AiProjectEpicsEditorComponent,
  ],
  templateUrl: './ai-projects.component.html',
  styleUrl: './ai-projects.component.scss',
})
export class AiProjectsComponent {
  readonly store = inject(AiProjectsStore);
  private readonly router = inject(Router);

  protected readonly maxDescription = MAX_DESCRIPTION;

  readonly requirement = signal('');
  readonly name = signal('');
  readonly description = signal('');
  readonly technologies = signal('');
  readonly code = signal('');
  readonly epics = signal<EpicEdit[]>([]);

  readonly fieldErrorList = computed(() => Object.values(this.store.fieldErrors()));
  readonly hasBlankTitle = computed(() => this.name().trim() === '' || hasBlankTitle(this.epics()));
  readonly canConfirm = computed(() => !this.hasBlankTitle() && !this.store.submitting());

  /** Identity of the draft already copied into the editable fields, so an edit is never clobbered. */
  private seededDraft: ProjectDraftResponse | null = null;

  constructor() {
    effect(() => {
      const draft = this.store.draft();
      if (draft && draft !== this.seededDraft) {
        this.seededDraft = draft;
        this.name.set(draft.name);
        this.description.set(draft.description ?? '');
        this.technologies.set(draft.technologies ?? '');
        this.code.set('');
        this.epics.set(
          draft.epics.map((epic) => ({
            title: epic.title,
            description: epic.description ?? '',
            stories: epic.stories.map((s) => ({ title: s.title, description: s.description ?? '' })),
          })),
        );
      }
    });
  }

  async generate(): Promise<void> {
    const description = this.requirement().trim();
    if (!description || this.store.loading()) {
      return;
    }
    await this.store.generate(description);
  }

  /** Back to step 1 keeping the original description so it can be regenerated. */
  discard(): void {
    this.store.reset();
    this.seededDraft = null;
  }

  async confirm(): Promise<void> {
    if (!this.canConfirm()) {
      return;
    }
    const request: ProjectWithBacklogRequest = {
      name: this.name().trim(),
      description: blankToNull(this.description()),
      code: blankToNull(this.code()),
      technologies: blankToNull(this.technologies()),
      epics: this.epics().map((epic) => ({
        title: epic.title.trim(),
        description: blankToNull(epic.description),
        stories: epic.stories.map((s) => ({
          title: s.title.trim(),
          description: blankToNull(s.description),
        })),
      })),
      aiGenerated: true,
      aiModel: this.store.model(),
    };
    if (await this.store.confirm(request)) {
      const id = this.store.createdProjectId();
      this.requirement.set('');
      this.seededDraft = null;
      await this.router.navigate(['/projects', id, 'board']);
    }
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
