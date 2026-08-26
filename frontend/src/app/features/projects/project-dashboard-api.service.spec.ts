import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProjectDashboardApiService } from './project-dashboard-api.service';
import { ProjectDashboard } from './project-dashboard.model';

function dashboard(): ProjectDashboard {
  return {
    totalItems: 3,
    completedItems: 1,
    columnCounts: [],
    activeSprint: null,
    activeSprintTotalItems: 0,
    activeSprintCompletedItems: 0,
    backlogPendingCount: 2,
    workload: [],
    priorityDistribution: {},
  };
}

describe('ProjectDashboardApiService', () => {
  let service: ProjectDashboardApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectDashboardApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProjectDashboardApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('gets the dashboard for a project', () => {
    service.get(10).subscribe();

    const request = httpMock.expectOne('/api/projects/10/dashboard');
    expect(request.request.method).toBe('GET');
    request.flush(dashboard());
  });
});
