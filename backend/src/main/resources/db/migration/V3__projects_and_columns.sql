CREATE TABLE projects (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    status      VARCHAR(50)  NOT NULL,
    owner_id    BIGINT       NOT NULL REFERENCES users (id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_owner_id ON projects (owner_id);

CREATE TABLE board_columns (
    id         BIGSERIAL PRIMARY KEY,
    project_id BIGINT       NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    position   INT          NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (project_id, position)
);

CREATE INDEX idx_board_columns_project_id ON board_columns (project_id);
