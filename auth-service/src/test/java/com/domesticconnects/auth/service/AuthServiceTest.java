package com.domesticconnects.auth.service;

import com.domesticconnects.auth.dto.*;
import com.domesticconnects.auth.entity.Role;
import com.domesticconnects.auth.entity.User;
import com.domesticconnects.auth.exception.ResourceNotFoundException;
import com.domesticconnects.auth.exception.TokenRefreshException;
import com.domesticconnects.auth.exception.UserAlreadyExistsException;
import com.domesticconnects.auth.repository.UserRepository;
import com.domesticconnects.auth.security.JwtUtils;
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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
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
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtUtils jwtUtils;

    @Mock
    private VerificationMailer verificationMailer;

    private AuthService authService;

    @Captor
    private ArgumentCaptor<User> userCaptor;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordEncoder, authenticationManager,
                jwtUtils, verificationMailer);
        ReflectionTestUtils.setField(authService, "accessTokenExpiration", 900000L);
    }

    private User createTestUser(Long id, String email, Role role, boolean verified, boolean active) {
        return User.builder()
                .id(id)
                .name("Test User")
                .email(email)
                .password("encoded-password")
                .role(role)
                .isVerified(verified)
                .isActive(active)
                .verificationToken("vToken-" + id)
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
                    .isVerified(false)
                    .isActive(true)
                    .verificationToken("uuid-token")
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
            assertThat(response.getUser().isVerified()).isFalse();
            assertThat(response.getUser().isActive()).isTrue();

            verify(userRepository).existsByEmail("alice@example.com");
            verify(userRepository).save(userCaptor.capture());
            User captured = userCaptor.getValue();
            assertThat(captured.getVerificationToken()).isNotBlank();
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
                    .isVerified(false)
                    .isActive(true)
                    .verificationToken("uuid")
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

        @Test
        @DisplayName("should generate verification token on registration")
        void shouldGenerateVerificationToken() {
            RegisterRequest request = new RegisterRequest();
            request.setName("Charlie");
            request.setEmail("charlie@example.com");
            request.setPassword("password123");
            request.setRole(Role.WORKER);

            User savedUser = User.builder()
                    .id(3L)
                    .name("Charlie")
                    .email("charlie@example.com")
                    .password("hashed")
                    .role(Role.WORKER)
                    .isVerified(false)
                    .isActive(true)
                    .verificationToken("generated-uuid")
                    .build();

            when(userRepository.existsByEmail("charlie@example.com")).thenReturn(false);
            when(passwordEncoder.encode(anyString())).thenReturn("hashed");
            when(userRepository.save(any(User.class))).thenReturn(savedUser);
            when(jwtUtils.generateAccessToken(anyString(), anyLong(), any())).thenReturn("token");
            when(jwtUtils.generateRefreshToken(anyString())).thenReturn("rtoken");

            authService.register(request);

            verify(userRepository).save(userCaptor.capture());
            assertThat(userCaptor.getValue().getVerificationToken()).isNotEmpty();
        }
    }

    @Nested
    @DisplayName("Login")
    class Login {

        @Test
        @DisplayName("should authenticate and return tokens for active verified user")
        void shouldLoginActiveVerifiedUser() {
            LoginRequest request = new LoginRequest();
            request.setEmail("alice@example.com");
            request.setPassword("password123");

            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true, true);

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

            User user = createTestUser(2L, "deactivated@example.com", Role.WORKER, true, false);

            when(userRepository.findByEmail("deactivated@example.com")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("deactivated");
        }

        @Test
        @DisplayName("should throw for unverified user")
        void shouldThrowForUnverifiedUser() {
            LoginRequest request = new LoginRequest();
            request.setEmail("unverified@example.com");
            request.setPassword("password123");

            User user = createTestUser(3L, "unverified@example.com", Role.WORKER, false, true);

            when(userRepository.findByEmail("unverified@example.com")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("verify your email");
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

            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true, true);

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

            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true, false);

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
    @DisplayName("Verify Email")
    class VerifyEmail {

        @Test
        @DisplayName("should verify user with valid token")
        void shouldVerifyEmail() {
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, false, true);

            when(userRepository.findByVerificationToken("valid-token")).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenReturn(user);

            ApiResponse<Void> response = authService.verifyEmail("valid-token");

            assertThat(response.isSuccess()).isTrue();
            assertThat(response.getMessage()).contains("verified successfully");

            verify(userRepository).save(userCaptor.capture());
            assertThat(userCaptor.getValue().isVerified()).isTrue();
            assertThat(userCaptor.getValue().getVerificationToken()).isNull();
        }

        @Test
        @DisplayName("should indicate if email is already verified")
        void shouldReturnAlreadyVerified() {
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true, true);

            when(userRepository.findByVerificationToken("used-token")).thenReturn(Optional.of(user));

            ApiResponse<Void> response = authService.verifyEmail("used-token");

            assertThat(response.isSuccess()).isTrue();
            assertThat(response.getMessage()).contains("already verified");
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("should throw for invalid verification token")
        void shouldThrowForInvalidToken() {
            when(userRepository.findByVerificationToken("bogus-token")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.verifyEmail("bogus-token"))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Verification token");
        }
    }

    @Nested
    @DisplayName("Admin - Activate User")
    class ActivateUser {

        @Test
        @DisplayName("should activate a deactivated user")
        void shouldActivateUser() {
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true, false);

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
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true, true);

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
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true, true);

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
            User user = createTestUser(1L, "alice@example.com", Role.WORKER, true, false);

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
