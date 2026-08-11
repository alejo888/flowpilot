import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AccessNoticeStore } from '../../core/notifications/access-notice.store';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let accessNoticeStub: { consume: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    accessNoticeStub = { consume: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), { provide: AccessNoticeStore, useValue: accessNoticeStub }],
    }).compileComponents();
  });

  it('renders the pending access-denial notice and consumes it exactly once', () => {
    accessNoticeStub.consume.mockReturnValue('No tienes acceso a esta sección.');

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="home-notice"]')?.textContent).toContain(
      'No tienes acceso a esta sección.',
    );
    expect(accessNoticeStub.consume).toHaveBeenCalledTimes(1);
  });

  it('renders with no notice when AccessNoticeStore has none pending', () => {
    accessNoticeStub.consume.mockReturnValue(null);

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="home-notice"]')).toBeNull();
  });

  it('links to the projects list', () => {
    accessNoticeStub.consume.mockReturnValue(null);

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('[data-testid="home-projects-link"]');
    expect(link?.getAttribute('href')).toBe('/projects');
  });
});
