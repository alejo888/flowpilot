import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, OnInit, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { WorkItem } from './board.model';
import { BoardStore } from './board.store';

/**
 * Minimal kanban board (spec: kanban-board). Fetches a project's board
 * columns + work items via {@link BoardStore} and renders them grouped by
 * column, with CDK drag-and-drop between/within columns calling
 * `PUT /api/work-items/{id}/move` on drop. Routed at
 * `projects/:projectId/board` (see `app.routes.ts`), with a back-to-projects
 * link (spec: projects-ui, Cross-Feature Navigation Links).
 */
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, RouterLink],
  template: `
    <div class="board" cdkDropListGroup>
      <a routerLink="/projects" data-testid="board-projects-link">Volver a proyectos</a>

      @if (error(); as message) {
        <p data-testid="board-error" class="board-error">{{ message }}</p>
      }
      @for (column of columns(); track column.id) {
        <section class="board-column">
          <h3 data-testid="column-name">{{ column.name }}</h3>
          <div
            class="board-column-list"
            cdkDropList
            [id]="'column-' + column.id"
            [cdkDropListData]="column.id"
            (cdkDropListDropped)="onDrop($event)"
          >
            @for (item of columnItems(column.id); track item.id) {
              <div class="board-card" cdkDrag [cdkDragData]="item">
                <span data-testid="work-item-title">{{ item.title }}</span>
              </div>
            }
          </div>
        </section>
      }
    </div>
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
