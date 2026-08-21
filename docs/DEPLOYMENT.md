# FlowPilot deployment and operations

This guide covers the supported production shape for FlowPilot. Use Docker Compose for local development or a single-host deployment; it is **not** a complete production platform. In production, put HTTPS/TLS termination in front of the frontend, keep the backend private behind that proxy, and keep PostgreSQL on a private network with no public exposure.

## Quick path

1. Provide a DNS name, an HTTPS reverse proxy, persistent database storage, and a backup destination.
2. Generate a strong random `FLOWPILOT_JWT_SECRET` (at least 32 bytes of entropy) and set the database variables listed below. Keep them in the host secret store or an ignored `.env`; never commit `.env`.
3. Build and deploy the backend with the `prod` Spring profile and the frontend behind the reverse proxy. Do not expose PostgreSQL publicly.
4. Run a pre-deployment database backup, apply the release, and verify `GET /actuator/health` returns HTTP 200 from a trusted internal path.
5. Inspect application and proxy logs, then complete the operational checklist.

## Prerequisites

- Docker and Docker Compose when using the container workflow.
- A DNS record and domain name for the frontend.
- An HTTPS/TLS certificate and reverse proxy or load balancer that terminates TLS.
- Persistent storage for PostgreSQL, plus a separate backup destination.
- Java 25 and Node 24 only when building or running outside Docker.

## Configuration and secrets

Required values:

| Variable | Purpose | Production guidance |
|---|---|---|
| `FLOWPILOT_JWT_SECRET` | Signs JWT access tokens | Use a strong random secret with at least 32-byte-equivalent entropy. Rotate deliberately because existing tokens will no longer validate. |
| `FLOWPILOT_DB_NAME` | PostgreSQL database name | Use a dedicated database. |
| `FLOWPILOT_DB_USERNAME` | PostgreSQL application user | Use a least-privilege application account. |
| `FLOWPILOT_DB_PASSWORD` | PostgreSQL application password | Use a unique secret; do not reuse demo credentials. |

Do not put real values in documentation, source control, images, or shell history. The repository's `.env.example` is a template for local setup; copy it to the ignored `.env` and replace placeholders locally. Never commit `.env`.

### Local Compose versus the production profile

The repository's `docker-compose.yml` is configured with the `docker` Spring profile. It creates a PostgreSQL container named `db` and passes a JDBC URL built from the Compose service name:

```text
jdbc:postgresql://db:5432/<FLOWPILOT_DB_NAME>
```

The `docker` profile also has local fallback database values, so production deployments must not rely on those defaults. Compose publishes the backend on port `8080`, the frontend on port `80`, and PostgreSQL on `127.0.0.1:5432`; these are local/single-host defaults, not TLS or network-isolation policy.

The production profile is `backend/src/main/resources/application-prod.yml`. It expects these separate backend settings:

| Setting | Required value |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `FLOWPILOT_DATASOURCE_URL` | A private PostgreSQL JDBC URL, for example `jdbc:postgresql://<private-db-host>:5432/<database>` |
| `FLOWPILOT_DATASOURCE_USERNAME` | The production database user |
| `FLOWPILOT_DATASOURCE_PASSWORD` | The production database password |
| `FLOWPILOT_JWT_SECRET` | The production JWT secret |

Do not confuse the Compose inputs (`FLOWPILOT_DB_*`) with the production profile's datasource inputs (`FLOWPILOT_DATASOURCE_*`). A deployment that runs the `prod` profile must provide the latter explicitly.

## Database persistence, migrations, and recovery

- Keep PostgreSQL data on persistent storage. The Compose volume is named `flowpilot-db-data`; deleting that volume deletes the local database.
- Back up the database before every deployment that may change the schema, and retain backups outside the host running FlowPilot.
- Test restores periodically in an isolated database. A backup is not a recovery plan until it has been restored successfully.
- Flyway is enabled in `backend/src/main/resources/application.yml`, with migrations under `backend/src/main/resources/db/migration/`. The application uses `ddl-auto: validate`; schema changes must therefore arrive through reviewed Flyway migrations.
- Let the deployed application apply compatible pending migrations at startup, and verify health and logs before serving traffic. Do not skip, edit, or manually reorder migrations in a live database.
- For a failed update, stop traffic if necessary, preserve the failed deployment logs, restore the database only when the rollback requires it, and redeploy the last known-good application image. Confirm schema compatibility before rolling back application code.

## Deployment, update, and rollback workflow

1. Review the release and its migration files. Build immutable backend and frontend images from the intended revision.
2. Create a database backup and confirm that the backup completed before changing the running version.
3. Load production secrets/configuration, start the backend with `SPRING_PROFILES_ACTIVE=prod`, and keep the database and backend on private networks.
4. Start the frontend and configure the reverse proxy to serve it over HTTPS. Forward `/api/` to the backend; do not publish the backend directly to the internet.
5. Check `GET /actuator/health` and review container/application/reverse-proxy logs. The endpoint is exposed as a health-only actuator endpoint and does not show details.
6. For updates, repeat the backup, deploy the new image, wait for health, and monitor logs and database health before declaring success.
7. For rollback, route traffic away, redeploy the previous known-good image, and restore the pre-deployment backup only if the migration or data state is incompatible. Re-check health and logs before reopening traffic.

## Operations checklist

- [ ] HTTPS is enforced at the reverse proxy and certificates have renewal monitoring.
- [ ] Backend port `8080` is private; PostgreSQL port `5432` is not publicly reachable.
- [ ] `FLOWPILOT_JWT_SECRET` and database credentials are stored outside Git and rotated under a documented procedure.
- [ ] Database backups run regularly, are retained separately, and restores are tested.
- [ ] Disk usage, PostgreSQL health, container restarts, application errors, and `/actuator/health` are monitored.
- [ ] Demo credentials from the local seed data are disabled or replaced; never use them in a real environment.
- [ ] Deployment backups and migration results are recorded before each release.

## Explicit limitations

- FlowPilot has no built-in email delivery; password-reset and other email-dependent operational flows require an external integration that is not supplied here.
- The repository does not provide high availability or zero-downtime orchestration.
- Local Compose defaults are intended for local or single-host use and do not provide a complete production platform, secret manager, TLS termination, backup scheduler, monitoring stack, or HA strategy.
