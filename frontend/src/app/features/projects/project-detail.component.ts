import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { FpBadgeComponent } from '../../shared/ui/badge.component';
import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpDialogComponent } from '../../shared/ui/dialog.component';
import { FpInputComponent } from '../../shared/ui/input.component';
import { FpSelectComponent } from '../../shared/ui/select.component';
import { ProjectStatus } from './project.model';
import { projectStatusBadgeVariant } from './project-status';
import { ProjectsStore } from './projects.store';

const STATUS_OPTIONS = [
  { value: 'PLANIFICACION', label: 'Planificación' },
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'PAUSADO', label: 'Pausado' },
  { value: 'FINALIZADO', label: 'Finalizado' },
  { value: 'CANCELADO', label: 'Cancelado' },
] as const;

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, FpBadgeComponent, FpButtonComponent, FpCardComponent, FpDialogComponent, FpInputComponent, FpSelectComponent],
  template: `
    <main class="project-detail">
      @if (loading()) { <p data-testid="project-detail-loading">Cargando proyecto…</p> }
      @if (error(); as message) { <p data-testid="project-detail-error" class="error">{{ message }}</p> }
      @if (project(); as current) {
        <header class="detail-header">
          <div><a [routerLink]="['/projects', projectId(), 'backlog']" class="project-link">Backlog y sprints</a> <a [routerLink]="['/projects', projectId(), 'dashboard']" class="project-link">Dashboard</a><p class="eyebrow">Proyecto</p><h1 data-testid="project-detail-name">{{ current.name }}</h1></div>
          <fp-badge [variant]="statusBadgeVariant(current.status)" data-testid="project-detail-status">{{ current.status }}</fp-badge>
        </header>
        <fp-card><div class="summary">
          <p data-testid="project-detail-description">{{ current.description || 'Sin descripción' }}</p>
          @if (current.code) { <span data-testid="project-detail-code">{{ current.code }}</span> }
          @if (current.technologies) { <span data-testid="project-detail-technologies">{{ current.technologies }}</span> }
          <span>Actualizado {{ current.updatedAt | date: 'd MMM y' }}</span>
        </div></fp-card>
        <fp-card><form data-testid="project-edit-form" (submit)="onSubmit($event)">
          <h2>Editar proyecto</h2>
          <fp-input label="Nombre" testId="project-edit-name" [value]="name()" [required]="true" (valueChange)="name.set($event)" />
          <fp-input label="Descripción" testId="project-edit-description" [value]="description()" (valueChange)="description.set($event)" />
          <fp-input label="Código" testId="project-edit-code" [value]="code()" (valueChange)="code.set($event)" />
          <fp-input label="Fecha de inicio" type="date" testId="project-edit-start-date" [value]="startDate()" (valueChange)="startDate.set($event)" />
          <fp-input label="Fecha estimada de fin" type="date" testId="project-edit-estimated-end-date" [value]="estimatedEndDate()" (valueChange)="estimatedEndDate.set($event)" />
          <fp-input label="Tecnologías" testId="project-edit-technologies" [value]="technologies()" (valueChange)="technologies.set($event)" />
          <fp-input label="URL del repositorio" type="url" testId="project-edit-repository-url" [value]="repositoryUrl()" (valueChange)="repositoryUrl.set($event)" />
          <fp-button type="submit" testId="project-edit-submit" [disabled]="saving()">Guardar cambios</fp-button>
        </form></fp-card>
        <fp-card><div class="actions">
          <fp-select label="Estado" testId="project-status-select" [value]="current.status" [options]="statusOptions" [disabled]="saving()" (valueChange)="onStatusChange($event)" />
          <fp-button variant="danger" testId="project-delete" [disabled]="deleting()" (click)="confirmingDelete.set(true)">Eliminar proyecto</fp-button>
        </div></fp-card>
      }
      @if (confirmingDelete()) { <fp-dialog data-testid="project-delete-dialog" label="project-delete-dialog-title" describedById="project-delete-dialog-description" (closed)="confirmingDelete.set(false)"><h2 id="project-delete-dialog-title">Eliminar proyecto</h2><p id="project-delete-dialog-description">¿Seguro que querés eliminar este proyecto? Esta acción no se puede deshacer.</p><div class="actions"><fp-button variant="danger" testId="project-delete-confirm" (click)="onDelete()">Sí, eliminar</fp-button><fp-button variant="secondary" testId="project-delete-cancel" (click)="confirmingDelete.set(false)">Cancelar</fp-button></div></fp-dialog> }
    </main>
  `,
  styles: `
    .project-detail { display:flex; flex-direction:column; gap:var(--fp-space-6); padding:var(--fp-space-8); max-width:900px; }
    .detail-header,.actions { display:flex; align-items:center; justify-content:space-between; gap:var(--fp-space-4); }
    h1,h2,.eyebrow { margin:0; font-family:var(--fp-font-display); color:var(--fp-text); } h1 { font-size:2rem; } h2 { font-size:1.25rem; margin-bottom:var(--fp-space-4); }
    /* Explicit font-weight (kept at the pre-redesign normal weight) so this
       accent-colored local variant stays independent of the global
       .eyebrow utility promoted in PR6a, which sets font-weight: 700 —
       see PR6a verify-report WARNING 7. This is a deliberate "stay normal"
       decision, not an accident. */
    .eyebrow { color:var(--fp-accent); text-transform:uppercase; letter-spacing:.12em; font-size:.75rem; font-weight:400; }
    form,.summary { display:flex; flex-direction:column; gap:var(--fp-space-4); } .summary span { color:var(--fp-text-muted); font-size:.875rem; } .error { color:var(--fp-danger); }
  `,
})
export class ProjectDetailComponent {
  private readonly store = inject(ProjectsStore);
  private readonly router = inject(Router);
  readonly projectId = input.required<number, string>({ transform: numberAttribute });
  readonly project = this.store.selectedProject;
  readonly loading = this.store.detailLoading;
  readonly saving = this.store.saving;
  readonly deleting = this.store.deleting;
  readonly error = this.store.error;
  readonly statusOptions = STATUS_OPTIONS;
  protected readonly statusBadgeVariant = projectStatusBadgeVariant;
  readonly name = signal(''); readonly description = signal(''); readonly code = signal(''); readonly startDate = signal(''); readonly estimatedEndDate = signal(''); readonly technologies = signal(''); readonly repositoryUrl = signal('');
  readonly confirmingDelete = signal(false);

