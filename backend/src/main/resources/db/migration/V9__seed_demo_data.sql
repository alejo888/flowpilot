-- Demo/portfolio data so a fresh `docker compose up --build` shows a populated,
-- convincing app instead of an empty shell (bootstrap admin from V2 is the only
-- other seeded account). Documented default credentials for local/dev use only
-- — rotate in real environments, same precedent as V2's admin bootstrap.
--
-- All demo users share the password: Demo1234!
-- (bcrypt, same $2b$ / cost-10 scheme as V2__seed_admin.sql)
--   ana.garcia@flowpilot.local
--   carlos.fernandez@flowpilot.local
--   lucia.martinez@flowpilot.local
--   diego.torres@flowpilot.local
INSERT INTO users (name, email, password_hash, role, active)
VALUES
    ('Ana García',        'ana.garcia@flowpilot.local',
     '$2b$10$NJc/yRlPdDOZgrmVebf8teJdsOonbj2YYX/8I3.Wtn8TanXOKW20u', 'MIEMBRO_EQUIPO', TRUE),
    ('Carlos Fernández',  'carlos.fernandez@flowpilot.local',
     '$2b$10$NJc/yRlPdDOZgrmVebf8teJdsOonbj2YYX/8I3.Wtn8TanXOKW20u', 'MIEMBRO_EQUIPO', TRUE),
    ('Lucía Martínez',    'lucia.martinez@flowpilot.local',
     '$2b$10$NJc/yRlPdDOZgrmVebf8teJdsOonbj2YYX/8I3.Wtn8TanXOKW20u', 'MIEMBRO_EQUIPO', TRUE),
    ('Diego Torres',      'diego.torres@flowpilot.local',
     '$2b$10$NJc/yRlPdDOZgrmVebf8teJdsOonbj2YYX/8I3.Wtn8TanXOKW20u', 'MIEMBRO_EQUIPO', TRUE);

-- Three demo projects covering varied statuses and rich fields (V8).
INSERT INTO projects (name, description, status, owner_id, code, start_date, estimated_end_date, technologies, repository_url)
VALUES
    ('FlowPilot Mobile App',
     'Aplicación móvil complementaria de FlowPilot para gestionar tableros y tareas desde el celular.',
     'ACTIVO',
     (SELECT id FROM users WHERE email = 'ana.garcia@flowpilot.local'),
     'FPMOB', DATE '2026-03-01', DATE '2026-12-15',
     'Kotlin, Jetpack Compose, Ktor, PostgreSQL',
     'https://github.com/flowpilot-demo/flowpilot-mobile'),
    ('Marketing Website Redesign',
     'Rediseño del sitio de marketing corporativo con foco en conversión y accesibilidad.',
     'PLANIFICACION',
     (SELECT id FROM users WHERE email = 'carlos.fernandez@flowpilot.local'),
     'MKTWEB', DATE '2026-09-01', DATE '2027-01-31',
     'Astro, Tailwind CSS, Contentful',
     'https://github.com/flowpilot-demo/marketing-website'),
    ('Internal API Migration',
     'Migración de los servicios internos legacy hacia una API REST unificada sobre Spring Boot.',
     'FINALIZADO',
     (SELECT id FROM users WHERE email = 'lucia.martinez@flowpilot.local'),
     'APIMIG', DATE '2026-01-15', DATE '2026-07-30',
     'Spring Boot, Java 25, PostgreSQL, Docker',
     'https://github.com/flowpilot-demo/internal-api-migration');

-- Default board columns per project, matching ProjectService.DEFAULT_COLUMN_NAMES
-- and its gap-based position step (1024) so newly-created cards slot in cleanly.
INSERT INTO board_columns (project_id, name, position)
SELECT p.id, c.name, c.position
FROM projects p
CROSS JOIN (VALUES
    ('Por hacer',    1024),
    ('En progreso',  2048),
    ('En revisión',  3072),
    ('Terminado',    4096)
) AS c (name, position)
WHERE p.code IN ('FPMOB', 'MKTWEB', 'APIMIG');

