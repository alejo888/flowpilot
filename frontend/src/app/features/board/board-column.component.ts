import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, input, output } from '@angular/core';

import { FpBadgeComponent } from '../../shared/ui/badge.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { BoardColumn, WorkItem } from './board.model';

/**
 * One kanban column: its heading plus a CDK drop list of work-item cards.
 *
 * Attribute selector on `<section>` so the board keeps rendering
 * `section.board-column` with no extra wrapper element (the e2e specs locate
 * columns by that selector, and the board styles the host for layout, the
 * per-column accent and the mobile tab hiding). The drop list connects to its
 * siblings through the board's `cdkDropListGroup`, which CDK resolves through
 * the element injector across this component boundary.
 */
@Component({
  selector: 'section[fpBoardColumn]',
  standalone: true,
  imports: [CdkDropList, CdkDrag, FpBadgeComponent, FpCardComponent],
  template: `
    <h3 data-testid="column-name" class="board-column-name">{{ column().name }}</h3>
    <div
      class="board-column-list"
      cdkDropList
      [id]="'column-' + column().id"
      [cdkDropListData]="column().id"
      (cdkDropListDropped)="itemDropped.emit($event)"
    >
      @for (item of items(); track item.id) {
        <fp-card class="board-card" cdkDrag [cdkDragData]="item" [cdkDragDisabled]="!canMove()">
          <button class="card-title" type="button" (click)="itemOpened.emit(item)">
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
  `,
  styleUrl: './board-column.component.scss',
})
export class BoardColumnComponent {
  readonly column = input.required<BoardColumn>();
  /** The column's cards, already ordered by position. */
  readonly items = input.required<WorkItem[]>();
  /** Caller holds `WORKITEM_MOVE`; without it dragging itself is disabled (not just the drop handler). */
  readonly canMove = input.required<boolean>();

  /** A card was dropped on this column's list (data = target column id). */
  readonly itemDropped = output<CdkDragDrop<number, number, WorkItem>>();
  /** A card title was clicked. */
  readonly itemOpened = output<WorkItem>();
}
