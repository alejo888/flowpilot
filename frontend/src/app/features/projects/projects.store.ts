import { Injectable, inject, signal } from '@angular/core';

import { Project, ProjectCreateRequest, ProjectStatus, ProjectUpdateRequest } from './project.model';
import { ProjectsApiService } from './projects-api.service';

@Injectable({ providedIn: 'root' })
export class ProjectsStore {
  private readonly api = inject(ProjectsApiService);
  private readonly projectsSignal = signal<Project[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly creatingSignal = signal(false);
  private readonly detailLoadingSignal = signal(false);
  private readonly savingSignal = signal(false);
  private readonly deletingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly lastCreatedSignal = signal<Project | null>(null);
  private readonly selectedProjectSignal = signal<Project | null>(null);

  readonly projects = this.projectsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly creating = this.creatingSignal.asReadonly();
  readonly detailLoading = this.detailLoadingSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();
  readonly deleting = this.deletingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly lastCreated = this.lastCreatedSignal.asReadonly();
  readonly selectedProject = this.selectedProjectSignal.asReadonly();

  loadProjects(): void {
    this.errorSignal.set(null); this.loadingSignal.set(true);
    this.api.listProjects().subscribe({
      next: (projects) => { this.projectsSignal.set(projects); this.loadingSignal.set(false); },
      error: (err: unknown) => { this.errorSignal.set(errorMessage(err, 'No se pudieron cargar los proyectos')); this.loadingSignal.set(false); },
    });
  }

  createProject(request: ProjectCreateRequest): void {
    this.errorSignal.set(null); this.lastCreatedSignal.set(null); this.creatingSignal.set(true);
    this.api.createProject(request).subscribe({
      next: (created) => { this.projectsSignal.set([...this.projectsSignal(), created]); this.lastCreatedSignal.set(created); this.creatingSignal.set(false); },
      error: (err: unknown) => { this.errorSignal.set(errorMessage(err, 'No se pudo crear el proyecto')); this.creatingSignal.set(false); },
    });
  }

  loadProject(id: number): void {
    this.errorSignal.set(null); this.selectedProjectSignal.set(null); this.detailLoadingSignal.set(true);
    this.api.getProject(id).subscribe({
      next: (project) => { this.selectedProjectSignal.set(project); this.detailLoadingSignal.set(false); },
      error: (err: unknown) => { this.errorSignal.set(errorMessage(err, 'No se pudo cargar el proyecto')); this.detailLoadingSignal.set(false); },
    });
  }

  updateProject(id: number, request: ProjectUpdateRequest): void {
    this.errorSignal.set(null); this.savingSignal.set(true);
    this.api.updateProject(id, request).subscribe({
      next: (project) => { this.selectedProjectSignal.set(project); this.replaceProject(project); this.savingSignal.set(false); },
      error: (err: unknown) => { this.errorSignal.set(errorMessage(err, 'No se pudo actualizar el proyecto')); this.savingSignal.set(false); },
    });
  }

  updateProjectStatus(id: number, status: ProjectStatus): void {
    this.errorSignal.set(null); this.savingSignal.set(true);
    this.api.updateProjectStatus(id, { status }).subscribe({
      next: (project) => { this.selectedProjectSignal.set(project); this.replaceProject(project); this.savingSignal.set(false); },
      error: (err: unknown) => { this.errorSignal.set(errorMessage(err, 'No se pudo actualizar el estado')); this.savingSignal.set(false); },
    });
  }

  deleteProject(id: number): Promise<boolean> {
    this.errorSignal.set(null); this.deletingSignal.set(true);
    return new Promise((resolve) => this.api.deleteProject(id).subscribe({
      next: () => {
        this.projectsSignal.set(this.projectsSignal().filter((project) => project.id !== id)); this.selectedProjectSignal.set(null);
        this.deletingSignal.set(false); resolve(true);
      },
      error: (err: unknown) => {
        this.errorSignal.set(errorMessage(err, 'No se pudo eliminar el proyecto')); this.deletingSignal.set(false); resolve(false);
      },
    }));
  }

  private replaceProject(project: Project): void {
    this.projectsSignal.set(this.projectsSignal().map((item) => item.id === project.id ? project : item));
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}
