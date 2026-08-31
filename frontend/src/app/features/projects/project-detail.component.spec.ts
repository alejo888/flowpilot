import { Component, ViewChild, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, withComponentInputBinding } from '@angular/router';

import { AiConfigService } from '../../core/ai/ai-config.service';
import { Project } from './project.model';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectsStore } from './projects.store';
import { CommentsStore } from '../comments/comments.store';

function project(
  id = 4,
  status: Project['status'] = 'PLANIFICACION',
  callerPermissions: Project['callerPermissions'] = ['PROJECT_EDIT_SETTINGS', 'PROJECT_DELETE'],
): Project {
  return {
    id,
    name: 'Proyecto detalle',
    description: 'Descripción',
    status,
    ownerId: 7,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    code: 'PRJ4',
    startDate: '2026-01-01',
    estimatedEndDate: '2026-06-01',
    technologies: 'Angular',
    repositoryUrl: 'https://github.com/org/repo',
    callerPermissions,
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
  let aiConfigStub: { aiEnabled: ReturnType<typeof signal<boolean>>; load: ReturnType<typeof vi.fn> };

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
    aiConfigStub = { aiEnabled: signal(false), load: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ProjectDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ProjectsStore, useValue: storeStub },
        { provide: AiConfigService, useValue: aiConfigStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailComponent);
    fixture.componentRef.setInput('projectId', 4);
    fixture.detectChanges();
  });

  it('does not render a redundant project eyebrow above the title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.eyebrow')).toBeNull();
  });

  it('renders the status badge with the same variant as the projects list (PR6b verify WARNING 9)', () => {
    storeStub.selectedProject.set(project(4, 'ACTIVO'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const badge = compiled.querySelector('[data-testid="project-detail-status"] .fp-badge') as HTMLElement;
    expect(badge.classList.contains('fp-badge--success')).toBe(true);
  });

  it('orders project navigation with the projects link first', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('.project-context-links a')) as HTMLAnchorElement[];
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Volver a proyectos',
      'Backlog y sprints',
      'Dashboard',
    ]);
    expect(links[0].getAttribute('href')).toBe('/projects');
  });

  it('hides the AI user-stories link while the AI assistant is disabled', () => {
    expect(
      fixture.nativeElement.querySelector('[data-testid="nav-ai-stories"]'),
    ).toBeNull();
  });

  it('shows a project-scoped AI user-stories link when the assistant is enabled and the caller can create work items', () => {
    aiConfigStub.aiEnabled.set(true);
    storeStub.selectedProject.set(project(4, 'PLANIFICACION', ['WORKITEM_CREATE']));
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '[data-testid="nav-ai-stories"]',
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/projects/4/ai/user-stories');
  });

  it('hides the AI user-stories link when the caller lacks WORKITEM_CREATE, even with the assistant enabled', () => {
    aiConfigStub.aiEnabled.set(true);
    storeStub.selectedProject.set(project(4, 'PLANIFICACION', ['PROJECT_EDIT_SETTINGS']));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="nav-ai-stories"]')).toBeNull();
  });

  it('hides the AI subtasks link while the AI assistant is disabled', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="nav-ai-subtasks"]')).toBeNull();
  });

  it('shows a project-scoped AI subtasks link when the assistant is enabled and the caller can create work items', () => {
    aiConfigStub.aiEnabled.set(true);
    storeStub.selectedProject.set(project(4, 'PLANIFICACION', ['WORKITEM_CREATE']));
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '[data-testid="nav-ai-subtasks"]',
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/projects/4/ai/subtasks');
  });

  it('hides the AI subtasks link when the caller lacks WORKITEM_CREATE, even with the assistant enabled', () => {
    aiConfigStub.aiEnabled.set(true);
    storeStub.selectedProject.set(project(4, 'PLANIFICACION', ['PROJECT_EDIT_SETTINGS']));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="nav-ai-subtasks"]')).toBeNull();
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

  it('bumps the status reset token on a failed status change, but not on success', async () => {
    storeStub.updateProjectStatus.mockResolvedValueOnce(false);
    const before = fixture.componentInstance.statusResetToken();

    await fixture.componentInstance.onStatusChange('ACTIVO');

    expect(fixture.componentInstance.statusResetToken()).toBe(before + 1);

    storeStub.updateProjectStatus.mockResolvedValueOnce(true);
    await fixture.componentInstance.onStatusChange('PAUSADO');

    expect(fixture.componentInstance.statusResetToken()).toBe(before + 1);
  });

    it('exposes dialog semantics and an accessible label for delete confirmation', () => {
    fixture.componentInstance.confirmingDelete.set(true);
    fixture.detectChanges();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="project-delete-dialog"]');
    const panel = dialog?.querySelector('.fp-dialog__panel');
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-modal')).toBe('true');
    expect(panel?.getAttribute('aria-labelledby')).toBe('project-delete-dialog-title');
    const describedBy = panel?.getAttribute('aria-describedby');
    expect(describedBy).toBe('project-delete-dialog-description');
    expect(describedBy ? dialog?.querySelector(`#${describedBy}`) : null).not.toBeNull();
    expect(dialog?.querySelector('#project-delete-dialog-title')?.textContent).toContain('Eliminar proyecto');
  });

  it('closes the delete confirmation dialog on Escape without deleting', () => {
    fixture.componentInstance.confirmingDelete.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="project-delete-dialog"]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(storeStub.deleteProject).not.toHaveBeenCalled();
    expect(fixture.componentInstance.confirmingDelete()).toBe(false);
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

  it('enables edit/status/delete controls when the caller holds the matching permissions', () => {
    storeStub.selectedProject.set(project(4, 'PLANIFICACION', ['PROJECT_EDIT_SETTINGS', 'PROJECT_DELETE']));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const submit = compiled.querySelector('[data-testid="project-edit-submit"]') as HTMLButtonElement;
    const statusSelect = compiled.querySelector('[data-testid="project-status-select"]') as HTMLSelectElement;
    const deleteBtn = compiled.querySelector('[data-testid="project-delete"]') as HTMLButtonElement;

    expect(submit.disabled).toBe(false);
    expect(statusSelect.disabled).toBe(false);
    expect(deleteBtn.disabled).toBe(false);
  });

  it('disables edit/status/delete controls when the caller lacks the matching permissions', () => {
    storeStub.selectedProject.set(project(4, 'PLANIFICACION', []));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const submit = compiled.querySelector('[data-testid="project-edit-submit"]') as HTMLButtonElement;
    const statusSelect = compiled.querySelector('[data-testid="project-status-select"]') as HTMLSelectElement;
    const deleteBtn = compiled.querySelector('[data-testid="project-delete"]') as HTMLButtonElement;

    expect(submit.disabled).toBe(true);
    expect(statusSelect.disabled).toBe(true);
    expect(deleteBtn.disabled).toBe(true);
  });

  it('fails closed (disables all gated controls) while the project has not loaded yet', () => {
    storeStub.selectedProject.set(null);
    fixture.detectChanges();

    expect(fixture.componentInstance.canEditSettings()).toBe(false);
    expect(fixture.componentInstance.canDelete()).toBe(false);
  });
});


