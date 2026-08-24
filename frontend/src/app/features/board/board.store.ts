import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { BoardApiService } from './board-api.service';
import { BoardColumn, WorkItem, WorkItemCreateRequest, WorkItemUpdateRequest } from './board.model';

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
  private readonly selectedItemSignal = signal<WorkItem | null>(null);
  private readonly errorSignal = signal<string | null>(null);
  private readonly successSignal = signal<string | null>(null);
  private readonly mutatingSignal = signal(false);
  private loadRequestId = 0;
  private detailRequestId = 0;

  readonly columns = this.columnsSignal.asReadonly();
  readonly selectedItem = this.selectedItemSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly success = this.successSignal.asReadonly();
  readonly isMutating = this.mutatingSignal.asReadonly();

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
    const requestId = ++this.loadRequestId;
    this.clearFeedback();
    this.detailRequestId++;
    this.selectedItemSignal.set(null);
    forkJoin({
      columns: this.api.getBoardColumns(projectId),
      items: this.api.getWorkItems(projectId),
    }).subscribe({
      next: ({ columns, items }) => {
        if (requestId !== this.loadRequestId) {
          return;
        }
        this.columnsSignal.set(columns);
        this.itemsSignal.set(items);
      },
      error: (err: unknown) => {
        if (requestId !== this.loadRequestId) {
          return;
        }
        this.columnsSignal.set([]);
        this.itemsSignal.set([]);
        this.errorSignal.set(errorMessage(err, 'No se pudo cargar el tablero'));
      },
    });
  }

  createItem(projectId: number, request: WorkItemCreateRequest): void {
    this.beginMutation();
    this.api.createWorkItem(projectId, request).subscribe({
      next: (created) => {
        this.itemsSignal.set([...this.itemsSignal(), created]);
        this.selectedItemSignal.set(created);
        this.successSignal.set('Tarea creada correctamente.');
        this.mutatingSignal.set(false);
      },
      error: (err: unknown) => this.failMutation(err, 'No se pudo crear la tarea'),
    });
  }

  selectItem(item: WorkItem | null): void {
    this.detailRequestId++;
    this.clearFeedback();
    this.selectedItemSignal.set(item);
  }

  loadItem(itemId: number): void {
    const requestId = ++this.detailRequestId;
    this.clearFeedback();
    this.api.getWorkItem(itemId).subscribe({
      next: (item) => {
        const selectedItem = this.selectedItemSignal();
        if (requestId !== this.detailRequestId || (selectedItem !== null && selectedItem.id !== itemId)) {
          return;
        }
        this.upsertItem(item);
        this.selectedItemSignal.set(item);
      },
      error: (err: unknown) => {
        if (requestId === this.detailRequestId) {
          this.errorSignal.set(errorMessage(err, 'No se pudo cargar la tarea'));
        }
      },
    });
  }

  updateItem(itemId: number, request: WorkItemUpdateRequest): void {
    this.beginMutation();
    this.api.updateWorkItem(itemId, request).subscribe({
      next: (updated) => {
        this.upsertItem(updated);
        this.selectedItemSignal.set(updated);
        this.mutatingSignal.set(false);
      },
      error: (err: unknown) => this.failMutation(err, 'No se pudo actualizar la tarea'),
    });
  }

  deleteItem(itemId: number): void {
    this.detailRequestId++;
    this.beginMutation();
    this.api.deleteWorkItem(itemId).subscribe({
      next: () => {
        this.itemsSignal.set(this.itemsSignal().filter((item) => item.id !== itemId));
        if (this.selectedItemSignal()?.id === itemId) {
          this.selectedItemSignal.set(null);
        }
        this.mutatingSignal.set(false);
      },
      error: (err: unknown) => this.failMutation(err, 'No se pudo eliminar la tarea'),
    });
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

    this.clearFeedback();
    this.itemsSignal.set(
      previousItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              columnId: targetColumnId,
              position: optimisticPosition(previousItems, movingItem, targetColumnId, index),
            }
          : item,
      ),
    );

    this.api.moveWorkItem(itemId, { columnId: targetColumnId, position: index }).subscribe({
      next: (confirmed) => {
        this.upsertItem(confirmed);
        // affectedItems is populated only when the target column's siblings
        // were re-sequenced server-side (design D10) — apply the full set
        // so they don't go stale in local state until a full reload.
        for (const affected of confirmed.affectedItems ?? []) {
          this.upsertItem(affected);
        }
        if (this.selectedItemSignal()?.id === itemId) {
          this.selectedItemSignal.set(confirmed);
        }
      },
      error: (err: unknown) => {
        this.itemsSignal.set(previousItems);
        this.errorSignal.set(errorMessage(err, 'No se pudo mover la tarea'));
      },
    });
  }

  clearSuccess(): void {
    this.successSignal.set(null);
  }

  private clearFeedback(): void {
    this.errorSignal.set(null);
    this.successSignal.set(null);
  }

  private beginMutation(): void {
    this.clearFeedback();
    this.mutatingSignal.set(true);
  }

  private failMutation(err: unknown, fallback: string): void {
    this.successSignal.set(null);
    this.errorSignal.set(errorMessage(err, fallback));
    this.mutatingSignal.set(false);
  }

  private upsertItem(nextItem: WorkItem): void {
    const items = this.itemsSignal();
    if (items.some((item) => item.id === nextItem.id)) {
      this.itemsSignal.set(items.map((item) => (item.id === nextItem.id ? nextItem : item)));
      return;
    }
    this.itemsSignal.set([...items, nextItem]);
  }
}

/**
 * `HttpErrorResponse` implements `Error` but does not extend it, so
 * `err instanceof Error` is always false for real HTTP failures — reads the
 * RFC 7807 `detail` field the backend actually sends instead (design
 * pattern from `AuthStore`/`AdminUsersStore`).
 */
function errorMessage(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}

function optimisticPosition(items: WorkItem[], movingItem: WorkItem, targetColumnId: number, index: number): number {
  const targetItems = items
    .filter((item) => item.columnId === targetColumnId && item.id !== movingItem.id)
    .sort((a, b) => a.position - b.position);
  const targetIndex = Math.max(0, Math.min(index, targetItems.length));
  const before = targetItems[targetIndex - 1];
  const after = targetItems[targetIndex];

  if (!before && !after) {
    return movingItem.position;
  }
  if (!before) {
    return after.position - 1;
  }
  if (!after) {
    return before.position + 1;
  }
  return before.position + (after.position - before.position) / 2;
}
