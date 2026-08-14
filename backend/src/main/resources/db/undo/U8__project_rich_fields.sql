-- Manual revert script for V8__project_rich_fields.sql (Flyway Community has no automated undo).
DROP INDEX IF EXISTS idx_projects_code_lower;

ALTER TABLE projects
    DROP COLUMN IF EXISTS code,
    DROP COLUMN IF EXISTS start_date,
    DROP COLUMN IF EXISTS estimated_end_date,
    DROP COLUMN IF EXISTS technologies,
    DROP COLUMN IF EXISTS repository_url;
