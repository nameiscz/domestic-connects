package com.domesticconnects.auth.exception;

import com.domesticconnects.auth.dto.ApiResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("GlobalExceptionHandler")
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Nested
    @DisplayName("ResourceNotFoundException")
    class ResourceNotFound {

        @Test
        @DisplayName("should return 404")
        void shouldReturn404() {
            var ex = new ResourceNotFoundException("User", "id", 1L);

            ResponseEntity<ApiResponse<Void>> response = handler.handleResourceNotFound(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().isSuccess()).isFalse();
            assertThat(response.getBody().getMessage()).contains("User not found with id: '1'");
        }
    }

    @Nested
    @DisplayName("UserAlreadyExistsException")
    class UserAlreadyExists {

        @Test
        @DisplayName("should return 409")
        void shouldReturn409() {
            var ex = new UserAlreadyExistsException("User already exists");

            ResponseEntity<ApiResponse<Void>> response = handler.handleUserAlreadyExists(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().isSuccess()).isFalse();
            assertThat(response.getBody().getMessage()).isEqualTo("User already exists");
        }
    }

    @Nested
    @DisplayName("TokenRefreshException")
    class TokenRefresh {

        @Test
        @DisplayName("should return 401")
        void shouldReturn401() {
            var ex = new TokenRefreshException("Token expired");

            ResponseEntity<ApiResponse<Void>> response = handler.handleTokenRefresh(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Token expired");
        }
    }

    @Nested
    @DisplayName("BadCredentialsException")
    class BadCredentials {

        @Test
        @DisplayName("should return 401 with generic message")
        void shouldReturn401() {
            var ex = new BadCredentialsException("bad credentials");

            ResponseEntity<ApiResponse<Void>> response = handler.handleBadCredentials(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Invalid email or password");
        }
    }

    @Nested
    @DisplayName("UsernameNotFoundException")
    class UsernameNotFound {

        @Test
        @DisplayName("should return 404")
        void shouldReturn404() {
            var ex = new UsernameNotFoundException("User not found");

            ResponseEntity<ApiResponse<Void>> response = handler.handleUsernameNotFound(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().isSuccess()).isFalse();
        }
    }

    @Nested
    @DisplayName("AccessDeniedException")
    class AccessDenied {

        @Test
        @DisplayName("should return 403")
        void shouldReturn403() {
            var ex = new AccessDeniedException("Access denied");

            ResponseEntity<ApiResponse<Void>> response = handler.handleAccessDenied(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Access denied: insufficient permissions");
        }
    }

    @Nested
    @DisplayName("IllegalArgumentException")
    class IllegalArgument {

        @Test
        @DisplayName("should return 400")
        void shouldReturn400() {
            var ex = new IllegalArgumentException("Invalid input");

            ResponseEntity<ApiResponse<Void>> response = handler.handleIllegalArgument(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Invalid input");
        }
    }

    @Nested
    @DisplayName("MethodArgumentNotValidException")
    class ValidationError {

        @Test
        @DisplayName("should return 400 with validation messages")
        void shouldReturn400() {
            BindingResult bindingResult = mock(BindingResult.class);
            when(bindingResult.getFieldErrors()).thenReturn(List.of(
                    new FieldError("obj", "email", "Email must be valid"),
                    new FieldError("obj", "password", "Password is required")
            ));
            var ex = new MethodArgumentNotValidException(null, bindingResult);

            ResponseEntity<ApiResponse<Void>> response = handler.handleValidationErrors(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).contains("Email must be valid");
            assertThat(response.getBody().getMessage()).contains("Password is required");
        }
    }

    @Nested
    @DisplayName("NoResourceFoundException")
    class NoResourceFound {

        @Test
        @DisplayName("should return 404 (not 500) for unknown paths")
        void shouldReturn404() {
            var ex = new NoResourceFoundException(HttpMethod.GET, "auth/unknown-route");

            ResponseEntity<ApiResponse<Void>> response = handler.handleNoResourceFound(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().isSuccess()).isFalse();
            assertThat(response.getBody().getMessage()).contains("auth/unknown-route");
        }
    }

    @Nested
    @DisplayName("General Exception")
    class General {

        @Test
        @DisplayName("should return 500")
        void shouldReturn500() {
            var ex = new RuntimeException("Something broke");

            ResponseEntity<ApiResponse<Void>> response = handler.handleGeneral(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().isSuccess()).isFalse();
            assertThat(response.getBody().getMessage()).contains("unexpected error");
        }
    }
}
