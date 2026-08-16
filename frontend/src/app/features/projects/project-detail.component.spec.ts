import { Component, ViewChild, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, withComponentInputBinding } from '@angular/router';

import { Project } from './project.model';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectsStore } from './projects.store';

function project(id = 4): Project {
  return {
    id,
    name: 'Proyecto detalle',
    description: 'Descripción',
    status: 'PLANIFICACION',
    ownerId: 7,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    code: 'PRJ4',
    startDate: '2026-01-01',
    estimatedEndDate: '2026-06-01',
    technologies: 'Angular',
    repositoryUrl: 'https://github.com/org/repo',
  };
}

describe('ProjectDetailComponent', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let storeStub: {
    selectedProject: ReturnType<typeof signal<Project | null>>;
    detailLoading: ReturnType<typeof signal<boolean>>;
    saving: ReturnType<typeof signal<boolean>>;
    deleting: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    loadProject: ReturnType<typeof vi.fn>;
    updateProject: ReturnType<typeof vi.fn>;
    updateProjectStatus: ReturnType<typeof vi.fn>;
    deleteProject: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    storeStub = {
      selectedProject: signal(project()),
      detailLoading: signal(false),
      saving: signal(false),
      deleting: signal(false),
      error: signal(null),
      loadProject: vi.fn(),
      updateProject: vi.fn(),
      updateProjectStatus: vi.fn(),
      deleteProject: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [ProjectDetailComponent],
      providers: [provideRouter([]), { provide: ProjectsStore, useValue: storeStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailComponent);
    fixture.componentRef.setInput('projectId', 4);
    fixture.detectChanges();
  });

  it('loads the requested project and renders its detail fields', () => {
    expect(storeStub.loadProject).toHaveBeenCalledWith(4);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="project-detail-name"]')?.textContent).toContain('Proyecto detalle');
    expect(compiled.querySelector('[data-testid="project-detail-code"]')?.textContent).toContain('PRJ4');
    expect(compiled.querySelector('[data-testid="project-detail-technologies"]')?.textContent).toContain('Angular');
  });

  it('reloads and resets edit state when the route reuses the component for another project', async () => {
    storeStub.selectedProject.set(null);
    fixture.componentInstance.name.set('Unsaved edit');

    fixture.componentRef.setInput('projectId', 9);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(storeStub.loadProject).toHaveBeenLastCalledWith(9);
    expect(fixture.componentInstance.name()).toBe('');
    expect(fixture.componentInstance.confirmingDelete()).toBe(false);
  });

  it('normalizes route-bound project IDs before every store operation', async () => {
    fixture.componentRef.setInput('projectId', '12');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.projectId()).toBe(12);
    expect(storeStub.loadProject).toHaveBeenLastCalledWith(12);

    fixture.componentInstance.name.set('Proyecto actualizado');
    fixture.componentInstance.onSubmit(new Event('submit'));
    fixture.componentInstance.onStatusChange('ACTIVO');
    storeStub.deleteProject.mockResolvedValue(false);
    await fixture.componentInstance.onDelete();

    expect(storeStub.updateProject).toHaveBeenLastCalledWith(12, expect.any(Object));
    expect(storeStub.updateProjectStatus).toHaveBeenLastCalledWith(12, 'ACTIVO');
    expect(storeStub.deleteProject).toHaveBeenLastCalledWith(12);
  });

  it('submits normalized project edits', () => {
    fixture.componentInstance.name.set('  Nuevo nombre ');
    fixture.componentInstance.description.set('  Detalle nuevo ');
    fixture.componentInstance.code.set(' ');
    fixture.componentInstance.startDate.set('2026-02-01');
    fixture.componentInstance.estimatedEndDate.set('');
    fixture.componentInstance.technologies.set(' Angular ');
    fixture.componentInstance.repositoryUrl.set(' ');

    fixture.componentInstance.onSubmit(new Event('submit'));

    expect(storeStub.updateProject).toHaveBeenCalledWith(4, {
      name: 'Nuevo nombre',
      description: 'Detalle nuevo',
      code: null,
      startDate: '2026-02-01',
      estimatedEndDate: null,
      technologies: 'Angular',
      repositoryUrl: null,
    });
  });

  it('does not submit an empty name and sends status changes', () => {
    fixture.componentInstance.name.set('   ');
    fixture.componentInstance.onSubmit(new Event('submit'));
    fixture.componentInstance.onStatusChange('ACTIVO');

    expect(storeStub.updateProject).not.toHaveBeenCalled();
    expect(storeStub.updateProjectStatus).toHaveBeenCalledWith(4, 'ACTIVO');
  });

    it('exposes dialog semantics and an accessible label for delete confirmation', () => {
    fixture.componentInstance.confirmingDelete.set(true);
    fixture.detectChanges();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="project-delete-dialog"]');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('project-delete-dialog-title');
    const describedBy = dialog?.getAttribute('aria-describedby');
    expect(describedBy).toBe('project-delete-dialog-description');
    expect(describedBy ? dialog?.querySelector(`#${describedBy}`) : null).not.toBeNull();
    expect(dialog?.querySelector('#project-delete-dialog-title')?.textContent).toContain('Eliminar proyecto');
  });

it('navigates only after deletion succeeds', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    storeStub.deleteProject.mockResolvedValue(true);
    fixture.componentInstance.confirmingDelete.set(true);

    await fixture.componentInstance.onDelete();

    expect(storeStub.deleteProject).toHaveBeenCalledWith(4);
    expect(navigateSpy).toHaveBeenCalledWith(['/projects']);
    expect(fixture.componentInstance.confirmingDelete()).toBe(false);
  });

  it('stays on the detail screen when deletion fails', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    storeStub.deleteProject.mockResolvedValue(false);
    fixture.componentInstance.confirmingDelete.set(true);

    await fixture.componentInstance.onDelete();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.confirmingDelete()).toBe(true);
  });
});


@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class RouterHostComponent {
  @ViewChild(RouterOutlet) outlet!: RouterOutlet;
}

describe('ProjectDetailComponent router integration', () => {
  it('reuses the detail component across project routes and clears transient state', async () => {
    const storeStub = {
      selectedProject: signal<Project | null>(project(4)),
      detailLoading: signal(false),
      saving: signal(false),
      deleting: signal(false),
      error: signal<string | null>(null),
      loadProject: vi.fn(),
      updateProject: vi.fn(),
      updateProjectStatus: vi.fn(),
      deleteProject: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [RouterHostComponent],
      providers: [
        provideRouter(
          [{ path: 'projects/:projectId', component: ProjectDetailComponent }],
          withComponentInputBinding(),
        ),
        { provide: ProjectsStore, useValue: storeStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RouterHostComponent);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/projects/4');
    fixture.detectChanges();
    await fixture.whenStable();
    const firstComponent = fixture.nativeElement.querySelector('app-project-detail');
    const routedDetail = fixture.componentInstance.outlet.component as ProjectDetailComponent;

    routedDetail.name.set('Unsaved edit');
    routedDetail.confirmingDelete.set(true);
    storeStub.selectedProject.set(null);
    await router.navigateByUrl('/projects/9');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.outlet.component).toBe(routedDetail);
    expect(firstComponent).toBe(fixture.nativeElement.querySelector('app-project-detail'));
    expect(storeStub.loadProject).toHaveBeenLastCalledWith(9);
    expect(routedDetail.name()).toBe('');
    expect(routedDetail.confirmingDelete()).toBe(false);
  });
});
