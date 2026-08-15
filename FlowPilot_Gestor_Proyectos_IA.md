# FlowPilot — Gestor de Proyectos con Inteligencia Artificial

> **Nota de estado:** este documento describe la visión completa del producto. El MVP implementado actualmente cubre autenticación/sesiones, administración de usuarios y permisos, proyectos, miembros, tablero Kanban básico y contrato OpenAPI. Aún están pendientes la UI de registro/recuperación de contraseña, edición completa de proyectos y work items en frontend, backlog, sprints, métricas, actividad/comentarios, perfil/cambio de contraseña, funcionalidades de IA y pulido de demo/despliegue. Para el estado operativo actual, ver `README.md`.

## 1. Descripción general

**FlowPilot** es una plataforma de gestión ágil de proyectos con funcionalidades de inteligencia artificial orientadas a facilitar la planificación, organización y seguimiento del trabajo de equipos de desarrollo.

La aplicación permitirá gestionar proyectos, tareas, backlogs, sprints y tableros Kanban, incorporando IA para transformar requerimientos en historias de usuario, generar criterios de aceptación, dividir tareas en subtareas y analizar el estado general de los proyectos.

La idea principal es construir un producto que combine:

- Desarrollo Full Stack.
- Arquitectura de software.
- Gestión de proyectos ágiles.
- Experiencia de usuario.
- Inteligencia Artificial aplicada.
- APIs REST.
- Bases de datos relacionales.
- Contenedores y despliegue.

---

## 2. Problema

Los equipos de desarrollo suelen utilizar diferentes herramientas para organizar requerimientos, gestionar tareas, documentar historias de usuario y realizar seguimiento de proyectos.

Además, gran parte del trabajo inicial de planificación debe realizarse manualmente, por ejemplo:

- Convertir requerimientos en historias de usuario.
- Definir criterios de aceptación.
- Dividir funcionalidades en tareas técnicas.
- Identificar bloqueos.
- Analizar retrasos.
- Priorizar actividades.

FlowPilot busca centralizar estas actividades en una sola plataforma y utilizar Inteligencia Artificial para apoyar al equipo durante la planificación y ejecución de los proyectos.

---

## 3. Solución propuesta

FlowPilot permitirá que un equipo pueda:

- Crear y administrar proyectos.
- Gestionar miembros y roles.
- Crear historias de usuario, tareas y bugs.
- Administrar backlogs.
- Crear y gestionar sprints.
- Trabajar con tableros Kanban.
- Visualizar indicadores del proyecto.
- Utilizar IA para generar contenido relacionado con la planificación.
- Obtener análisis automáticos sobre el estado del proyecto.

---

# 4. Tecnologías

## Frontend

- Angular
- TypeScript
- Angular Material o PrimeNG
- HTML5
- CSS / SCSS
- RxJS

## Backend

- Java
- Spring Boot
- Spring Web
- Spring Data JPA
- Spring Security
- JWT
- Bean Validation
- Maven o Gradle

## Base de datos

- PostgreSQL

## Inteligencia Artificial

- OpenAI API
- Claude

Posibles funcionalidades futuras:

- Embeddings
- RAG
- Base de datos vectorial
- pgvector

## Infraestructura

- Docker
- Docker Compose
- GitHub Actions
- Nginx

## Herramientas de desarrollo

- Git
- GitHub
- Postman
- Swagger / OpenAPI
- IntelliJ IDEA
- Visual Studio Code

---

# 5. Arquitectura general

```text
                  ┌─────────────────────┐
                  │      Angular        │
                  │      Frontend       │
                  └──────────┬──────────┘
                             │
                             │ REST API
                             ▼
                  ┌─────────────────────┐
                  │    Spring Boot      │
                  │      Backend        │
                  └───────┬─────┬───────┘
                          │     │
                          │     └──────────────► OpenAI API / Claude
                          │
                          ▼
                  ┌─────────────────────┐
                  │     PostgreSQL      │
                  └─────────────────────┘
```

