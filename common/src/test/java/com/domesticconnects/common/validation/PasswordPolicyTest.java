package com.domesticconnects.common.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("PasswordPolicy")
class PasswordPolicyTest {

    @Test
    @DisplayName("accepts an 8-character password meeting every requirement")
    void acceptsMinLength() {
        assertThat(PasswordPolicy.error("Newsec1!")).isNull();
    }

    @Test
    @DisplayName("accepts a 10-character password meeting every requirement")
    void acceptsMaxLength() {
        assertThat(PasswordPolicy.error("Newsecr12!")).isNull();
    }

    @Test
    @DisplayName("rejects null and blank passwords")
    void rejectsBlank() {
        assertThat(PasswordPolicy.error(null)).isEqualTo("Password is required");
        assertThat(PasswordPolicy.error("")).isEqualTo("Password is required");
        assertThat(PasswordPolicy.error("   ")).isEqualTo("Password is required");
    }

    @Test
    @DisplayName("rejects passwords shorter than 8 characters")
    void rejectsTooShort() {
        assertThat(PasswordPolicy.error("Newsec1")).contains("between 8 and 10");
    }

    @Test
    @DisplayName("rejects passwords longer than 10 characters")
    void rejectsTooLong() {
        assertThat(PasswordPolicy.error("Newsecret12!")).contains("between 8 and 10");
    }

    @Test
    @DisplayName("rejects a password missing an uppercase letter")
    void rejectsWithoutUppercase() {
        assertThat(PasswordPolicy.error("newsec1!")).contains("uppercase");
    }

    @Test
    @DisplayName("rejects a password missing a lowercase letter")
    void rejectsWithoutLowercase() {
        assertThat(PasswordPolicy.error("NEWSEC1!")).contains("lowercase");
    }

    @Test
    @DisplayName("rejects a password missing a digit")
    void rejectsWithoutDigit() {
        assertThat(PasswordPolicy.error("Newsec!!")).contains("number");
    }

    @Test
    @DisplayName("rejects a password missing a special character")
    void rejectsWithoutSpecial() {
        assertThat(PasswordPolicy.error("Newsec12")).contains("special character");
    }
}
