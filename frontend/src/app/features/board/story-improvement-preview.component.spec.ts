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

  describe('cap overflow notice', () => {
    const NOTICE = '[data-testid="criteria-overflow-notice"]';

    function render(existing: string[], suggested: string[]): void {
      fixture.componentRef.setInput('existingCriteria', existing);
      fixture.componentRef.setInput('criteria', suggested);
      fixture.detectChanges();
    }

    it('is hidden when every suggestion fits', () => {
      render(['A', 'B'], ['C']);
      expect(el.querySelector(NOTICE)).toBeNull();
    });

    it('is hidden when the only dropped suggestions are duplicates', () => {
      render(['1', '2', '3', '4', '5', '6', '7', '8'], ['1', '2']);
      expect(el.querySelector(NOTICE)).toBeNull();
    });

    it('with 6 existing and 4 suggested reports 2 overflowing criteria (plural) and lists them', () => {
      render(['1', '2', '3', '4', '5', '6'], ['s1', 's2', 's3', 's4']);
      const notice = el.querySelector(NOTICE) as HTMLElement;
      expect(notice.getAttribute('role')).toBe('status');
      expect(notice.textContent).toContain('2 criterios sugeridos no caben (tope 8)');
      const listed = Array.from(notice.querySelectorAll('[data-testid="criteria-overflow-item"]')).map((n) =>
        n.textContent?.trim(),
      );
      expect(listed).toEqual(['s3', 's4']);
    });

    it('with 8 existing every suggestion overflows, singular for one', () => {
      render(['1', '2', '3', '4', '5', '6', '7', '8'], ['s1']);
      expect(el.querySelector(NOTICE)?.textContent).toContain('1 criterio sugerido no cabe (tope 8)');
    });

    it('still renders every suggested criterion in the preview', () => {
      render(['1', '2', '3', '4', '5', '6', '7', '8'], ['s1', 's2']);
      expect(el.querySelectorAll('[data-testid="improve-story-criterion"]').length).toBe(2);
    });
  });
});
