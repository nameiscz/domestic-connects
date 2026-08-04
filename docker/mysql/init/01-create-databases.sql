-- Creates the databases used by each microservice.
-- Executed automatically by the MySQL Docker image on first initialization
-- (mounted into /docker-entrypoint-initdb.d). Tables are created later by
-- Hibernate (spring.jpa.hibernate.ddl-auto=update) once the services start.

CREATE DATABASE IF NOT EXISTS domestic_connects_auth;
CREATE DATABASE IF NOT EXISTS domestic_connects_jobs;
CREATE DATABASE IF NOT EXISTS domestic_connects_attendance;
CREATE DATABASE IF NOT EXISTS domestic_connects_payroll;
CREATE DATABASE IF NOT EXISTS domestic_connects_performance;
CREATE DATABASE IF NOT EXISTS domestic_connects_notifications;
