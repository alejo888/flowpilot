CREATE TABLE role_permissions (
    id          BIGSERIAL PRIMARY KEY,
    role        VARCHAR(50)  NOT NULL,
    permission  VARCHAR(50)  NOT NULL,
    granted     BOOLEAN      NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by  BIGINT       REFERENCES users (id),
    CONSTRAINT uk_role_permissions_role_permission UNIQUE (role, permission)
);