Posteriormente toda la solución podrá ejecutarse mediante Docker:

```text
Docker Compose
│
├── frontend
│     └── Angular + Nginx
│
├── backend
│     └── Spring Boot
│
└── database
      └── PostgreSQL
```

---

# 6. Módulos principales

## 6.1 Autenticación y usuarios

El sistema permitirá administrar el acceso de los usuarios a la plataforma.

### Funcionalidades

- Registro de usuarios.
- Inicio de sesión.
- Cierre de sesión.
- Recuperación de contraseña.
- Gestión de perfil.
- Cambio de contraseña.
- Autenticación mediante JWT.
- Control de acceso basado en roles.

### Roles iniciales

- Administrador.
- Project Manager.
- Miembro del equipo.

---

# 6.2 Gestión de proyectos

Permitirá crear y administrar proyectos.

### Información del proyecto

- Nombre.
- Código.
- Descripción.
- Fecha de inicio.
- Fecha estimada de finalización.
- Estado.
- Responsable.
- Miembros.
- Tecnologías.
- Repositorio.

### Estados posibles

- Planificación.
- Activo.
- Pausado.
- Finalizado.
- Cancelado.

---

# 6.3 Gestión de miembros

Cada proyecto podrá tener diferentes miembros.

### Información

- Usuario.
- Rol dentro del proyecto.
- Fecha de incorporación.
- Estado.

### Roles posibles

- Product Owner.
- Project Manager.
- Developer.
- UX/UI Designer.
- QA.
- DevOps.

---

# 6.4 Backlog

Cada proyecto tendrá un backlog donde se almacenarán las actividades pendientes.

### Tipos de elementos

- Historia de usuario.
- Tarea.
- Bug.
- Mejora.
- Tarea técnica.

### Información

- Código.
- Título.
- Descripción.
- Prioridad.
- Estado.
- Responsable.
- Story Points.
- Sprint.
- Etiquetas.
- Fecha de creación.
- Fecha límite.

### Prioridades

- Baja.
- Media.
- Alta.
- Crítica.

---

# 6.5 Historias de usuario

Las historias de usuario podrán utilizar el formato:

```text
Como [tipo de usuario]
quiero [funcionalidad]
para [beneficio].
```

Ejemplo:

```text
Como usuario registrado
quiero recuperar mi contraseña mediante correo electrónico
para poder acceder nuevamente a mi cuenta.
```

Cada historia podrá incluir:

- Descripción.
- Criterios de aceptación.
- Story Points.
- Prioridad.
- Responsable.
- Subtareas.
- Dependencias.
- Comentarios.

---

# 6.6 Tablero Kanban

Cada proyecto contará con un tablero visual.

Columnas iniciales:

```text
Por hacer
   ↓
En progreso
   ↓
En revisión
   ↓
Terminado
```

La aplicación permitirá mover tareas utilizando Drag & Drop.

También podrá permitir columnas personalizadas en futuras versiones.

---

# 6.7 Sprints

Los proyectos que utilicen metodología Scrum podrán organizar su trabajo mediante sprints.

### Información del sprint

- Nombre.
- Objetivo.
- Fecha de inicio.
- Fecha de finalización.
- Estado.
- Historias de usuario.
- Tareas.

### Estados

- Planificado.
- Activo.
- Finalizado.

---

# 6.8 Dashboard

El dashboard permitirá visualizar información general del proyecto.

### Indicadores

- Total de tareas.
- Tareas pendientes.
- Tareas en progreso.
- Tareas completadas.
- Bugs abiertos.
- Progreso del sprint.
- Distribución por prioridad.
- Distribución por responsable.

### Gráficos

- Tareas por estado.
- Tareas por prioridad.
- Progreso del sprint.
- Velocidad del equipo.
- Burndown Chart.

---

# 7. Funcionalidades de Inteligencia Artificial

La Inteligencia Artificial será una de las principales características diferenciadoras de FlowPilot.

---

# 7.1 Generación de historias de usuario

El usuario podrá ingresar un requerimiento.

