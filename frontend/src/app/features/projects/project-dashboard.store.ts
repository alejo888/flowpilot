import { Injectable, inject, signal } from '@angular/core';
import { ProjectDashboardApiService } from './project-dashboard-api.service';
import { ProjectDashboard } from './project-dashboard.model';

@Injectable({ providedIn: 'root' })
export class ProjectDashboardStore {
  private readonly api = inject(ProjectDashboardApiService);
  readonly dashboard = signal<ProjectDashboard | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  load(projectId: number): void {
    this.loading.set(true); this.error.set(null);
    this.api.get(projectId).subscribe({ next: d => { this.dashboard.set(d); this.loading.set(false); }, error: () => { this.dashboard.set(null); this.error.set('No se pudo cargar el dashboard'); this.loading.set(false); } });
  }
}
