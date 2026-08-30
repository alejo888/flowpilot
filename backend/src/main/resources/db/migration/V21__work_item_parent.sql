-- Single-level work-item hierarchy (spec: work-item-hierarchy).
-- A nullable self-FK: a work item MAY point at one parent work item.
-- The one-level cap (a parent cannot itself be a subtask) and the
-- delete-with-children block are enforced in application code
-- (WorkItemService.validateParent / delete).
--
-- No ON DELETE clause (design D1): NO ACTION makes the DB reject a delete
-- that would orphan children, agreeing with the app-level 409 instead of
-- silently nulling the link. Additive, nullable, no default -> no backfill
-- and no table-rewrite lock at demo scale.
ALTER TABLE work_items
    ADD COLUMN parent_work_item_id BIGINT REFERENCES work_items (id);

CREATE INDEX idx_work_items_parent_work_item_id
    ON work_items (parent_work_item_id);
