package com.domesticconnects.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Bean Validation constraint enforcing the shared password policy (see
 * {@link PasswordPolicy}). Apply to String fields (or method parameters) that
 * hold a password — e.g. registration and password-reset request DTOs.
 * <p>
 * The reported violation message is the specific policy message (length vs.
 * composition), not this generic default.
 */
@Documented
@Constraint(validatedBy = PasswordValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidPassword {

    String message() default "Password must be 8–10 characters and include uppercase, "
            + "lowercase, a number, and a special character";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
