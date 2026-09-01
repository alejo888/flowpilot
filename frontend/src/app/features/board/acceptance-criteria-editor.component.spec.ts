import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcceptanceCriteriaEditorComponent } from './acceptance-criteria-editor.component';

describe('acceptance-criteria-editor', () => {
  let fixture: ComponentFixture<AcceptanceCriteriaEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcceptanceCriteriaEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AcceptanceCriteriaEditorComponent);
  });

  function inputs(): HTMLInputElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="criteria-input"]'),
    );
  }

  function removeButtons(): HTMLButtonElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="criteria-remove"]'),
    );
  }

  function addButton(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="criteria-add"]',
    ) as HTMLButtonElement;
  }

  it('renders one text input per criterion, in order, with the criterion text', () => {
    fixture.componentRef.setInput('criteria', ['Dado A', 'Cuando B', 'Entonces C']);
    fixture.detectChanges();

    expect(inputs().map((el) => el.value)).toEqual(['Dado A', 'Cuando B', 'Entonces C']);
  });

  it('emits the appended list with an empty row when "Añadir criterio" is clicked', () => {
    fixture.componentRef.setInput('criteria', ['Dado A']);
    fixture.detectChanges();

    let emitted: string[] | undefined;
    fixture.componentInstance.criteriaChange.subscribe((v) => (emitted = v));

    addButton().click();

    expect(emitted).toEqual(['Dado A', '']);
  });

  it('disables "Añadir criterio" once the list reaches max rows', () => {
    fixture.componentRef.setInput('criteria', Array.from({ length: 8 }, (_, i) => `C${i}`));
    fixture.componentRef.setInput('max', 8);
    fixture.detectChanges();

    expect(addButton().disabled).toBe(true);
  });

  it('keeps "Añadir criterio" enabled while below max rows', () => {
    fixture.componentRef.setInput('criteria', ['C0', 'C1']);
    fixture.componentRef.setInput('max', 8);
    fixture.detectChanges();

    expect(addButton().disabled).toBe(false);
  });

  it('emits the shortened list when a row is removed', () => {
    fixture.componentRef.setInput('criteria', ['Dado A', 'Cuando B', 'Entonces C']);
    fixture.detectChanges();

    let emitted: string[] | undefined;
    fixture.componentInstance.criteriaChange.subscribe((v) => (emitted = v));

    removeButtons()[1].click();

    expect(emitted).toEqual(['Dado A', 'Entonces C']);
  });

  it('emits an immutably updated list when a row is edited and never mutates the input array', () => {
    const original = ['Dado A', 'Cuando B', 'Entonces C'];
    fixture.componentRef.setInput('criteria', original);
    fixture.detectChanges();

    let emitted: string[] | undefined;
    fixture.componentInstance.criteriaChange.subscribe((v) => (emitted = v));

    const firstInput = inputs()[0];
    firstInput.value = 'Dado X';
    firstInput.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['Dado X', 'Cuando B', 'Entonces C']);
    expect(original).toEqual(['Dado A', 'Cuando B', 'Entonces C']);
  });

  it('suppresses every control when the disabled input is set', () => {
    fixture.componentRef.setInput('criteria', ['Dado A', 'Cuando B']);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(inputs().every((el) => el.disabled)).toBe(true);
    expect(removeButtons().every((el) => el.disabled)).toBe(true);
    expect(addButton().disabled).toBe(true);
  });

  it('renders the provided label', () => {
    fixture.componentRef.setInput('criteria', []);
    fixture.componentRef.setInput('label', 'Criterios sugeridos');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Criterios sugeridos');
  });
});
