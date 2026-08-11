-- Bootstrap Administrador account so the app is usable on first boot.
-- Documented default credentials for local/dev use only — rotate in real environments.
-- email:    admin@flowpilot.local
-- password: ChangeMe123!
INSERT INTO users (name, email, password_hash, role, active)
VALUES (
    'FlowPilot Admin',
    'admin@flowpilot.local',
    '$2b$10$UITml24Zp0rk.NbiAKzdoOlBpNm2EFFBC5ri/Eaa8sBQmHla6QIFy',
    'ADMINISTRADOR',
    TRUE
);