-- Project memberships with varied roles across the six-role matrix (V6/V7).
INSERT INTO project_members (project_id, user_id, role)
VALUES
    ((SELECT id FROM projects WHERE code = 'FPMOB'), (SELECT id FROM users WHERE email = 'ana.garcia@flowpilot.local'),       'PROJECT_MANAGER'),
    ((SELECT id FROM projects WHERE code = 'FPMOB'), (SELECT id FROM users WHERE email = 'carlos.fernandez@flowpilot.local'), 'DEVELOPER'),
    ((SELECT id FROM projects WHERE code = 'FPMOB'), (SELECT id FROM users WHERE email = 'diego.torres@flowpilot.local'),     'QA'),
    ((SELECT id FROM projects WHERE code = 'FPMOB'), (SELECT id FROM users WHERE email = 'lucia.martinez@flowpilot.local'),   'UX_UI_DESIGNER'),

    ((SELECT id FROM projects WHERE code = 'MKTWEB'), (SELECT id FROM users WHERE email = 'carlos.fernandez@flowpilot.local'), 'PROJECT_MANAGER'),
    ((SELECT id FROM projects WHERE code = 'MKTWEB'), (SELECT id FROM users WHERE email = 'lucia.martinez@flowpilot.local'),   'UX_UI_DESIGNER'),
    ((SELECT id FROM projects WHERE code = 'MKTWEB'), (SELECT id FROM users WHERE email = 'diego.torres@flowpilot.local'),     'PRODUCT_OWNER'),

    ((SELECT id FROM projects WHERE code = 'APIMIG'), (SELECT id FROM users WHERE email = 'lucia.martinez@flowpilot.local'),   'PROJECT_MANAGER'),
    ((SELECT id FROM projects WHERE code = 'APIMIG'), (SELECT id FROM users WHERE email = 'ana.garcia@flowpilot.local'),       'DEVOPS'),
    ((SELECT id FROM projects WHERE code = 'APIMIG'), (SELECT id FROM users WHERE email = 'carlos.fernandez@flowpilot.local'), 'DEVELOPER');

-- Work items for FlowPilot Mobile App so the Kanban board looks alive.
-- Positions follow WorkItemService's gap-based step (1024) per column.
INSERT INTO work_items (project_id, column_id, title, description, assigned_user_id, position)
SELECT
    (SELECT id FROM projects WHERE code = 'FPMOB'),
    (SELECT id FROM board_columns WHERE project_id = (SELECT id FROM projects WHERE code = 'FPMOB') AND name = w.column_name),
    w.title,
    w.description,
    (SELECT id FROM users WHERE email = w.assignee_email),
    w.position
FROM (VALUES
    ('Por hacer',   'Diseñar pantalla de onboarding',
        'Crear los mockups y el flujo de bienvenida para nuevos usuarios de la app móvil.',
        NULL, 1024),
    ('Por hacer',   'Implementar notificaciones push',
        'Integrar Firebase Cloud Messaging para avisos de cambios de estado en tareas asignadas.',
        'carlos.fernandez@flowpilot.local', 2048),
    ('Por hacer',   'Investigar soporte offline-first',
        'Evaluar estrategias de caché local y sincronización diferida para uso sin conexión.',
        NULL, 3072),
    ('Por hacer',   'Definir esquema de sincronización de datos',
        'Especificar el contrato de sincronización incremental entre la app y el backend.',
        'lucia.martinez@flowpilot.local', 4096),

    ('En progreso', 'Integrar autenticación biométrica',
        'Agregar soporte de huella dactilar y reconocimiento facial como segundo factor opcional.',
        'carlos.fernandez@flowpilot.local', 1024),
    ('En progreso', 'Construir tablero Kanban táctil',
        'Adaptar el drag-and-drop del tablero web a gestos táctiles nativos.',
        'ana.garcia@flowpilot.local', 2048),
    ('En progreso', 'Optimizar tiempo de arranque en frío',
        'Reducir el tiempo de cold start midiendo con Macrobenchmark en dispositivos de gama media.',
        'diego.torres@flowpilot.local', 3072),

    ('En revisión', 'Revisar accesibilidad de formularios',
        'Validar etiquetas TalkBack/VoiceOver y contraste mínimo en los formularios de la app.',
        'diego.torres@flowpilot.local', 1024),
    ('En revisión', 'Ajustar tema oscuro',
        'Corregir contrastes insuficientes detectados en el tema oscuro de la pantalla de proyectos.',
        'lucia.martinez@flowpilot.local', 2048),

    ('Terminado',   'Configurar CI/CD para builds de Android/iOS',
        'Pipeline de build, firma y publicación interna en Firebase App Distribution / TestFlight.',
        'carlos.fernandez@flowpilot.local', 1024),
    ('Terminado',   'Migrar almacenamiento local a Room/SQLDelight',
        'Reemplazar el almacenamiento clave-valor previo por una base de datos local tipada.',
        'ana.garcia@flowpilot.local', 2048),
    ('Terminado',   'Implementar login y registro',
        'Pantallas de autenticación consumiendo los endpoints /api/auth existentes.',
        'ana.garcia@flowpilot.local', 3072)
) AS w (column_name, title, description, assignee_email, position);
