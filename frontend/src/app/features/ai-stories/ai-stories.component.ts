import { Component, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpIconComponent } from '../../shared/ui/icon.component';
import { FpInputComponent } from '../../shared/ui/input.component';
import { UserStoryDraft } from './ai-stories.model';
import { AiStoriesStore } from './ai-stories.store';

/**
 * AI-assisted user-story screen (spec: ai-user-story-generation). The user
 * types a free-text requirement, the backend returns a non-persisted draft
 * (Spanish sentence + acceptance criteria), the user edits it, and confirming
 * creates a real work item via the existing create endpoint with
 * `aiGenerated: true` provenance.
 *
 * A failed generate or confirm never discards the typed text: {@link AiStoriesStore}
 * resolves `false` and this component only clears its editable fields on `true`
 * (same contract as `CommentsStore`).
 */
@Component({
  selector: 'app-ai-stories',
  standalone: true,
  imports: [RouterLink, FpButtonComponent, FpCardComponent, FpIconComponent, FpInputComponent],
  templateUrl: './ai-stories.component.html',
  styleUrl: './ai-stories.component.scss',
})
export class AiStoriesComponent {
  readonly projectId = input.required<number, string>({ transform: numberAttribute });
  readonly store = inject(AiStoriesStore);

  readonly requirement = signal('');
  readonly title = signal('');
  readonly description = signal('');
  readonly criteria = signal<string[]>([]);

  /** Identity of the draft already copied into the editable fields, so an edit is never clobbered. */
  private seededDraft: UserStoryDraft | null = null;

  constructor() {
    effect(() => {
      const draft = this.store.draft();
      const criteria = this.store.criteria();
      if (draft && draft !== this.seededDraft) {
        this.seededDraft = draft;
        this.description.set(draft.text);
        this.criteria.set([...criteria]);
      }
    });
  }

  async generate(): Promise<void> {
    const requirement = this.requirement().trim();
    if (!requirement || this.store.loading()) {
      return;
    }
    await this.store.generate(this.projectId(), requirement);
  }

  addCriterion(): void {
    this.criteria.set([...this.criteria(), '']);
  }

  removeCriterion(index: number): void {
    this.criteria.set(this.criteria().filter((_, i) => i !== index));
  }

  updateCriterion(index: number, value: string): void {
    this.criteria.set(this.criteria().map((current, i) => (i === index ? value : current)));
  }

  async confirm(): Promise<void> {
    if (!this.title().trim() || this.store.submitting()) {
      return;
    }
    const ok = await this.store.confirm(this.projectId(), {
      title: this.title().trim(),
      description: this.description(),
      acceptanceCriteria: this.criteria().map((c) => c.trim()).filter((c) => c.length > 0),
    });
    if (ok) {
      this.title.set('');
      this.description.set('');
      this.criteria.set([]);
      this.requirement.set('');
      this.seededDraft = null;
    }
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