Ejemplo:

```text
Necesitamos implementar recuperación de contraseña mediante correo electrónico.
```

La IA podrá generar:

```text
Historia de usuario

Como usuario registrado
quiero recuperar mi contraseña mediante correo electrónico
para poder acceder nuevamente a mi cuenta.
```

---

# 7.2 Generación de criterios de aceptación

La IA podrá proponer automáticamente criterios de aceptación.

Ejemplo:

- El usuario puede ingresar su correo electrónico.
- El sistema valida que el correo exista.
- Se genera un token temporal.
- Se envía un enlace de recuperación.
- El token expira después de un tiempo determinado.
- La contraseña debe cumplir las políticas de seguridad.

---

# 7.3 Generación de subtareas

A partir de una historia de usuario, la IA podrá generar tareas técnicas.

Ejemplo:

```text
Historia:
Implementar recuperación de contraseña.
```

Resultado:

```text
1. Crear endpoint para solicitar recuperación.
2. Implementar generación de token.
3. Configurar servicio de correo electrónico.
4. Crear pantalla de recuperación.
5. Crear formulario para nueva contraseña.
6. Implementar validaciones.
7. Crear pruebas unitarias.
8. Crear pruebas de integración.
```

---

# 7.4 Creación de proyecto mediante IA

El usuario podrá describir un proyecto utilizando lenguaje natural.

Ejemplo:

```text
Quiero desarrollar una plataforma para reservar citas médicas donde los
pacientes puedan seleccionar médico, especialidad, fecha y horario.
```

La IA podría generar una estructura inicial:

```text
Proyecto

├── Épica: Autenticación
│   ├── Registro de pacientes
│   ├── Inicio de sesión
│   └── Recuperación de contraseña
│
├── Épica: Médicos
│   ├── Gestión de médicos
│   ├── Gestión de especialidades
│   └── Disponibilidad
│
├── Épica: Citas
│   ├── Buscar médico
│   ├── Seleccionar fecha
│   ├── Seleccionar horario
│   ├── Reservar cita
│   └── Cancelar cita
│
└── Épica: Notificaciones
    ├── Confirmación de cita
    └── Recordatorios
```

El usuario podrá revisar y modificar la propuesta antes de guardarla.

---

# 7.5 AI Project Manager

FlowPilot podrá incluir una sección denominada:

```text
AI Insights
```

La IA analizará la información disponible en el proyecto y podrá generar observaciones.

Ejemplo:

```text
El sprint actual contiene 18 tareas.

9 tareas continúan en estado "Por hacer" y quedan 3 días para finalizar el sprint.

Las tareas relacionadas con autenticación presentan retrasos.

TASK-24 y TASK-31 bloquean otras cuatro tareas.

Se recomienda priorizar estas actividades.
```

---

# 7.6 Análisis de riesgos

La IA podrá analizar:

- Tareas bloqueadas.
- Historias demasiado grandes.
- Dependencias.
- Retrasos.
- Sobrecarga de miembros.
- Prioridades.
- Fechas límite.

Ejemplo:

```text
Riesgo detectado:

La historia US-24 contiene 13 subtareas y tiene una estimación de 21 Story Points.

Se recomienda dividirla en varias historias más pequeñas.
```

---

# 7.7 Mejora de historias de usuario

La IA podrá revisar una historia existente.

Ejemplo original:

```text
Crear login.
```

Resultado sugerido:

```text
Como usuario registrado
quiero iniciar sesión utilizando correo electrónico y contraseña
para acceder de manera segura a las funcionalidades de la plataforma.
```

---

# 8. Navegación de la aplicación

La estructura principal podría ser:

```text
Dashboard

Projects
│
├── Overview
├── Board
├── Backlog
├── Sprints
├── Team
├── Reports
└── AI Insights

My Tasks

AI Assistant

Profile

Settings
```

---

# 9. Modelo de datos inicial

Una estructura simplificada podría ser:

