CREATE TABLE work_items (
    id               BIGSERIAL PRIMARY KEY,
    project_id       BIGINT       NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    column_id        BIGINT       NOT NULL REFERENCES board_columns (id),
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    assigned_user_id BIGINT       REFERENCES users (id),
    position         INT          NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_items_project_id ON work_items (project_id);
CREATE INDEX idx_work_items_column_id_position ON work_items (column_id, position);
