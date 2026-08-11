-- Manual revert script for V7__seed_role_permissions.sql (Flyway Community has no automated undo).
DELETE FROM role_permissions;
