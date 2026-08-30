import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AiProvider, UserStoryDraft } from './ai-stories.model';
import { AiStoriesComponent } from './ai-stories.component';
import { AiStoriesStore } from './ai-stories.store';

function draft(overrides: Partial<UserStoryDraft> = {}): UserStoryDraft {
  return {
    role: 'usuario registrado',
    action: 'exportar mis tareas',
    benefit: 'compartirlas con mi equipo',
    text: 'Como usuario registrado quiero exportar mis tareas para compartirlas con mi equipo',
    ...overrides,
  };
}

describe('AiStoriesComponent', () => {
  let fixture: ComponentFixture<AiStoriesComponent>;
  let storeStub: {
    loading: ReturnType<typeof signal<boolean>>;
    submitting: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    success: ReturnType<typeof signal<string | null>>;
    draft: ReturnType<typeof signal<UserStoryDraft | null>>;
    criteria: ReturnType<typeof signal<string[]>>;
    generatedBy: ReturnType<typeof signal<AiProvider | null>>;
    model: ReturnType<typeof signal<string | null>>;
    generate: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    storeStub = {
      loading: signal(false),
      submitting: signal(false),
      error: signal<string | null>(null),
      success: signal<string | null>(null),
      draft: signal<UserStoryDraft | null>(null),
      criteria: signal<string[]>([]),
      generatedBy: signal<AiProvider | null>(null),
      model: signal<string | null>(null),
      generate: vi.fn().mockResolvedValue(false),
      confirm: vi.fn().mockResolvedValue(false),
      reset: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AiStoriesComponent],
      providers: [provideRouter([]), { provide: AiStoriesStore, useValue: storeStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(AiStoriesComponent);
    fixture.componentRef.setInput('projectId', '10');
    fixture.detectChanges();
  });

  function type(testId: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as
      | HTMLInputElement
      | HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('renders the requirement field and a generate action', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="ai-requirement"]')).not.toBeNull();
    expect(el.textContent).toContain('Generar historia');
  });

  it('calls the store to generate with the project id and the typed requirement', () => {
    type('ai-requirement', 'Necesito exportar mis tareas');
    (fixture.nativeElement.querySelector('[data-testid="ai-generate"]') as HTMLButtonElement).click();

    expect(storeStub.generate).toHaveBeenCalledWith(10, 'Necesito exportar mis tareas');
  });

  it('renders the editable draft form once a draft exists, seeded from the composed sentence and criteria', () => {
    storeStub.draft.set(draft());
    storeStub.criteria.set(['Criterio A', 'Criterio B']);
    storeStub.generatedBy.set('OLLAMA');
    fixture.detectChanges();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="ai-story-title"]')).not.toBeNull();
    const description = el.querySelector('[data-testid="ai-story-description"]') as HTMLTextAreaElement;
    expect(description.value).toContain('Como usuario registrado quiero');
    expect(el.querySelectorAll('[data-testid^="ai-criterion-"]').length).toBeGreaterThanOrEqual(2);
    expect(el.textContent).toContain('OLLAMA');
  });

  it('adds and removes acceptance-criteria rows', () => {
    storeStub.draft.set(draft());
    storeStub.criteria.set(['Criterio A']);
    fixture.detectChanges();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const countInputs = () => el.querySelectorAll('[data-testid^="ai-criterion-input-"]').length;
    expect(countInputs()).toBe(1);

    (el.querySelector('[data-testid="ai-criterion-add"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(countInputs()).toBe(2);

    (el.querySelector('[data-testid="ai-criterion-remove-0"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(countInputs()).toBe(1);
  });

  it('confirms with the edited title, description and criteria', async () => {
    storeStub.draft.set(draft());
    storeStub.criteria.set(['Criterio A']);
    fixture.detectChanges();
    fixture.detectChanges();

    type('ai-story-title', 'Exportar tareas a CSV');
    (fixture.nativeElement.querySelector('[data-testid="ai-confirm"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(storeStub.confirm).toHaveBeenCalledWith(10, {
      title: 'Exportar tareas a CSV',
      description: 'Como usuario registrado quiero exportar mis tareas para compartirlas con mi equipo',
      acceptanceCriteria: ['Criterio A'],
    });
  });

  it('shows the store error message', () => {
    storeStub.error.set('El asistente de IA no está disponible en este momento.');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'El asistente de IA no está disponible en este momento.',
    );
  });

  it('keeps the typed title when confirm fails', async () => {
    storeStub.draft.set(draft());
    storeStub.criteria.set(['Criterio A']);
    fixture.detectChanges();
    fixture.detectChanges();

    type('ai-story-title', 'Título en progreso');
    storeStub.confirm.mockResolvedValueOnce(false);
    (fixture.nativeElement.querySelector('[data-testid="ai-confirm"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('[data-testid="ai-story-title"]') as HTMLInputElement;
    expect(title.value).toBe('Título en progreso');
  });
});