```text
User
 │
 └── ProjectMember
        │
        └── Project
              │
              ├── Sprint
              │     │
              │     └── WorkItem
              │
              ├── WorkItem
              │     ├── Comment
              │     ├── Attachment
              │     └── Activity
              │
              └── AIInsight
```

---

# 10. Entidades principales

## User

```text
id
name
email
password
status
createdAt
updatedAt
```

## Project

```text
id
name
code
description
status
startDate
endDate
createdAt
updatedAt
```

## ProjectMember

```text
id
projectId
userId
role
joinedAt
```

## Sprint

```text
id
projectId
name
goal
startDate
endDate
status
```

## WorkItem

```text
id
projectId
sprintId
parentId
type
title
description
priority
status
storyPoints
assignedUserId
createdAt
updatedAt
```

## Comment

```text
id
workItemId
userId
content
createdAt
```

## AIInsight

```text
id
projectId
type
content
createdAt
```

---

# 11. API REST inicial

Ejemplos de endpoints.

## Autenticación

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

## Proyectos

```http
GET    /api/projects
POST   /api/projects
GET    /api/projects/{id}
PUT    /api/projects/{id}
DELETE /api/projects/{id}
```

## Miembros

```http
GET    /api/projects/{id}/members
POST   /api/projects/{id}/members
DELETE /api/projects/{id}/members/{userId}
```

## Work Items

```http
GET    /api/projects/{id}/work-items
POST   /api/projects/{id}/work-items
GET    /api/work-items/{id}
PUT    /api/work-items/{id}
DELETE /api/work-items/{id}
```

## Sprints

```http
GET    /api/projects/{id}/sprints
POST   /api/projects/{id}/sprints
PUT    /api/sprints/{id}
POST   /api/sprints/{id}/start
POST   /api/sprints/{id}/complete
```

---

# 12. API de Inteligencia Artificial

Posibles endpoints:

```http
POST /api/ai/generate-user-story
POST /api/ai/generate-acceptance-criteria
POST /api/ai/generate-subtasks
POST /api/ai/improve-user-story
POST /api/ai/generate-project
POST /api/ai/analyze-project
POST /api/ai/analyze-sprint
```

Ejemplo:

```http
POST /api/ai/generate-user-story
```

Request:

```json
{
  "requirement": "Implementar recuperación de contraseña mediante correo"
}
```

Response:

```json
{
  "title": "Recuperación de contraseña",
  "userStory": "Como usuario registrado quiero recuperar mi contraseña mediante correo electrónico para acceder nuevamente a mi cuenta.",
  "acceptanceCriteria": [
    "El usuario puede solicitar recuperación utilizando su correo.",
    "El sistema genera un token temporal.",
    "El usuario recibe un enlace de recuperación.",
    "El token debe expirar."
  ]
}
```

---

# 13. Arquitectura del backend con Spring Boot

Se puede utilizar una arquitectura por capas:

```text
controller
     ↓
service
     ↓
repository
     ↓
database
```

Una estructura inicial podría ser:

```text
src/main/java/com/flowpilot

├── config
├── controller
├── dto
├── entity
├── exception
├── mapper
├── repository
├── security
├── service
│
├── ai
│   ├── service
│   ├── dto
│   └── prompt
│
└── FlowPilotApplication.java
```

También se puede evolucionar posteriormente hacia una arquitectura limpia o hexagonal.

---

# 14. Seguridad

El backend utilizará Spring Security.

Características:

- JWT Access Token.
- Refresh Tokens.
- Password hashing con BCrypt.
- Control de permisos.
- Roles.
- Validación de entradas.
- Manejo global de excepciones.

Ejemplo:

```text
Cliente
   ↓
POST /login
   ↓
Spring Security
   ↓
JWT
   ↓
Cliente
   ↓
Authorization: Bearer TOKEN
```

---

# 15. Etapas de desarrollo

Para evitar que el proyecto crezca demasiado desde el inicio, se propone desarrollarlo progresivamente.

---

## MVP

Objetivo: construir las funcionalidades esenciales.

### Funcionalidades

