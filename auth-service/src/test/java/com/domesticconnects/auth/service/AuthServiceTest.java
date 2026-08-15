package com.domesticconnects.auth.service;

import com.domesticconnects.auth.dto.*;
import com.domesticconnects.auth.entity.PasswordResetToken;
import com.domesticconnects.auth.entity.Role;
import com.domesticconnects.auth.entity.User;
import com.domesticconnects.auth.exception.ResourceNotFoundException;
import com.domesticconnects.auth.exception.TokenRefreshException;
import com.domesticconnects.auth.exception.UserAlreadyExistsException;
import com.domesticconnects.auth.repository.PasswordResetTokenRepository;
import com.domesticconnects.auth.repository.UserRepository;
import com.domesticconnects.auth.security.JwtUtils;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService")
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtUtils jwtUtils;

    private AuthService authService;

    @Captor
    private ArgumentCaptor<User> userCaptor;

    @Captor
    private ArgumentCaptor<PasswordResetToken> resetTokenCaptor;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordResetTokenRepository,
                passwordEncoder, authenticationManager, jwtUtils);
        ReflectionTestUtils.setField(authService, "accessTokenExpiration", 900000L);
        ReflectionTestUtils.setField(authService, "resetTokenExpirationMinutes", 30L);
        ReflectionTestUtils.setField(authService, "frontendBaseUrl", "http://localhost:5173");
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(
                    digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    private User createTestUser(Long id, String email, Role role, boolean active) {
        return User.builder()
                .id(id)
                .name("Test User")
                .email(email)
                .password("encoded-password")
                .role(role)
                .isActive(active)
                .build();
    }

    @Nested
    @DisplayName("Register")
    class Register {

        @Test
        @DisplayName("should register a new user and return auth response")
        void shouldRegisterNewUser() {
            RegisterRequest request = new RegisterRequest();
            request.setName("Alice");
            request.setEmail("alice@example.com");
            request.setPassword("password123");
            request.setRole(Role.WORKER);

            User savedUser = User.builder()
                    .id(1L)
                    .name("Alice")
                    .email("alice@example.com")
                    .password("bcrypt-hashed")
                    .role(Role.WORKER)
                    .isActive(true)
                    .build();

            when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
            when(passwordEncoder.encode("password123")).thenReturn("bcrypt-hashed");
            when(userRepository.save(any(User.class))).thenReturn(savedUser);
            when(jwtUtils.generateAccessToken("alice@example.com", 1L, Role.WORKER))
                    .thenReturn("access-token");
            when(jwtUtils.generateRefreshToken("alice@example.com"))
                    .thenReturn("refresh-token");

            AuthResponse response = authService.register(request);

            assertThat(response).isNotNull();
            assertThat(response.getAccessToken()).isEqualTo("access-token");
            assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
            assertThat(response.getTokenType()).isEqualTo("Bearer");
            assertThat(response.getUser().getEmail()).isEqualTo("alice@example.com");
            assertThat(response.getUser().getRole()).isEqualTo(Role.WORKER);
            assertThat(response.getUser().isActive()).isTrue();

            verify(userRepository).existsByEmail("alice@example.com");
            verify(userRepository).save(userCaptor.capture());
            User captured = userCaptor.getValue();
            assertThat(captured.getEmail()).isEqualTo("alice@example.com");
            assertThat(captured.isActive()).isTrue();
        }

        @Test
        @DisplayName("should throw UserAlreadyExistsException for duplicate email")
        void shouldThrowForDuplicateEmail() {
            RegisterRequest request = new RegisterRequest();
            request.setEmail("existing@example.com");

            when(userRepository.existsByEmail("existing@example.com")).thenReturn(true);

            assertThatThrownBy(() -> authService.register(request))
                    .isInstanceOf(UserAlreadyExistsException.class)
                    .hasMessageContaining("existing@example.com");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("should encode password before saving")
        void shouldEncodePassword() {
            RegisterRequest request = new RegisterRequest();
            request.setName("Bob");
            request.setEmail("bob@example.com");
            request.setPassword("plain-password");
            request.setRole(Role.EMPLOYER);

            User savedUser = User.builder()
                    .id(2L)
                    .name("Bob")
                    .email("bob@example.com")
                    .password("bcrypt-hashed")
                    .role(Role.EMPLOYER)
                    .isActive(true)
                    .build();

            when(userRepository.existsByEmail("bob@example.com")).thenReturn(false);
            when(passwordEncoder.encode("plain-password")).thenReturn("bcrypt-hashed");
            when(userRepository.save(any(User.class))).thenReturn(savedUser);
            when(jwtUtils.generateAccessToken(anyString(), anyLong(), any())).thenReturn("token");
            when(jwtUtils.generateRefreshToken(anyString())).thenReturn("rtoken");

            authService.register(request);

            verify(passwordEncoder).encode("plain-password");
            verify(userRepository).save(userCaptor.capture());
            assertThat(userCaptor.getValue().getPassword()).isEqualTo("bcrypt-hashed");
        }
    }

    @Nested
    @DisplayName("Password Reset")
    class PasswordReset {

        @Test
        @DisplayName("should issue a hashed reset token and reset link for an existing user")
        void shouldIssueResetToken() {
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true);
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

            ApiResponse<PasswordResetResponse> response =
                    authService.forgotPassword("alice@example.com");

            assertThat(response.isSuccess()).isTrue();
            PasswordResetResponse data = response.getData();
            assertThat(data).isNotNull();
            assertThat(data.getToken()).isNotBlank();
            assertThat(data.getResetLink())
                    .isEqualTo("http://localhost:5173/reset-password?token=" + data.getToken());
            assertThat(data.getExpiresInMinutes()).isEqualTo(30);

            verify(passwordResetTokenRepository).deleteByUserId(1L);
            verify(passwordResetTokenRepository).save(resetTokenCaptor.capture());
            PasswordResetToken saved = resetTokenCaptor.getValue();
            assertThat(saved.getUserId()).isEqualTo(1L);
            // Only the digest is stored — never the raw token.
            assertThat(saved.getTokenHash()).isEqualTo(sha256Hex(data.getToken()));
            assertThat(saved.getTokenHash()).isNotEqualTo(data.getToken());
        }

        @Test
        @DisplayName("should not reveal whether an email is registered")
        void shouldNotRevealUnknownEmail() {
            when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

            ApiResponse<PasswordResetResponse> response =
                    authService.forgotPassword("ghost@example.com");

            assertThat(response.isSuccess()).isTrue();
            assertThat(response.getData()).isNull();
            verify(passwordResetTokenRepository, never()).save(any());
        }

        @Test
        @DisplayName("should reset the password and delete the token")
        void shouldResetPassword() {
            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .id(10L)
                    .userId(1L)
                    .tokenHash(sha256Hex("raw-token"))
                    .expiresAt(LocalDateTime.now().plusMinutes(30))
                    .build();
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true);

            when(passwordResetTokenRepository.findByTokenHash(sha256Hex("raw-token")))
                    .thenReturn(Optional.of(resetToken));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(passwordEncoder.encode("Newpass1!")).thenReturn("new-bcrypt");

            ApiResponse<Void> response = authService.resetPassword("raw-token", "Newpass1!");

            assertThat(response.isSuccess()).isTrue();
            verify(passwordEncoder).encode("Newpass1!");
            verify(userRepository).save(userCaptor.capture());
            assertThat(userCaptor.getValue().getPassword()).isEqualTo("new-bcrypt");
            verify(passwordResetTokenRepository).delete(resetToken);
        }

        @Test
        @DisplayName("should reject an expired token")
        void shouldRejectExpiredToken() {
            PasswordResetToken expired = PasswordResetToken.builder()
                    .id(11L)
                    .userId(1L)
                    .tokenHash(sha256Hex("old-token"))
                    .expiresAt(LocalDateTime.now().minusMinutes(1))
                    .build();
            when(passwordResetTokenRepository.findByTokenHash(sha256Hex("old-token")))
                    .thenReturn(Optional.of(expired));

            assertThatThrownBy(() -> authService.resetPassword("old-token", "Newpass1!"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Invalid or expired");

            verify(userRepository, never()).save(any());
            verify(passwordResetTokenRepository, never()).delete(any());
        }

        @Test
        @DisplayName("should reject an unknown or already-used token")
        void shouldRejectUnknownToken() {
            when(passwordResetTokenRepository.findByTokenHash(anyString()))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.resetPassword("unknown-token", "Newpass1!"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Invalid or expired");

            verify(userRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("Login")
    class Login {

        @Test
        @DisplayName("should authenticate and return tokens for active user")
        void shouldLoginActiveUser() {
            LoginRequest request = new LoginRequest();
            request.setEmail("alice@example.com");
            request.setPassword("password123");

            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true);

            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
            when(jwtUtils.generateAccessToken("alice@example.com", 1L, Role.WORKER))
                    .thenReturn("access-token");
            when(jwtUtils.generateRefreshToken("alice@example.com"))
                    .thenReturn("refresh-token");

            AuthResponse response = authService.login(request);

            assertThat(response.getAccessToken()).isEqualTo("access-token");
            assertThat(response.getRefreshToken()).isEqualTo("refresh-token");

            verify(authenticationManager).authenticate(
                    new UsernamePasswordAuthenticationToken("alice@example.com", "password123"));
        }

        @Test
        @DisplayName("should throw for deactivated user")
        void shouldThrowForDeactivatedUser() {
            LoginRequest request = new LoginRequest();
            request.setEmail("deactivated@example.com");
            request.setPassword("password123");

            User user = createTestUser(2L, "deactivated@example.com", Role.WORKER, false);

            when(userRepository.findByEmail("deactivated@example.com")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("deactivated");
        }

        @Test
        @DisplayName("passes through BadCredentialsException from authentication manager")
        void shouldPassThroughBadCredentials() {
            LoginRequest request = new LoginRequest();
            request.setEmail("wrong@example.com");
            request.setPassword("wrong-password");

            doThrow(new BadCredentialsException("Bad credentials"))
                    .when(authenticationManager)
                    .authenticate(any());

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(BadCredentialsException.class);
        }
    }

    @Nested
    @DisplayName("Refresh Token")
    class RefreshToken {

        @Test
        @DisplayName("should issue new tokens for valid refresh token")
        void shouldRefreshTokens() {
            RefreshTokenRequest request = new RefreshTokenRequest();
            request.setRefreshToken("valid-refresh-token");

            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true);

            when(jwtUtils.validateToken("valid-refresh-token")).thenReturn(true);
            when(jwtUtils.getTokenType("valid-refresh-token")).thenReturn("refresh");
            when(jwtUtils.getEmailFromToken("valid-refresh-token")).thenReturn("alice@example.com");
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
            when(jwtUtils.generateAccessToken("alice@example.com", 1L, Role.WORKER))
                    .thenReturn("new-access-token");
            when(jwtUtils.generateRefreshToken("alice@example.com"))
                    .thenReturn("new-refresh-token");

            AuthResponse response = authService.refresh(request);

            assertThat(response.getAccessToken()).isEqualTo("new-access-token");
            assertThat(response.getRefreshToken()).isEqualTo("new-refresh-token");
        }

        @Test
        @DisplayName("should throw for invalid refresh token")
        void shouldThrowForInvalidToken() {
            RefreshTokenRequest request = new RefreshTokenRequest();
            request.setRefreshToken("invalid-token");

            when(jwtUtils.validateToken("invalid-token")).thenReturn(false);

            assertThatThrownBy(() -> authService.refresh(request))
                    .isInstanceOf(TokenRefreshException.class)
                    .hasMessageContaining("Invalid or expired");
        }

        @Test
        @DisplayName("should throw when access token is used as refresh token")
        void shouldThrowWhenAccessTokenUsed() {
            RefreshTokenRequest request = new RefreshTokenRequest();
            request.setRefreshToken("access-token");

            when(jwtUtils.validateToken("access-token")).thenReturn(true);
            when(jwtUtils.getTokenType("access-token")).thenReturn("access");

            assertThatThrownBy(() -> authService.refresh(request))
                    .isInstanceOf(TokenRefreshException.class)
                    .hasMessageContaining("not a refresh token");
        }

        @Test
        @DisplayName("should throw for deactivated user during refresh")
        void shouldThrowForDeactivatedUser() {
            RefreshTokenRequest request = new RefreshTokenRequest();
            request.setRefreshToken("valid-refresh-token");

            User user = createTestUser(1L, "alice@example.com", Role.WORKER, false);

            when(jwtUtils.validateToken("valid-refresh-token")).thenReturn(true);
            when(jwtUtils.getTokenType("valid-refresh-token")).thenReturn("refresh");
            when(jwtUtils.getEmailFromToken("valid-refresh-token")).thenReturn("alice@example.com");
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> authService.refresh(request))
                    .isInstanceOf(TokenRefreshException.class)
                    .hasMessageContaining("deactivated");
        }

        @Test
        @DisplayName("should throw when user not found for refresh token")
        void shouldThrowWhenUserNotFound() {
            RefreshTokenRequest request = new RefreshTokenRequest();
            request.setRefreshToken("valid-refresh-token");

            when(jwtUtils.validateToken("valid-refresh-token")).thenReturn(true);
            when(jwtUtils.getTokenType("valid-refresh-token")).thenReturn("refresh");
            when(jwtUtils.getEmailFromToken("valid-refresh-token")).thenReturn("ghost@example.com");
            when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.refresh(request))
                    .isInstanceOf(TokenRefreshException.class)
                    .hasMessageContaining("User not found");
        }
    }

    @Nested
    @DisplayName("Admin - Activate User")
    class ActivateUser {

        @Test
        @DisplayName("should activate a deactivated user")
        void shouldActivateUser() {
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, false);

            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenReturn(user);

            ApiResponse<Void> response = authService.activateUser(1L);

            assertThat(response.isSuccess()).isTrue();
            assertThat(response.getMessage()).contains("activated");

            verify(userRepository).save(userCaptor.capture());
            assertThat(userCaptor.getValue().isActive()).isTrue();
        }

        @Test
        @DisplayName("should indicate if user is already active")
        void shouldReturnAlreadyActive() {
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true);

            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            ApiResponse<Void> response = authService.activateUser(1L);

            assertThat(response.isSuccess()).isTrue();
            assertThat(response.getMessage()).contains("already active");
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("should throw for non-existent user")
        void shouldThrowForUnknownUser() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.activateUser(999L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("User");
        }
    }

    @Nested
    @DisplayName("Admin - Deactivate User")
    class DeactivateUser {

        @Test
        @DisplayName("should deactivate an active user")
        void shouldDeactivateUser() {
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true);

            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenReturn(user);

            ApiResponse<Void> response = authService.deactivateUser(1L);

            assertThat(response.isSuccess()).isTrue();
            assertThat(response.getMessage()).contains("deactivated");

            verify(userRepository).save(userCaptor.capture());
            assertThat(userCaptor.getValue().isActive()).isFalse();
        }

        @Test
        @DisplayName("should indicate if user is already deactivated")
        void shouldReturnAlreadyDeactivated() {
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, false);

            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            ApiResponse<Void> response = authService.deactivateUser(1L);

            assertThat(response.isSuccess()).isTrue();
            assertThat(response.getMessage()).contains("already deactivated");
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("should throw for non-existent user")
        void shouldThrowForUnknownUser() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.deactivateUser(999L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("User");
        }
    }
}
