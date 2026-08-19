-- 03-add-phone-column.sql
-- Add optional phone column to the users table for profile updates.

ALTER TABLE users
    ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER role;
