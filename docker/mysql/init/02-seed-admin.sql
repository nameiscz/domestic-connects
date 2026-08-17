-- Seeds one ADMIN account for end-to-end testing of /api/admin/* and the
-- admin dashboard. Runs automatically on a FRESH mysql-data volume (after
-- 01-create-databases.sql), or apply it to an existing stack with:
--
--   docker exec -i domestic-connects-mysql mysql -uroot -proot@123 auth_db \
--     < docker/mysql/init/02-seed-admin.sql
--
-- Safe to run repeatedly: the INSERT IGNORE relies on the unique email
-- constraint, so re-runs are no-ops and existing rows are never touched.
-- No DROP / ALTER statements anywhere in this file.
--
-- Credentials: admin@domesticconnects.com / Admin@123
-- Password is a BCrypt ($2a$, cost 10) hash generated with the SAME
-- spring-security-crypto version the auth-service runs (6.2.4) and verified
-- with BCrypt.checkpw (hash: $2a$10$RxzRS0bXq8thdAh.ek2xNObbRdvLfHKI0NQJedBXMvN6J.I7KzVSK).
USE auth_db;

-- Schema alignment: the User entity no longer maps `available_now` (removed in
-- commit 1103b58), so Hibernate's INSERT omits it and strict-mode MySQL rejects
-- registration unless the column has a default. Non-destructive, no DROP:
ALTER TABLE users ALTER COLUMN available_now SET DEFAULT b'0';

INSERT IGNORE INTO users (name, email, password, role, is_active, available_now, created_at)
VALUES ('Platform Admin', 'admin@domesticconnects.com',
        '$2a$10$RxzRS0bXq8thdAh.ek2xNObbRdvLfHKI0NQJedBXMvN6J.I7KzVSK',
        'ADMIN', b'1', b'0', NOW());