describe('ProjectDetailComponent comments', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let commentsStub: {
    projectComments: ReturnType<typeof signal<unknown[]>>;
    activity: ReturnType<typeof signal<unknown[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    submitting: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    currentUserId: ReturnType<typeof signal<number | null>>;
    loadProject: ReturnType<typeof vi.fn>;
    createProject: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    commentsStub = {
      projectComments: signal([]),
      activity: signal([]),
      loading: signal(false),
      submitting: signal(false),
      error: signal<string | null>(null),
      currentUserId: signal<number | null>(4),
      loadProject: vi.fn(),
      createProject: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const storeStub = {
      selectedProject: signal(project()),
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
      imports: [ProjectDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ProjectsStore, useValue: storeStub },
        { provide: CommentsStore, useValue: commentsStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailComponent);
    fixture.componentRef.setInput('projectId', 4);
    fixture.detectChanges();
  });

  it('renders the comment store error as an alert', () => {
    commentsStub.error.set('No se pudo guardar el comentario');
    fixture.detectChanges();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="project-comment-error"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('No se pudo guardar el comentario');
  });

  it('keeps the draft when creating a comment fails and clears it on success', async () => {
    commentsStub.createProject.mockResolvedValueOnce(false);
    fixture.componentInstance.commentDraft.set('  Texto importante ');

    await fixture.componentInstance.submitComment(new Event('submit'));

    expect(commentsStub.createProject).toHaveBeenCalledWith(4, 'Texto importante');
    expect(fixture.componentInstance.commentDraft()).toBe('  Texto importante ');

    commentsStub.createProject.mockResolvedValueOnce(true);
    await fixture.componentInstance.submitComment(new Event('submit'));

    expect(fixture.componentInstance.commentDraft()).toBe('');
  });

  it('stays in edit mode when saving a comment fails and exits on success', async () => {
    commentsStub.update.mockResolvedValueOnce(false);
    fixture.componentInstance.editingCommentId.set(7);
    fixture.componentInstance.editingContent.set('Corregido');

    await fixture.componentInstance.saveComment(7);

    expect(commentsStub.update).toHaveBeenCalledWith(7, 'Corregido', 'project');
    expect(fixture.componentInstance.editingCommentId()).toBe(7);

    commentsStub.update.mockResolvedValueOnce(true);
    await fixture.componentInstance.saveComment(7);

    expect(fixture.componentInstance.editingCommentId()).toBeNull();
  });

  it('keeps the delete confirmation open when deleting a comment fails and closes it on success', async () => {
    commentsStub.delete.mockResolvedValueOnce(false);
    fixture.componentInstance.deletingCommentId.set(7);

    await fixture.componentInstance.deleteCommentConfirmed();

    expect(commentsStub.delete).toHaveBeenCalledWith(7, 'project');
    expect(fixture.componentInstance.deletingCommentId()).toBe(7);

    commentsStub.delete.mockResolvedValueOnce(true);
    await fixture.componentInstance.deleteCommentConfirmed();

    expect(fixture.componentInstance.deletingCommentId()).toBeNull();
  });

  it('shows the failure reason inside the still-open delete dialog, not behind its backdrop', async () => {
    commentsStub.delete.mockImplementationOnce(async () => {
      commentsStub.error.set('No se pudo eliminar el comentario');
      return false;
    });
    fixture.componentInstance.deletingCommentId.set(7);
    fixture.detectChanges();

    await fixture.componentInstance.deleteCommentConfirmed();
    fixture.detectChanges();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="comment-delete-dialog"]');
    expect(dialog).not.toBeNull();
    // The alert must live inside the modal panel (the focus-trapped, aria-modal
    // region), otherwise it is behind the backdrop and outside assistive reach.
    const panel = dialog?.querySelector('.fp-dialog__panel');
    const alert = panel?.querySelector('[data-testid="comment-delete-dialog-error"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('No se pudo eliminar el comentario');
    // And the section-level copy is suppressed so it is announced exactly once.
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="project-comment-error"]'),
    ).toBeNull();
  });

  it('disables the delete confirmation button while a delete is in flight', () => {
    fixture.componentInstance.deletingCommentId.set(7);
    commentsStub.submitting.set(true);
    fixture.detectChanges();

    const confirm = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="comment-delete-confirm"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    commentsStub.submitting.set(false);
    fixture.detectChanges();
    expect(confirm.disabled).toBe(false);
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
