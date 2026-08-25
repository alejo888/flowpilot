import { Injectable, inject, signal } from '@angular/core';
import { ProjectDashboardApiService } from './project-dashboard-api.service';
import { ProjectDashboard } from './project-dashboard.model';

@Injectable({ providedIn: 'root' })
export class ProjectDashboardStore {
  private readonly api = inject(ProjectDashboardApiService);
  private loadRequestId = 0;
  readonly dashboard = signal<ProjectDashboard | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  load(projectId: number): void {
    // `loadRequestId` guards against out-of-order responses (same pattern as
    // BoardStore.load): a slow request for project A that resolves after a
    // newer request for project B must not overwrite B's data.
    const requestId = ++this.loadRequestId;
    this.loading.set(true); this.error.set(null);
    // Cleared up front, not just on error: this store is providedIn:'root'
    // (a singleton across route navigations), so leaving project A's metrics
    // in place while project B's dashboard loads would render stale
    // cross-project data under the new route (same fix as BacklogStore.load).
    this.dashboard.set(null);
    this.api.get(projectId).subscribe({
      next: d => { if (requestId !== this.loadRequestId) return; this.dashboard.set(d); this.loading.set(false); },
      error: (err: unknown) => { if (requestId !== this.loadRequestId) return; this.dashboard.set(null); this.error.set(errorMessage(err, 'No se pudo cargar el dashboard')); this.loading.set(false); },
    });
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}
