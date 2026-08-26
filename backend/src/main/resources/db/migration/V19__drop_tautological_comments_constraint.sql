-- comments_single_target ((work_item_id IS NULL) OR (project_id IS NOT NULL)) can
-- never fail: project_id is already BIGINT NOT NULL, so the right-hand side is
-- always true regardless of work_item_id. It falsely implies the DB enforces a
-- comment-targeting invariant when it enforces nothing. The real invariant (a
-- work-item comment's project_id must match the work item's own project) needs
-- a trigger to enforce across tables and is already guaranteed in application
-- code (CommentService.createForWorkItem derives projectId from the work item).
ALTER TABLE comments DROP CONSTRAINT comments_single_target;
