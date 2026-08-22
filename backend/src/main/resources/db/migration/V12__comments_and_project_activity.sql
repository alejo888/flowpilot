CREATE TABLE comments (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    work_item_id BIGINT REFERENCES work_items(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES users(id),
    content VARCHAR(4000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT comments_single_target CHECK ((work_item_id IS NULL) OR (project_id IS NOT NULL))
);
CREATE INDEX idx_comments_project_created ON comments(project_id, created_at DESC, id DESC);
CREATE INDEX idx_comments_work_item_created ON comments(work_item_id, created_at DESC, id DESC);

CREATE TABLE project_activity (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    actor_id BIGINT NOT NULL REFERENCES users(id),
    event_type VARCHAR(40) NOT NULL,
    display_text VARCHAR(500) NOT NULL,
    payload VARCHAR(4000) NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_activity_project_created ON project_activity(project_id, created_at DESC, id DESC);
