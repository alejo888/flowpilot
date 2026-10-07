import { WorkItem, WorkItemCreateRequest, WorkItemPriority, WorkItemUpdateRequest } from './board.model';

/**
 * Board create/edit form model plus the pure helpers that map a work item
 * into the form and the form into a create/update request. Shared by the
 * board's create form and the detail panel's edit form.
 */
export type WorkItemForm = {
  title: string;
  description: string;
  assignedUserId: number | null;
  /**
   * Not edited in this screen (sprint assignment lives in the backlog screen),
   * but round-tripped so a board edit never drops the item's current sprint:
   * `PUT /api/work-items/{id}` treats an omitted `sprintId` as an explicit
   * "move to backlog" (that null IS the backlog screen's unassign contract).
   */
  sprintId?: number | null;
  /**
   * Not edited in this screen (no priority UI here yet), but round-tripped
   * the same way as `sprintId` above so submitting the edit form never wipes
   * the item's current priority back to the backend default.
   */
  priority?: WorkItemPriority | null;
  /**
   * The item's parent work item (single-level hierarchy). Edited by the
   * detail panel's parent `<select>` and round-tripped like `sprintId`
   * above so a board edit never silently clears an existing parent link
   * (`PUT /api/work-items/{id}` treats an omitted `parentWorkItemId` as an
   * explicit clear).
   */
  parentWorkItemId?: number | null;
  /**
   * The item's structured acceptance criteria. Not edited in this screen, but
   * round-tripped like `sprintId`/`priority`/`parentWorkItemId` above so a
   * board-panel edit never wipes an AI story's criteria: `PUT /api/work-items/{id}`
   * replaces the stored list with whatever it receives (an omitted value
   * becomes `[]`). `emptyForm()` leaves it `undefined` so the create path
   * posts nothing and the backend stores `[]`.
   */
  acceptanceCriteria?: string[];
};

export const emptyForm = (): WorkItemForm => ({ title: '', description: '', assignedUserId: null });

export function formFromItem(item: WorkItem): WorkItemForm {
  return {
    title: item.title,
    description: item.description ?? '',
    assignedUserId: item.assignedUserId,
    sprintId: item.sprintId ?? null,
    priority: item.priority ?? null,
    parentWorkItemId: item.parentWorkItemId ?? null,
    acceptanceCriteria: item.acceptanceCriteria ?? [],
  };
}

export function requestFromForm(form: WorkItemForm): WorkItemCreateRequest | WorkItemUpdateRequest | null {
  const title = form.title.trim();
  if (!title) {
    return null;
  }

  const rawAssignee = form.assignedUserId as number | string | null | undefined;
  const assignedUserId = Number(rawAssignee);

  const request: WorkItemCreateRequest | WorkItemUpdateRequest = {
    title,
    description: form.description.trim() || null,
    assignedUserId:
      rawAssignee === null || rawAssignee === undefined || rawAssignee === '' || Number.isNaN(assignedUserId)
        ? null
        : assignedUserId,
  };

  if (form.sprintId !== undefined) {
    request.sprintId = form.sprintId;
  }

  if (form.priority !== undefined) {
    request.priority = form.priority;
  }

  if (form.parentWorkItemId !== undefined) {
    request.parentWorkItemId = form.parentWorkItemId;
  }

  if (form.acceptanceCriteria !== undefined) {
    request.acceptanceCriteria = form.acceptanceCriteria;
  }

  return request;
}
