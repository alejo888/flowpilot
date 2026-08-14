-- Adds five optional rich fields to projects (spec: project-management delta
-- "Rich Project Fields"). All nullable, additive, no backfill required.
--
-- `code` uniqueness is case-insensitive and only enforced when non-null: a
-- partial unique index on lower(code) lets any number of projects share a
-- null code while still rejecting collisions like "ABC" vs "abc" (design A1,
-- A4, A5). The application layer pre-checks via
-- ProjectRepository.existsByCodeIgnoreCase(...) before insert/update; this
-- index is the race-condition backstop mapped to 409 by
-- GlobalExceptionHandler's DataIntegrityViolationException handler.
ALTER TABLE projects
    ADD COLUMN code               VARCHAR(50),
    ADD COLUMN start_date         DATE,
    ADD COLUMN estimated_end_date DATE,
    ADD COLUMN technologies       TEXT,
    ADD COLUMN repository_url     VARCHAR(500);

CREATE UNIQUE INDEX idx_projects_code_lower
    ON projects (lower(code))
    WHERE code IS NOT NULL;
