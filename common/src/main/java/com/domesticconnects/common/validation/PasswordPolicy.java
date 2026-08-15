package com.domesticconnects.common.validation;

import java.util.regex.Pattern;

/**
 * Single source of truth for the app-wide password policy: 8–10 characters
 * containing at least one uppercase letter, one lowercase letter, one digit
 * and one special character. Mirrors the frontend validator
 * ({@code frontend/src/utils/validation.js} — {@code passwordError()}).
 * <p>
 * Used by the {@link ValidPassword} Bean Validation constraint (declared on
 * request DTOs) and directly by service code that needs the policy without a
 * constraint annotation.
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 10;

    private static final Pattern COMPOSITION = Pattern.compile(
            "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).*$");

    private PasswordPolicy() {
    }

    /**
     * Returns a human-readable violation message when the password does not
     * satisfy the policy, or {@code null} when it is acceptable.
     */
    public static String error(String password) {
        if (password == null || password.isBlank()) {
            return "Password is required";
        }
        if (password.length() < MIN_LENGTH || password.length() > MAX_LENGTH) {
            return "Password must be between " + MIN_LENGTH + " and " + MAX_LENGTH
                    + " characters";
        }
        if (!COMPOSITION.matcher(password).matches()) {
            return "Password must include uppercase, lowercase, a number, and a special character";
        }
        return null;
    }
}
