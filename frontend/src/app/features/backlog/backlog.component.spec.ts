import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { WorkItem } from '../board/board.model';
import { BacklogComponent } from './backlog.component';
import { BacklogStore } from './backlog.store';
import { Sprint } from './backlog.model';

function sprint(id = 7, status: Sprint['status'] = 'PLANNED'): Sprint {
  return {
    id,
    projectId: 10,
    name: 'Sprint 1',
    goal: null,
    startDate: '2026-01-01',
    endDate: '2026-01-14',
    status,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function item(id = 1, sprintId: number | null = null): WorkItem {
  return {
    id,
    projectId: 10,
    columnId: 1,
    title: `Task ${id}`,
    description: null,
    assignedUserId: null,
    assignedUserName: null,
    position: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    sprintId,
  };
}

describe('BacklogComponent', () => {
  let fixture: ComponentFixture<BacklogComponent>;
  let store: {
    items: ReturnType<typeof signal<WorkItem[]>>;
    sprints: ReturnType<typeof signal<Sprint[]>>;
    backlogItems: ReturnType<typeof signal<WorkItem[]>>;
    itemsBySprint: ReturnType<typeof signal<Record<number, WorkItem[]>>>;
    loading: ReturnType<typeof signal<boolean>>;
    mutating: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    success: ReturnType<typeof signal<string | null>>;
    load: ReturnType<typeof vi.fn>;
    createSprint: ReturnType<typeof vi.fn>;
    startSprint: ReturnType<typeof vi.fn>;
    completeSprint: ReturnType<typeof vi.fn>;
    assignItem: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    store = {
      items: signal([]),
      sprints: signal([]),
      backlogItems: signal([]),
      itemsBySprint: signal({}),
      loading: signal(false),
      mutating: signal(false),
      error: signal(null),
      success: signal(null),
      load: vi.fn(),
      createSprint: vi.fn(),
      startSprint: vi.fn(),
      completeSprint: vi.fn(),
      assignItem: vi.fn().mockResolvedValue(true),
    };
  });

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [BacklogComponent],
      providers: [provideRouter([]), { provide: BacklogStore, useValue: store }],
    }).compileComponents();
    fixture = TestBed.createComponent(BacklogComponent);
    fixture.componentRef.setInput('projectId', '10');
    fixture.detectChanges();
  }

  it('loads the route project and renders loading, error, and empty states', async () => {
    store.loading.set(true);
    await setup();
    let element = fixture.nativeElement as HTMLElement;
    expect(store.load).toHaveBeenCalledWith(10);
    expect(element.querySelector('[data-testid="backlog-loading"]')).toBeTruthy();

    store.loading.set(false);
    store.error.set('Could not load backlog');
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="backlog-error"]')?.textContent).toContain('Could not load backlog');

    store.error.set(null);
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="backlog-empty"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="sprints-empty"]')).toBeTruthy();
  });

  it('renders sprint controls and uses the backlog option to unassign an item', async () => {
    const planned = sprint();
    store.sprints.set([planned]);
    const backlogItem = item();
    store.backlogItems.set([backlogItem]);
    store.itemsBySprint.set({});
    await setup();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="item-sprint-1"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="item-sprint-1"] option')?.textContent).toContain('Backlog');
    expect(element.textContent).toContain('Iniciar sprint');

    fixture.componentInstance.assign(backlogItem, '');
    expect(store.assignItem).toHaveBeenCalledWith(backlogItem, null);

    store.sprints.set([{ ...planned, status: 'ACTIVE' }]);
    fixture.detectChanges();
    expect(element.textContent).toContain('Completar sprint');
  });

  it('excludes COMPLETED sprints from the assignment dropdown options', async () => {
    store.sprints.set([sprint(7, 'PLANNED'), sprint(8, 'COMPLETED')]);
    const backlogItem = item();
    store.backlogItems.set([backlogItem]);
    await setup();

    expect(fixture.componentInstance.sprintOptions()).toEqual([
      { value: '7', label: 'Sprint 1' },
    ]);
  });

  it('resets the sprint select when the assignment fails', async () => {
    store.assignItem.mockResolvedValue(false);
    const planned = sprint();
    store.sprints.set([planned]);
    const backlogItem = item();
    store.backlogItems.set([backlogItem]);
    await setup();

    expect(fixture.componentInstance.sprintResetToken(backlogItem.id)).toBe(0);

    await fixture.componentInstance.assign(backlogItem, '7');

    expect(fixture.componentInstance.sprintResetToken(backlogItem.id)).toBe(1);
  });

  it('disables the sprint select while a mutation is in flight', async () => {
    store.mutating.set(true);
    const backlogItem = item();
    store.backlogItems.set([backlogItem]);
    await setup();

    const select = fixture.nativeElement.querySelector('[data-testid="item-sprint-1"]') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });
});
