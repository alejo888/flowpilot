-- SPRINT_MANAGE: dedicated permission for the sprint lifecycle (create,
-- update, start, complete). Before this migration those endpoints reused
-- WORKITEM_EDIT, which every role holds, so any member could start or
-- complete the team's active sprint and an admin could not restrict sprint
-- control without also breaking work-item editing.
--
-- Dense one-row-per-role insert (same shape as V7): the matrix is dense by
-- construction and RolePermissionAdminService.replaceAll rejects any
-- (role, permission) cell that has no persisted row.
--
-- Granted to the two planning roles only.
INSERT INTO role_permissions (role, permission, granted, updated_at) VALUES
    ('PROJECT_MANAGER',  'SPRINT_MANAGE', TRUE,  now()),
    ('PRODUCT_OWNER',    'SPRINT_MANAGE', TRUE,  now()),
    ('DEVELOPER',        'SPRINT_MANAGE', FALSE, now()),
    ('UX_UI_DESIGNER',   'SPRINT_MANAGE', FALSE, now()),
    ('QA',               'SPRINT_MANAGE', FALSE, now()),
    ('DEVOPS',           'SPRINT_MANAGE', FALSE, now());
