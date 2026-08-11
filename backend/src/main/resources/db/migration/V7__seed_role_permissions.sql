-- Dense 6x9 = 54-row seed (confirmed decision 5b/10). Every (role, permission)
-- combination is inserted; only the combinations listed as granted=true below
-- match the proposal's "Seed Defaults" table. Non-empty by construction so
-- the app is usable on first boot with zero admin configuration (spec:
-- role-permissions).
--
-- PROJECT_DELETE is granted to no role by default: the project owner (5c)
-- and global admins (6) already cover deletion.
INSERT INTO role_permissions (role, permission, granted, updated_at) VALUES
    -- PROJECT_MANAGER: full project + member + work-item authority, except delete
    ('PROJECT_MANAGER',  'PROJECT_EDIT_SETTINGS', TRUE,  now()),
    ('PROJECT_MANAGER',  'PROJECT_DELETE',         FALSE, now()),
    ('PROJECT_MANAGER',  'MEMBER_ADD',             TRUE,  now()),
    ('PROJECT_MANAGER',  'MEMBER_REMOVE',          TRUE,  now()),
    ('PROJECT_MANAGER',  'MEMBER_CHANGE_ROLE',     TRUE,  now()),
    ('PROJECT_MANAGER',  'WORKITEM_CREATE',        TRUE,  now()),
    ('PROJECT_MANAGER',  'WORKITEM_EDIT',          TRUE,  now()),
    ('PROJECT_MANAGER',  'WORKITEM_DELETE',        TRUE,  now()),
    ('PROJECT_MANAGER',  'WORKITEM_MOVE',          TRUE,  now()),

    -- PRODUCT_OWNER: full work-item authority, no project/member authority
    ('PRODUCT_OWNER',    'PROJECT_EDIT_SETTINGS',  FALSE, now()),
    ('PRODUCT_OWNER',    'PROJECT_DELETE',         FALSE, now()),
    ('PRODUCT_OWNER',    'MEMBER_ADD',             FALSE, now()),
    ('PRODUCT_OWNER',    'MEMBER_REMOVE',          FALSE, now()),
    ('PRODUCT_OWNER',    'MEMBER_CHANGE_ROLE',     FALSE, now()),
    ('PRODUCT_OWNER',    'WORKITEM_CREATE',        TRUE,  now()),
    ('PRODUCT_OWNER',    'WORKITEM_EDIT',          TRUE,  now()),
    ('PRODUCT_OWNER',    'WORKITEM_DELETE',        TRUE,  now()),
    ('PRODUCT_OWNER',    'WORKITEM_MOVE',          TRUE,  now()),

    -- DEVELOPER: create/edit/move work items, no delete, no project/member authority
    ('DEVELOPER',        'PROJECT_EDIT_SETTINGS',  FALSE, now()),
    ('DEVELOPER',        'PROJECT_DELETE',         FALSE, now()),
    ('DEVELOPER',        'MEMBER_ADD',             FALSE, now()),
    ('DEVELOPER',        'MEMBER_REMOVE',          FALSE, now()),
    ('DEVELOPER',        'MEMBER_CHANGE_ROLE',     FALSE, now()),
    ('DEVELOPER',        'WORKITEM_CREATE',        TRUE,  now()),
    ('DEVELOPER',        'WORKITEM_EDIT',          TRUE,  now()),
    ('DEVELOPER',        'WORKITEM_DELETE',        FALSE, now()),
    ('DEVELOPER',        'WORKITEM_MOVE',          TRUE,  now()),

    -- UX_UI_DESIGNER: same shape as DEVELOPER
    ('UX_UI_DESIGNER',   'PROJECT_EDIT_SETTINGS',  FALSE, now()),
    ('UX_UI_DESIGNER',   'PROJECT_DELETE',         FALSE, now()),
    ('UX_UI_DESIGNER',   'MEMBER_ADD',             FALSE, now()),
    ('UX_UI_DESIGNER',   'MEMBER_REMOVE',          FALSE, now()),
    ('UX_UI_DESIGNER',   'MEMBER_CHANGE_ROLE',     FALSE, now()),
    ('UX_UI_DESIGNER',   'WORKITEM_CREATE',        TRUE,  now()),
    ('UX_UI_DESIGNER',   'WORKITEM_EDIT',          TRUE,  now()),
    ('UX_UI_DESIGNER',   'WORKITEM_DELETE',        FALSE, now()),
    ('UX_UI_DESIGNER',   'WORKITEM_MOVE',          TRUE,  now()),

    -- QA: same shape as DEVELOPER
    ('QA',                'PROJECT_EDIT_SETTINGS', FALSE, now()),
    ('QA',                'PROJECT_DELETE',        FALSE, now()),
    ('QA',                'MEMBER_ADD',            FALSE, now()),
    ('QA',                'MEMBER_REMOVE',         FALSE, now()),
    ('QA',                'MEMBER_CHANGE_ROLE',    FALSE, now()),
    ('QA',                'WORKITEM_CREATE',       TRUE,  now()),
    ('QA',                'WORKITEM_EDIT',         TRUE,  now()),
    ('QA',                'WORKITEM_DELETE',       FALSE, now()),
    ('QA',                'WORKITEM_MOVE',         TRUE,  now()),

    -- DEVOPS: same shape as DEVELOPER
    ('DEVOPS',             'PROJECT_EDIT_SETTINGS', FALSE, now()),
    ('DEVOPS',             'PROJECT_DELETE',        FALSE, now()),
    ('DEVOPS',             'MEMBER_ADD',            FALSE, now()),
    ('DEVOPS',             'MEMBER_REMOVE',         FALSE, now()),
    ('DEVOPS',             'MEMBER_CHANGE_ROLE',    FALSE, now()),
    ('DEVOPS',             'WORKITEM_CREATE',       TRUE,  now()),
    ('DEVOPS',             'WORKITEM_EDIT',         TRUE,  now()),
    ('DEVOPS',             'WORKITEM_DELETE',       FALSE, now()),
    ('DEVOPS',             'WORKITEM_MOVE',         TRUE,  now());