- Autenticación.
- Usuarios.
- Proyectos.
- Miembros.
- Tareas.
- Estados.
- Tablero Kanban.
- Drag & Drop.

---

## Versión 1.0

Agregar funcionalidades de gestión ágil.

### Funcionalidades

- Backlog.
- Historias de usuario.
- Bugs.
- Sprints.
- Story Points.
- Dashboard.
- Comentarios.
- Actividad reciente.

---

## Versión 2.0 — Inteligencia Artificial

Agregar funcionalidades inteligentes.

### Funcionalidades

- Generación de historias de usuario.
- Generación de criterios de aceptación.
- Generación de subtareas.
- Mejora automática de historias.
- Creación inicial de proyectos mediante IA.
- AI Insights.
- Análisis de riesgos.

---

## Versión 3.0

Posibles mejoras futuras.

- Notificaciones.
- WebSockets.
- Integración con GitHub.
- Integración con GitLab.
- Adjuntos.
- Reportes avanzados.
- Exportación PDF.
- Exportación Excel.
- Registro de tiempo.
- Roadmaps.
- Dependencias visuales.
- RAG para documentación del proyecto.
- Asistente conversacional contextual.

---

# 16. Posible integración con GitHub

En futuras versiones se podría conectar FlowPilot con GitHub.

Ejemplos:

```text
TASK-21
   ↓
Branch
feature/TASK-21-login
   ↓
Pull Request
   ↓
FlowPilot
```

El sistema podría mostrar:

- Branch relacionada.
- Commits.
- Pull Requests.
- Estado del Pull Request.
- Autor.

---

# 17. Posible asistente conversacional

En versiones futuras se puede implementar un chat contextual.

Ejemplo:

```text
Usuario:
¿Qué tareas están bloqueando el sprint?

FlowPilot AI:
Actualmente existen tres tareas bloqueadas.

TASK-31 bloquea TASK-42 y TASK-45.

TASK-37 depende de una integración externa que todavía no ha sido completada.
```

El asistente utilizaría datos reales del proyecto.

---

# 18. Nombre y branding

Nombre recomendado:

# FlowPilot

Significado:

```text
Flow  → Flujo de trabajo
Pilot → Asistente que ayuda a dirigir el proyecto
```

Descripción:

> AI-powered Project Management Platform.

Alternativas:

- Nexo AI.
- SprintAI.
- TaskMind.
- Projectia.

---

# 19. Descripción para portafolio

## FlowPilot — AI Project Management Platform

FlowPilot es una plataforma Full Stack para la gestión ágil de proyectos y equipos.

Permite administrar proyectos, backlogs, historias de usuario, sprints y tableros Kanban, incorporando Inteligencia Artificial para transformar requerimientos en historias de usuario, generar criterios de aceptación, dividir funcionalidades en tareas y analizar riesgos del proyecto.

### Tecnologías

```text
Angular
Java
Spring Boot
Spring Security
PostgreSQL
OpenAI API
Claude
Docker
GitHub Actions
```

---

# 20. Objetivos del proyecto dentro del portafolio

Este proyecto permitirá demostrar conocimientos en:

- Desarrollo Frontend.
- Desarrollo Backend.
- Java.
- Spring Boot.
- Angular.
- Diseño de APIs REST.
- PostgreSQL.
- Diseño de bases de datos.
- Arquitectura de software.
- Autenticación y autorización.
- Inteligencia Artificial.
- Integración con APIs externas.
- Docker.
- CI/CD.
- UX/UI.
- Gestión de proyectos ágiles.

---

# 21. Resultado esperado

El resultado final debería ser una aplicación funcional y desplegada públicamente.

El proyecto debería contar con:

- Aplicación web.
- API REST documentada.
- Base de datos.
- Integración con Inteligencia Artificial.
- Código fuente en GitHub.
- Dockerización.
- README técnico.
- Capturas de pantalla.
- Demo funcional.
- Documentación de arquitectura.

Esto permitirá utilizar FlowPilot como uno de los proyectos principales del portafolio profesional.
