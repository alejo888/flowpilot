import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { BoardColumnComponent } from './board-column.component';
import { BoardColumn, WorkItem } from './board.model';

function item(id: number, title: string): WorkItem {
  return {
    id,
    projectId: 10,
    columnId: 1,
    title,
    description: null,
    assignedUserId: null,
    assignedUserName: null,
    position: 1024,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

@Component({
  standalone: true,
  imports: [BoardColumnComponent],
  template: `
    <section
      fpBoardColumn
      class="board-column"
      [column]="column"
      [items]="items"
      [canMove]="canMove()"
      (itemDropped)="dropped.push($event)"
      (itemOpened)="opened.push($event)"
    ></section>
  `,
})
class HostComponent {
  readonly column: BoardColumn = { id: 1, name: 'Por hacer', position: 1024 };
  readonly items = [item(500, 'Design schema')];
  readonly canMove = signal(true);
  readonly dropped: unknown[] = [];
  readonly opened: WorkItem[] = [];
}

describe('BoardColumnComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders on the host section without a wrapper, with the column name and its cards', () => {
    const section = (fixture.nativeElement as HTMLElement).querySelector('section.board-column');
    expect(section?.querySelector(':scope > [data-testid="column-name"]')?.textContent).toContain('Por hacer');
    expect(section?.querySelector(':scope > .board-column-list')?.id).toBe('column-1');
    expect(section?.querySelector('[data-testid="work-item-title"]')?.textContent).toContain('Design schema');
  });

  it('emits itemOpened when a card title is clicked', () => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.card-title')?.click();

    expect(fixture.componentInstance.opened.map((opened) => opened.id)).toEqual([500]);
  });

  it('re-emits the drop list drop event as itemDropped', () => {
    const dropEvent = { item: { data: item(500, 'Design schema') }, container: { data: 1 }, currentIndex: 0 };
    fixture.debugElement.query(By.directive(CdkDropList)).triggerEventHandler('cdkDropListDropped', dropEvent);

    expect(fixture.componentInstance.dropped).toEqual([dropEvent]);
  });

  it('disables dragging when the caller cannot move work items', () => {
    const drag = () => fixture.debugElement.query(By.directive(CdkDrag)).injector.get(CdkDrag);
    expect(drag().disabled).toBe(false);

    fixture.componentInstance.canMove.set(false);
    fixture.detectChanges();

    expect(drag().disabled).toBe(true);
  });
});
