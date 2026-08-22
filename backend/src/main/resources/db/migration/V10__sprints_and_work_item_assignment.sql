CREATE TABLE sprints (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    goal TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_sprints_dates CHECK (end_date >= start_date),
    CONSTRAINT ck_sprints_status CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED'))
);
CREATE INDEX idx_sprints_project_id ON sprints (project_id);
CREATE UNIQUE INDEX ux_sprints_one_active_per_project ON sprints (project_id) WHERE status = 'ACTIVE';
ALTER TABLE work_items ADD COLUMN sprint_id BIGINT REFERENCES sprints (id) ON DELETE SET NULL;
CREATE INDEX idx_work_items_sprint_id ON work_items (sprint_id);
