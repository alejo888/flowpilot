-- Manual revert script for V2__seed_admin.sql (Flyway Community has no automated undo).
DELETE FROM users WHERE email = 'admin@flowpilot.local';
