import { Component, input, output } from '@angular/core';

import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpInputComponent } from '../../shared/ui/input.component';
import { EpicEdit, canAddEpic, canAddStory } from './ai-projects.model';

/**
 * Editable epics/stories tree for the AI project draft. Presentational: takes
 * the current tree and emits an immutably updated copy on every change. Items
 * are tracked by index so typing never re-creates (and un-focuses) an input.
 * Caps (10 epics, 10 stories per epic, 50 items) are enforced by disabling the
 * add buttons.
 */
@Component({
  selector: 'fp-ai-project-epics-editor',
  standalone: true,
  imports: [FpButtonComponent, FpInputComponent],
  template: `
    <ul class="epics">
      @for (epic of epics(); track $index; let i = $index) {
        <li class="epic">
          <div class="epic-head">
            <h3>Épica {{ i + 1 }}</h3>
            <fp-button
              type="button"
              variant="secondary"
              icon="delete"
              [testId]="'ai-epic-remove-' + i"
              [ariaLabel]="'Eliminar épica ' + (i + 1)"
              (click)="removeEpic(i)"
            >Eliminar épica</fp-button>
          </div>
          <fp-input
            [label]="'Título de la épica ' + (i + 1)"
            [testId]="'ai-epic-title-' + i"
            [value]="epic.title"
            [required]="true"
            (valueChange)="updateEpic(i, { title: $event })"
          />
          <fp-input
            [label]="'Descripción de la épica ' + (i + 1)"
            [testId]="'ai-epic-description-' + i"
            [value]="epic.description"
            (valueChange)="updateEpic(i, { description: $event })"
          />
          <ul class="stories" [attr.aria-label]="'Historias de la épica ' + (i + 1)">
            @for (story of epic.stories; track $index; let j = $index) {
              <li class="story">
                <fp-input
                  [label]="'Título de la historia ' + (i + 1) + '.' + (j + 1)"
                  [testId]="'ai-story-title-' + i + '-' + j"
                  [value]="story.title"
                  [required]="true"
                  (valueChange)="updateStory(i, j, { title: $event })"
                />
                <fp-input
                  [label]="'Descripción de la historia ' + (i + 1) + '.' + (j + 1)"
                  [testId]="'ai-story-description-' + i + '-' + j"
                  [value]="story.description"
                  (valueChange)="updateStory(i, j, { description: $event })"
                />
                <fp-button
                  type="button"
                  variant="secondary"
                  icon="delete"
                  [testId]="'ai-story-remove-' + i + '-' + j"
                  [ariaLabel]="'Eliminar historia ' + (i + 1) + '.' + (j + 1)"
                  (click)="removeStory(i, j)"
                >Eliminar historia</fp-button>
              </li>
            }
          </ul>
          <fp-button
            type="button"
            icon="add"
            [testId]="'ai-story-add-' + i"
            [ariaLabel]="'Añadir historia a la épica ' + (i + 1)"
            [disabled]="!canAddStory(i)"
            (click)="addStory(i)"
          >Añadir historia</fp-button>
        </li>
      }
    </ul>
    <fp-button type="button" icon="add" testId="ai-epic-add" [disabled]="!canAddEpic()" (click)="addEpic()">
      Añadir épica
    </fp-button>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-3);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
    }
    .epic {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-3);
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-sm);
      padding: var(--fp-space-3);
    }
    .epic-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--fp-space-3);
    }
    h3 {
      margin: 0;
      font-family: var(--fp-font-display);
      font-size: 1.125rem;
      color: var(--fp-text);
    }
    .stories {
      gap: var(--fp-space-3);
      padding-left: var(--fp-space-4);
      border-left: 2px solid var(--fp-border);
    }
    .story {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-2);
      align-items: flex-start;
    }
    .story fp-input {
      align-self: stretch;
    }
  `,
})
export class AiProjectEpicsEditorComponent {
  readonly epics = input.required<EpicEdit[]>();
  readonly epicsChange = output<EpicEdit[]>();

  canAddEpic(): boolean {
    return canAddEpic(this.epics());
  }

  canAddStory(epicIndex: number): boolean {
    return canAddStory(this.epics(), epicIndex);
  }

  addEpic(): void {
    if (this.canAddEpic()) {
      this.epicsChange.emit([...this.epics(), { title: '', description: '', stories: [] }]);
    }
  }

  removeEpic(index: number): void {
    this.epicsChange.emit(this.epics().filter((_, i) => i !== index));
  }

  updateEpic(index: number, patch: Partial<Pick<EpicEdit, 'title' | 'description'>>): void {
    this.epicsChange.emit(this.epics().map((epic, i) => (i === index ? { ...epic, ...patch } : epic)));
  }

  addStory(epicIndex: number): void {
    if (!this.canAddStory(epicIndex)) {
      return;
    }
    this.epicsChange.emit(
      this.epics().map((epic, i) =>
        i === epicIndex ? { ...epic, stories: [...epic.stories, { title: '', description: '' }] } : epic,
      ),
    );
  }

  removeStory(epicIndex: number, storyIndex: number): void {
    this.epicsChange.emit(
      this.epics().map((epic, i) =>
        i === epicIndex ? { ...epic, stories: epic.stories.filter((_, j) => j !== storyIndex) } : epic,
      ),
    );
  }

  updateStory(
    epicIndex: number,
    storyIndex: number,
    patch: Partial<{ title: string; description: string }>,
  ): void {
    this.epicsChange.emit(
      this.epics().map((epic, i) =>
        i === epicIndex
          ? { ...epic, stories: epic.stories.map((s, j) => (j === storyIndex ? { ...s, ...patch } : s)) }
          : epic,
      ),
    );
  }
}
