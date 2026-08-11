-- Manual revert script for V1__users_and_auth.sql (Flyway Community has no automated undo).
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;