  constructor() {
    effect(() => {
      this.projectId();
      this.resetEditState();
      this.confirmingDelete.set(false);
      this.store.loadProject(this.projectId());
    });
    effect(() => {
      const p = this.project();
      if (p) {
        this.name.set(p.name); this.description.set(p.description ?? ''); this.code.set(p.code ?? '');
        this.startDate.set(p.startDate ?? ''); this.estimatedEndDate.set(p.estimatedEndDate ?? '');
        this.technologies.set(p.technologies ?? ''); this.repositoryUrl.set(p.repositoryUrl ?? '');
      }
    });
  }
  onSubmit(event: Event): void { event.preventDefault(); const name = this.name().trim(); if (!name) return; this.store.updateProject(this.projectId(), { name, description: blank(this.description()), code: blank(this.code()), startDate: blank(this.startDate()), estimatedEndDate: blank(this.estimatedEndDate()), technologies: blank(this.technologies()), repositoryUrl: blank(this.repositoryUrl()) }); }
  onStatusChange(value: string): void { if (value) this.store.updateProjectStatus(this.projectId(), value as ProjectStatus); }
  async onDelete(): Promise<void> {
    const deleted = await this.store.deleteProject(this.projectId());
    if (!deleted) return;
    this.confirmingDelete.set(false);
    await this.router.navigate(['/projects']);
  }

  private resetEditState(): void {
    this.name.set(''); this.description.set(''); this.code.set(''); this.startDate.set('');
    this.estimatedEndDate.set(''); this.technologies.set(''); this.repositoryUrl.set('');
  }
}
function blank(value: string): string | null { const trimmed = value.trim(); return trimmed ? trimmed : null; }
