import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, OnInit, computed, inject, input } from '@angular/core';

import { FpCardComponent } from '../../shared/ui/card.component';
import { WorkItem } from './board.model';
import { BoardStore } from './board.store';

/**
 * Minimal kanban board (spec: kanban-board). Fetches a project's board
 * columns + work items via {@link BoardStore} and renders them grouped by
 * column, with CDK drag-and-drop between/within columns calling
 * `PUT /api/work-items/{id}/move` on drop. Routed at
 * `projects/:projectId/board` (see `app.routes.ts`), with a back-to-projects
 * link (spec: projects-ui, Cross-Feature Navigation Links). Visual layer
 * uses the FlowPilot shared/ui kit (fp-card for work-item cards) —
 * behavior is unchanged from the raw-HTML version this replaces.
 */
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, FpCardComponent],
  template: `
    <div class="board" cdkDropListGroup>
      @if (error(); as message) {
        <p data-testid="board-error" class="board-error">{{ message }}</p>
      }
      <div class="board-columns">
        @for (column of columns(); track column.id) {
          <section class="board-column">
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
                  <span data-testid="work-item-title">{{ item.title }}</span>
                </fp-card>
              }
            </div>
          </section>
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

    .board-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .board-columns {
      display: flex;
      gap: var(--fp-space-4);
      align-items: flex-start;
      overflow-x: auto;
    }

    .board-column {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-3);
      min-width: 260px;
      background: var(--fp-bg);
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-md);
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
      padding: var(--fp-space-3);
      cursor: grab;
      font-family: var(--fp-font-body);
      font-size: 0.9375rem;
      color: var(--fp-text);
    }
  `,
})
export class BoardComponent implements OnInit {
  private readonly store = inject(BoardStore);

  readonly projectId = input.required<number>();

  readonly columns = this.store.columns;
  readonly error = this.store.error;
  readonly itemsByColumn = computed(() => this.store.itemsByColumn());

  ngOnInit(): void {
    this.store.load(this.projectId());
  }

  columnItems(columnId: number): WorkItem[] {
    return this.itemsByColumn()[columnId] ?? [];
  }

  onDrop(event: CdkDragDrop<number, number, WorkItem>): void {
    const movedItem = event.item.data;
    const targetColumnId = event.container.data;
    this.store.moveItem(movedItem.id, targetColumnId, event.currentIndex);
  }
}
