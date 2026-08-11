import { Injectable, computed, inject, signal } from '@angular/core';

import { BoardApiService } from './board-api.service';
import { BoardColumn, WorkItem } from './board.model';

/**
 * Signals-based board state (design D6 — signals + injectable services, no
 * NgRx). Holds columns + work items for one project and exposes
 * {@link itemsByColumn} grouped/ordered for rendering. {@link moveItem}
 * applies an optimistic local update immediately, then confirms against the
 * server; a rejected move (e.g. cross-project column, 400/403) rolls the
 * local state back to its pre-move snapshot and surfaces the error message.
 */
@Injectable({ providedIn: 'root' })
export class BoardStore {
  private readonly api = inject(BoardApiService);

  private readonly columnsSignal = signal<BoardColumn[]>([]);
  private readonly itemsSignal = signal<WorkItem[]>([]);
  private readonly errorSignal = signal<string | null>(null);

  readonly columns = this.columnsSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  /** Work items grouped by columnId, each group ordered by position ascending. */
  readonly itemsByColumn = computed<Record<number, WorkItem[]>>(() => {
    const grouped: Record<number, WorkItem[]> = {};
    for (const item of this.itemsSignal()) {
      const bucket = grouped[item.columnId] ?? (grouped[item.columnId] = []);
      bucket.push(item);
    }
    for (const bucket of Object.values(grouped)) {
      bucket.sort((a, b) => a.position - b.position);
    }
    return grouped;
  });

  load(projectId: number): void {
    this.errorSignal.set(null);
    this.api.getBoardColumns(projectId).subscribe((columns) => this.columnsSignal.set(columns));
    this.api.getWorkItems(projectId).subscribe((items) => this.itemsSignal.set(items));
  }

  /**
   * Moves `itemId` into `targetColumnId` at zero-based `index` among that
   * column's OTHER items. Applies the change optimistically, then confirms
   * with the server; rolls back on error.
   */
  moveItem(itemId: number, targetColumnId: number, index: number): void {
    const previousItems = this.itemsSignal();
    const movingItem = previousItems.find((i) => i.id === itemId);
    if (!movingItem) {
      return;
    }

    this.errorSignal.set(null);
    this.itemsSignal.set(
      previousItems.map((item) =>
        item.id === itemId ? { ...item, columnId: targetColumnId, position: index } : item,
      ),
    );

    this.api.moveWorkItem(itemId, { columnId: targetColumnId, position: index }).subscribe({
      next: (confirmed) => {
        this.itemsSignal.set(
          this.itemsSignal().map((item) => (item.id === itemId ? confirmed : item)),
        );
      },
      error: (err: unknown) => {
        this.itemsSignal.set(previousItems);
        this.errorSignal.set(err instanceof Error ? err.message : 'Failed to move work item');
      },
    });
  }
}
