package com.domesticconnects.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Validates a password string against {@link PasswordPolicy}. The policy's
 * specific violation message (e.g. "between 8 and 10 characters") replaces the
 * annotation's generic default so callers get actionable feedback.
 */
public class PasswordValidator implements ConstraintValidator<ValidPassword, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        String error = PasswordPolicy.error(value);
        if (error == null) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(error).addConstraintViolation();
        return false;
    }
}
