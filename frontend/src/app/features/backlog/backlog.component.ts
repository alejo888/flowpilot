import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { WorkItem } from '../board/board.model';
import { FpBadgeComponent } from '../../shared/ui/badge.component';
import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpInputComponent } from '../../shared/ui/input.component';
import { FpSelectComponent } from '../../shared/ui/select.component';
import { BacklogStore } from './backlog.store';
import { Sprint } from './backlog.model';

@Component({
  selector: 'app-backlog',
  standalone: true,
  imports: [
    RouterLink,
    NgTemplateOutlet,
    FpBadgeComponent,
    FpButtonComponent,
    FpCardComponent,
    FpInputComponent,
    FpSelectComponent,
  ],
  template: `
    <main class="backlog">
      <header class="backlog-header">
        <div>
          <a [routerLink]="['/projects', projectId()]">← Proyecto</a>
          <p class="eyebrow">Planificación</p>
          <h1>Backlog y sprints</h1>
        </div>
      </header>

      @if (store.error(); as error) {
        <p class="error" role="alert" data-testid="backlog-error">{{ error }}</p>
      }
      @if (store.success(); as success) {
        <p class="success" role="status">{{ success }}</p>
      }
      @if (store.loading()) {
        <p data-testid="backlog-loading" role="status">Cargando backlog…</p>
      } @else {
        <fp-card>
          <form class="sprint-form" (submit)="createSprint($event)">
            <h2>Nuevo sprint</h2>
            <fp-input
              label="Nombre"
              testId="sprint-name"
              [value]="name()"
              [required]="true"
              (valueChange)="name.set($event)"
            />
            <fp-input
              label="Objetivo"
              testId="sprint-goal"
              [value]="goal()"
              (valueChange)="goal.set($event)"
            />
            <label>Inicio <input data-testid="sprint-start" type="date" [value]="startDate()" (input)="startDate.set(inputValue($event))" required /></label>
            <label>Fin <input data-testid="sprint-end" type="date" [value]="endDate()" (input)="endDate.set(inputValue($event))" required /></label>
            <fp-button type="submit" [disabled]="store.mutating()">Crear sprint</fp-button>
          </form>
        </fp-card>

        <section class="columns" aria-label="Backlog y sprints">
          <fp-card>
            <h2>Backlog</h2>
            <p class="hint">Sin sprint asignado</p>
            @if (store.backlogItems().length === 0) {
              <p data-testid="backlog-empty">No hay tareas pendientes de planificar.</p>
            } @else {
              @for (item of store.backlogItems(); track item.id) {
                <ng-container *ngTemplateOutlet="itemTemplate; context: {$implicit: item}" />
              }
            }
          </fp-card>

          @for (sprint of store.sprints(); track sprint.id) {
            <fp-card>
              <div class="sprint-heading">
                <div>
                  <h2>{{ sprint.name }}</h2>
                  <p>{{ sprint.startDate }} → {{ sprint.endDate }}</p>
                </div>
                <fp-badge>{{ sprint.status }}</fp-badge>
              </div>
              <p>{{ sprint.goal || 'Sin objetivo definido' }}</p>
              @if (sprint.status === 'PLANNED') {
                <fp-button (click)="store.startSprint(sprint)" [disabled]="store.mutating()">Iniciar sprint</fp-button>
              }
              @if (sprint.status === 'ACTIVE') {
                <fp-button (click)="store.completeSprint(sprint)" [disabled]="store.mutating()">Completar sprint</fp-button>
              }
              <div class="items">
                @for (item of itemsFor(sprint); track item.id) {
                  <ng-container *ngTemplateOutlet="itemTemplate; context: {$implicit: item}" />
                }
                @if (itemsFor(sprint).length === 0) {
                  <p class="hint">No hay tareas asignadas.</p>
                }
              </div>
            </fp-card>
          }

          @if (store.sprints().length === 0) {
            <p data-testid="sprints-empty">Todavía no hay sprints.</p>
          }
        </section>
      }
    </main>

    <ng-template #itemTemplate let-item>
      <article class="item">
        <strong>{{ item.title }}</strong>
        <span>{{ item.assignedUserName || 'Sin asignar' }}</span>
        <fp-select
          label="Sprint"
          [value]="item.sprintId?.toString() ?? ''"
          [options]="sprintOptions()"
          placeholder="Backlog"
          [testId]="'item-sprint-' + item.id"
          (valueChange)="assign(item, $event)"
        />
      </article>
    </ng-template>
  `,
  styles: `
    .backlog {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-6);
      padding: var(--fp-space-8);
      max-width: 1100px;
    }
    .backlog-header a { color: var(--fp-accent); text-decoration: none; }
    .eyebrow { margin: var(--fp-space-3) 0 0; color: var(--fp-accent); font-size: .75rem; letter-spacing: .12em; text-transform: uppercase; }
    h1, h2 { font-family: var(--fp-font-display); color: var(--fp-text); margin: 0; }
    h1 { font-size: 2rem; }
    .sprint-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--fp-space-4); align-items: end; }
    .sprint-form h2, .sprint-form fp-button { grid-column: 1 / -1; }
    .sprint-form label { display: flex; flex-direction: column; gap: var(--fp-space-1); color: var(--fp-text-muted); font-size: .875rem; font-weight: 600; }
    .sprint-form input { padding: var(--fp-space-2); border: 1px solid var(--fp-border); border-radius: var(--fp-radius-sm); font: inherit; }
    .columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--fp-space-4); }
    .columns fp-card { display: flex; flex-direction: column; gap: var(--fp-space-3); }
    .sprint-heading { display: flex; justify-content: space-between; gap: var(--fp-space-3); }
    .sprint-heading p, .hint, .item span { margin: var(--fp-space-1) 0 0; color: var(--fp-text-muted); font-size: .875rem; }
    .items { display: flex; flex-direction: column; gap: var(--fp-space-2); border-top: 1px solid var(--fp-border); padding-top: var(--fp-space-3); }
    .item { display: flex; flex-direction: column; gap: var(--fp-space-1); padding: var(--fp-space-3); border: 1px solid var(--fp-border); border-radius: var(--fp-radius-sm); }
    .error { color: var(--fp-danger); }
    .success { color: var(--fp-success); }
    @media (max-width: 600px) { .backlog { padding: var(--fp-space-4); } .sprint-form { grid-template-columns: 1fr; } }
  `,
})
export class BacklogComponent implements OnInit {
  readonly projectId = input.required<number, string>({ transform: numberAttribute });
  readonly store = inject(BacklogStore);

  readonly name = signal('');
  readonly goal = signal('');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly sprintOptions = computed(() =>
    this.store.sprints().map((sprint) => ({ value: String(sprint.id), label: sprint.name })),
  );

  constructor() {
    effect(() => {
      const id = this.projectId();
      if (id) {
        this.store.load(id);
      }
    });
  }

  ngOnInit(): void {
    // The route input effect performs the initial load.
  }

  itemsFor(sprint: Sprint): WorkItem[] {
    return this.store.itemsBySprint()[sprint.id] ?? [];
  }

  createSprint(event: Event): void {
    event.preventDefault();
    if (!this.name().trim() || !this.startDate() || !this.endDate()) {
      return;
    }

    this.store.createSprint(this.projectId(), {
      name: this.name().trim(),
      goal: this.goal().trim() || null,
      startDate: this.startDate(),
      endDate: this.endDate(),
    });
  }

  assign(item: WorkItem, value: string): void {
    this.store.assignItem(item, value ? Number(value) : null);
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
