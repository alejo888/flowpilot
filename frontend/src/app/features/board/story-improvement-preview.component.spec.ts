import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoryImprovementPreviewComponent } from './story-improvement-preview.component';

describe('StoryImprovementPreviewComponent', () => {
  let fixture: ComponentFixture<StoryImprovementPreviewComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StoryImprovementPreviewComponent] }).compileComponents();
    fixture = TestBed.createComponent(StoryImprovementPreviewComponent);
    fixture.componentRef.setInput('description', 'Como PM quiero ver para decidir');
    fixture.componentRef.setInput('criteria', ['Criterio 1', 'Criterio 2']);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('renders the suggested description and each suggested criterion', () => {
    expect(el.querySelector('[data-testid="improve-story-description"]')?.textContent).toContain(
      'Como PM quiero ver para decidir',
    );
    const items = Array.from(el.querySelectorAll('[data-testid="improve-story-criterion"]')).map((n) =>
      n.textContent?.trim(),
    );
    expect(items).toEqual(['Criterio 1', 'Criterio 2']);
  });

  it('is exposed as a labelled group for assistive tech', () => {
    const region = el.querySelector('[role="group"]') as HTMLElement;
    expect(region).not.toBeNull();
    expect(region.getAttribute('aria-label')).toBe('Historia mejorada sugerida');
  });

  it('emits apply and discard from the buttons', () => {
    const applied = vi.fn();
    const discarded = vi.fn();
    fixture.componentInstance.apply.subscribe(applied);
    fixture.componentInstance.discard.subscribe(discarded);

    (el.querySelector('[data-testid="improve-story-apply"]') as HTMLButtonElement).click();
    (el.querySelector('[data-testid="improve-story-discard"]') as HTMLButtonElement).click();

    expect(applied).toHaveBeenCalledTimes(1);
    expect(discarded).toHaveBeenCalledTimes(1);
  });
});
