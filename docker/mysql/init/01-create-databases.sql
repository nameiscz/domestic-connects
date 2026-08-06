-- Creates the databases used by each microservice.
-- Executed automatically by the MySQL Docker image on first initialization
-- (mounted into /docker-entrypoint-initdb.d). Tables are created later by
-- Hibernate (spring.jpa.hibernate.ddl-auto=update) once the services start.
--
-- The docker-compose.yml environment overrides (SPRING_DATASOURCE_URL) point
-- the services at the schemas below. NOTE: init scripts only run once, when
-- the `mysql-data` volume is empty — run `docker compose down -v` to re-init.

CREATE DATABASE IF NOT EXISTS auth_db;
CREATE DATABASE IF NOT EXISTS job_db;
CREATE DATABASE IF NOT EXISTS attendance_db;
CREATE DATABASE IF NOT EXISTS payroll_db;
CREATE DATABASE IF NOT EXISTS performance_db;
-- admin_db is reserved for the future: admin-service is currently a stateless
-- aggregator (OpenFeign + Redis cache) and does not connect to MySQL.
CREATE DATABASE IF NOT EXISTS admin_db;
CREATE DATABASE IF NOT EXISTS notification_db;

-- ---------------------------------------------------------------------------
-- Legacy domestic_connects_* schemas — kept only for non-Docker local runs
-- (mvn spring-boot:run) where config-server's config-repo defaults still point
-- at these names. Safe to remove once config-repo is aligned with the names
-- above.
-- ---------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS domestic_connects_auth;
CREATE DATABASE IF NOT EXISTS domestic_connects_jobs;
CREATE DATABASE IF NOT EXISTS domestic_connects_attendance;
CREATE DATABASE IF NOT EXISTS domestic_connects_payroll;
CREATE DATABASE IF NOT EXISTS domestic_connects_performance;
CREATE DATABASE IF NOT EXISTS domestic_connects_notifications;
