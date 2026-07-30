package com.domesticconnects.auth.controller;

import com.domesticconnects.auth.dto.AuthResponse;
import com.domesticconnects.auth.dto.LoginRequest;
import com.domesticconnects.auth.dto.RefreshTokenRequest;
import com.domesticconnects.auth.dto.RegisterRequest;
import com.domesticconnects.auth.entity.Role;
import com.domesticconnects.auth.entity.User;
import com.domesticconnects.auth.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("AuthController Integration Tests")
class AuthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    private User createAndSaveUser(String email, Role role, boolean verified, boolean active) {
        User user = User.builder()
                .name("Test User")
                .email(email)
                .password(passwordEncoder.encode("password123"))
                .role(role)
                .isVerified(verified)
                .isActive(active)
                .verificationToken(verified ? null : "verify-token-" + email)
                .build();
        return userRepository.save(user);
    }

    @Nested
    @DisplayName("POST /auth/register")
    class Register {

        @Test
        @DisplayName("should register a new user successfully")
        void shouldRegisterUser() throws Exception {
            RegisterRequest request = new RegisterRequest();
            request.setName("Alice");
            request.setEmail("alice@example.com");
            request.setPassword("password123");
            request.setRole(Role.WORKER);

            mockMvc.perform(post("/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                    .andExpect(jsonPath("$.tokenType").value("Bearer"))
                    .andExpect(jsonPath("$.user.name").value("Alice"))
                    .andExpect(jsonPath("$.user.email").value("alice@example.com"))
                    .andExpect(jsonPath("$.user.role").value("WORKER"))
                    .andExpect(jsonPath("$.user.verified").isBoolean())
                    .andExpect(jsonPath("$.user.active").isBoolean());

            assertThat(userRepository.findByEmail("alice@example.com")).isPresent();
        }

        @Test
        @DisplayName("should return 409 for duplicate email")
        void shouldReturn409ForDuplicateEmail() throws Exception {
            createAndSaveUser("duplicate@example.com", Role.WORKER, false, true);

            RegisterRequest request = new RegisterRequest();
            request.setName("Bob");
            request.setEmail("duplicate@example.com");
            request.setPassword("password123");
            request.setRole(Role.WORKER);

            mockMvc.perform(post("/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("already exists")));
        }

        @Test
        @DisplayName("should return 400 for invalid request")
        void shouldReturn400ForInvalidRequest() throws Exception {
            RegisterRequest request = new RegisterRequest();
            request.setName("");  // Invalid: blank
            request.setEmail("not-an-email");  // Invalid: not an email
            request.setPassword("12");  // Invalid: too short
            // Missing role

            mockMvc.perform(post("/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("POST /auth/login")
    class Login {

        @Test
        @DisplayName("should login with valid credentials")
        void shouldLogin() throws Exception {
            createAndSaveUser("login@example.com", Role.WORKER, true, true);

            LoginRequest request = new LoginRequest();
            request.setEmail("login@example.com");
            request.setPassword("password123");

            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                    .andExpect(jsonPath("$.user.email").value("login@example.com"))
                    .andExpect(jsonPath("$.user.role").value("WORKER"))
                    .andExpect(jsonPath("$.user.verified").value(true))
                    .andExpect(jsonPath("$.user.active").value(true));
        }

        @Test
        @DisplayName("should return 401 for wrong password")
        void shouldReturn401ForWrongPassword() throws Exception {
            createAndSaveUser("wrongpass@example.com", Role.WORKER, true, true);

            LoginRequest request = new LoginRequest();
            request.setEmail("wrongpass@example.com");
            request.setPassword("wrong-password");

            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("should return 400 for unverified user")
        void shouldReturn400ForUnverifiedUser() throws Exception {
            createAndSaveUser("unverified@example.com", Role.WORKER, false, true);

            LoginRequest request = new LoginRequest();
            request.setEmail("unverified@example.com");
            request.setPassword("password123");

            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("verify your email")));
        }

        @Test
        @DisplayName("should return 400 for deactivated user")
        void shouldReturn400ForDeactivatedUser() throws Exception {
            createAndSaveUser("deactivated@example.com", Role.WORKER, true, false);

            LoginRequest request = new LoginRequest();
            request.setEmail("deactivated@example.com");
            request.setPassword("password123");

            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("deactivated")));
        }
    }

    @Nested
    @DisplayName("POST /auth/refresh")
    class Refresh {

        @Test
        @DisplayName("should refresh tokens with valid refresh token")
        void shouldRefreshTokens() throws Exception {
            createAndSaveUser("refresh@example.com", Role.WORKER, true, true);

            // First login to get a refresh token
            LoginRequest loginRequest = new LoginRequest();
            loginRequest.setEmail("refresh@example.com");
            loginRequest.setPassword("password123");

            MvcResult loginResult = mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(loginRequest)))
                    .andExpect(status().isOk())
                    .andReturn();

            String responseBody = loginResult.getResponse().getContentAsString();
            AuthResponse authResponse = objectMapper.readValue(responseBody, AuthResponse.class);
            String refreshToken = authResponse.getRefreshToken();

            // Now use the refresh token
            RefreshTokenRequest refreshRequest = new RefreshTokenRequest();
            refreshRequest.setRefreshToken(refreshToken);

            mockMvc.perform(post("/auth/refresh")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(refreshRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.refreshToken").isNotEmpty());
        }

        @Test
        @DisplayName("should return 401 for invalid refresh token")
        void shouldReturn401ForInvalidToken() throws Exception {
            RefreshTokenRequest request = new RefreshTokenRequest();
            request.setRefreshToken("bogus-refresh-token");

            mockMvc.perform(post("/auth/refresh")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("POST /auth/verify/{token}")
    class Verify {

        @Test
        @DisplayName("should verify user with valid token")
        void shouldVerifyUser() throws Exception {
            createAndSaveUser("verify@example.com", Role.WORKER, false, true);

            mockMvc.perform(post("/auth/verify/verify-token-verify@example.com"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("verified successfully")));

            // Verify the user is now verified in the database
            User verifiedUser = userRepository.findByEmail("verify@example.com").orElseThrow();
            assertThat(verifiedUser.isVerified()).isTrue();
            assertThat(verifiedUser.getVerificationToken()).isNull();
        }

        @Test
        @DisplayName("should indicate if already verified")
        void shouldIndicateAlreadyVerified() throws Exception {
            // Create a verified user that still has a verificationToken set
            User user = User.builder()
                    .name("Already Verified")
                    .email("already-verified@example.com")
                    .password(passwordEncoder.encode("password123"))
                    .role(Role.WORKER)
                    .isVerified(true)
                    .isActive(true)
                    .verificationToken("already-used-token")
                    .build();
            userRepository.save(user);

            mockMvc.perform(post("/auth/verify/already-used-token"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("already verified")));
        }

        @Test
        @DisplayName("should return 404 for invalid token")
        void shouldReturn404ForInvalidToken() throws Exception {
            mockMvc.perform(post("/auth/verify/nonexistent-token"))
                    .andExpect(status().isNotFound());
        }
    }
}
