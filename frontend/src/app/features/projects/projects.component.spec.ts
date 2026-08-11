import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Project } from './project.model';
import { ProjectsComponent } from './projects.component';
import { ProjectsStore } from './projects.store';

function project(id: number, name = `Project ${id}`): Project {
  return {
    id,
    name,
    description: `Description ${id}`,
    status: 'PLANIFICACION',
    ownerId: 7,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };
}

describe('ProjectsComponent', () => {
  let fixture: ComponentFixture<ProjectsComponent>;
  let storeStub: {
    projects: ReturnType<typeof signal<Project[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    creating: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    lastCreated: ReturnType<typeof signal<Project | null>>;
    loadProjects: ReturnType<typeof vi.fn>;
    createProject: ReturnType<typeof vi.fn>;
  };

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [provideRouter([]), { provide: ProjectsStore, useValue: storeStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsComponent);
    fixture.detectChanges();
  }

  function setInput(testid: string, value: string): void {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submitForm(): void {
    const compiled = fixture.nativeElement as HTMLElement;
    const form = compiled.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    storeStub = {
      projects: signal([]),
      loading: signal(false),
      creating: signal(false),
      error: signal(null),
      lastCreated: signal(null),
      loadProjects: vi.fn(),
      createProject: vi.fn(),
    };
  });

  it('loads the project list on init', async () => {
    await setup();

    expect(storeStub.loadProjects).toHaveBeenCalled();
  });

  it('shows the loading state while the store is fetching', async () => {
    storeStub.loading.set(true);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="projects-loading"]')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="projects-empty"]')).toBeFalsy();
  });

  it('shows the empty state when loading has finished and there are no projects', async () => {
    storeStub.loading.set(false);
    storeStub.projects.set([]);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="projects-empty"]')?.textContent).toContain(
      'Todavía no tienes proyectos',
    );
  });

  it('renders each project with name, description, and status', async () => {
    storeStub.projects.set([project(1, 'Alpha'), project(2, 'Beta')]);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const names = Array.from(compiled.querySelectorAll('[data-testid="project-row-1"], [data-testid="project-row-2"]'));
    expect(names).toHaveLength(2);
    expect(compiled.querySelector('[data-testid="project-row-1"] [data-testid="project-board-link"]')?.textContent).toContain('Alpha');
    expect(compiled.querySelector('[data-testid="project-row-1"] [data-testid="project-description"]')?.textContent).toContain('Description 1');
    expect(compiled.querySelector('[data-testid="project-row-1"] [data-testid="project-status"]')?.textContent).toContain('PLANIFICACION');
  });

  it('displays the store error when the list fails to load', async () => {
    storeStub.error.set('No se pudieron cargar los proyectos');
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="projects-error"]')?.textContent).toContain(
      'No se pudieron cargar los proyectos',
    );
  });

  it('blocks submission client-side when the name is blank and does not call the store', async () => {
    await setup();

    setInput('project-create-name', '   ');
    submitForm();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="project-create-error"]')?.textContent).toContain(
      'El nombre es obligatorio',
    );
    expect(storeStub.createProject).not.toHaveBeenCalled();
  });

  it('calls store.createProject with the trimmed name and description on submit', async () => {
    await setup();

    setInput('project-create-name', '  Nuevo proyecto  ');
    setInput('project-create-description', '  Detalle  ');
    submitForm();

    expect(storeStub.createProject).toHaveBeenCalledWith('Nuevo proyecto', 'Detalle');
  });

  it('sends a null description when the description field is left blank', async () => {
    await setup();

    setInput('project-create-name', 'Nuevo proyecto');
    submitForm();

    expect(storeStub.createProject).toHaveBeenCalledWith('Nuevo proyecto', null);
  });

  it('renders the store error from a failed creation at project-create submission scope', async () => {
    await setup();
    storeStub.error.set('El nombre no puede estar vacío');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="projects-error"]')?.textContent).toContain(
      'El nombre no puede estar vacío',
    );
  });

  it('clears the form when the store reports a newly created project', async () => {
    await setup();

    setInput('project-create-name', 'Nuevo proyecto');
    setInput('project-create-description', 'Detalle');

    storeStub.lastCreated.set(project(9, 'Nuevo proyecto'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const nameInput = compiled.querySelector('[data-testid="project-create-name"]') as HTMLInputElement;
    const descriptionInput = compiled.querySelector(
      '[data-testid="project-create-description"]',
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('');
    expect(descriptionInput.value).toBe('');
  });

  it('disables the submit button while creating is in flight', async () => {
    storeStub.creating.set(true);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const submitButton = compiled.querySelector('[data-testid="project-create-submit"]') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });
});
