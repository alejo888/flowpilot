import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';

import { WorkItem } from '../board/board.model';
import { BacklogApiService } from './backlog-api.service';
import { Sprint, SprintRequest } from './backlog.model';

@Injectable({ providedIn: 'root' })
export class BacklogStore {
  private readonly api = inject(BacklogApiService);
  private readonly itemsSignal = signal<WorkItem[]>([]);
  private readonly sprintsSignal = signal<Sprint[]>([]);

  readonly items = this.itemsSignal.asReadonly();
  readonly sprints = this.sprintsSignal.asReadonly();
  readonly backlogItems = computed(() =>
    this.itemsSignal().filter((item) => item.sprintId == null),
  );
  readonly itemsBySprint = computed(() => {
    const groups: Record<number, WorkItem[]> = {};

    for (const item of this.itemsSignal()) {
      if (item.sprintId != null) {
        (groups[item.sprintId] ??= []).push(item);
      }
    }

    return groups;
  });

  readonly loading = signal(false);
  readonly mutating = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  load(projectId: number): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      items: this.api.getWorkItems(projectId),
      sprints: this.api.listSprints(projectId),
    }).subscribe({
      next: ({ items, sprints }) => {
        this.itemsSignal.set(items);
        this.sprintsSignal.set(sprints);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(message(err, 'No se pudo cargar el backlog'));
      },
    });
  }

  createSprint(projectId: number, request: SprintRequest): void {
    this.mutate(this.api.createSprint(projectId, request), (created) => {
      this.sprintsSignal.set([...this.sprintsSignal(), created]);
    });
  }

  startSprint(sprint: Sprint): void {
    this.mutate(this.api.startSprint(sprint.id), (updated) => this.replaceSprint(updated));
  }

  completeSprint(sprint: Sprint): void {
    this.mutate(this.api.completeSprint(sprint.id), (updated) => this.replaceSprint(updated));
  }

  assignItem(item: WorkItem, sprintId: number | null): void {
    this.mutate(
      this.api.updateWorkItemSprint(item.id, {
        title: item.title,
        description: item.description,
        assignedUserId: item.assignedUserId,
        sprintId,
      }),
      (updated) => {
        this.itemsSignal.set(
          this.itemsSignal().map((current) => (current.id === updated.id ? updated : current)),
        );
      },
    );
  }

  private replaceSprint(updated: Sprint): void {
    this.sprintsSignal.set(
      this.sprintsSignal().map((current) => (current.id === updated.id ? updated : current)),
    );
  }

  private mutate<T>(request: Observable<T>, onSuccess: (value: T) => void): void {
    this.mutating.set(true);
    this.error.set(null);
    this.success.set(null);

    request.subscribe({
      next: (value) => {
        onSuccess(value);
        this.mutating.set(false);
        this.success.set('Cambios guardados.');
      },
      error: (err) => {
        this.mutating.set(false);
        this.error.set(message(err, 'No se pudo guardar el cambio'));
      },
    });
  }
}

function message(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}
