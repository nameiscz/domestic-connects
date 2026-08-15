package com.domesticconnects.auth.controller;

import com.domesticconnects.auth.dto.AuthResponse;
import com.domesticconnects.auth.dto.ForgotPasswordRequest;
import com.domesticconnects.auth.dto.LoginRequest;
import com.domesticconnects.auth.dto.RefreshTokenRequest;
import com.domesticconnects.auth.dto.RegisterRequest;
import com.domesticconnects.auth.dto.ResetPasswordRequest;
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

    private User createAndSaveUser(String email, Role role, boolean active) {
        User user = User.builder()
                .name("Test User")
                .email(email)
                .password(passwordEncoder.encode("password123"))
                .role(role)
                .isActive(active)
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
            request.setPassword("Passw0rd!");
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
                    .andExpect(jsonPath("$.user.active").isBoolean());

            assertThat(userRepository.findByEmail("alice@example.com")).isPresent();
        }

        @Test
        @DisplayName("should return 409 for duplicate email")
        void shouldReturn409ForDuplicateEmail() throws Exception {
            createAndSaveUser("duplicate@example.com", Role.WORKER, true);

            RegisterRequest request = new RegisterRequest();
            request.setName("Bob");
            request.setEmail("duplicate@example.com");
            request.setPassword("Passw0rd!");
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

        @Test
        @DisplayName("should return 400 for a password missing required character types")
        void shouldReturn400ForWeakPassword() throws Exception {
            RegisterRequest request = new RegisterRequest();
            request.setName("Carol");
            request.setEmail("carol@example.com");
            request.setPassword("newsecret1");  // Right length, no uppercase/special
            request.setRole(Role.WORKER);

            mockMvc.perform(post("/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("uppercase")));
        }

        @Test
        @DisplayName("should return 400 for a password longer than 10 characters")
        void shouldReturn400ForLongPassword() throws Exception {
            RegisterRequest request = new RegisterRequest();
            request.setName("Dan");
            request.setEmail("dan@example.com");
            request.setPassword("Passw0rd!123");  // 11 characters
            request.setRole(Role.WORKER);

            mockMvc.perform(post("/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("between 8 and 10")));
        }
    }

    @Nested
    @DisplayName("POST /auth/forgot-password")
    class ForgotPassword {

        @Test
        @DisplayName("should issue a reset token and link for an existing user")
        void shouldIssueResetToken() throws Exception {
            createAndSaveUser("reset@example.com", Role.WORKER, true);

            ForgotPasswordRequest request = new ForgotPasswordRequest();
            request.setEmail("reset@example.com");

            mockMvc.perform(post("/auth/forgot-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.token").isNotEmpty())
                    .andExpect(jsonPath("$.data.resetLink").value(
                            org.hamcrest.Matchers.containsString("reset-password?token=")))
                    .andExpect(jsonPath("$.data.expiresInMinutes").value(30));
        }

        @Test
        @DisplayName("should return a generic success for an unknown email")
        void shouldNotRevealUnknownEmail() throws Exception {
            ForgotPasswordRequest request = new ForgotPasswordRequest();
            request.setEmail("ghost@example.com");

            mockMvc.perform(post("/auth/forgot-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data").value(org.hamcrest.Matchers.nullValue()));
        }
    }

    @Nested
    @DisplayName("POST /auth/reset-password")
    class ResetPassword {

        private String requestResetToken(String email) throws Exception {
            ForgotPasswordRequest forgot = new ForgotPasswordRequest();
            forgot.setEmail(email);
            MvcResult result = mockMvc.perform(post("/auth/forgot-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(forgot)))
                    .andExpect(status().isOk())
                    .andReturn();
            return objectMapper.readTree(result.getResponse().getContentAsString())
                    .at("/data/token").asText();
        }

        @Test
        @DisplayName("should reset the password and allow signing in with the new one")
        void shouldResetPasswordAndLogin() throws Exception {
            createAndSaveUser("resetme@example.com", Role.WORKER, true);
            String token = requestResetToken("resetme@example.com");

            ResetPasswordRequest reset = new ResetPasswordRequest();
            reset.setToken(token);
            reset.setNewPassword("Newpass1!");

            mockMvc.perform(post("/auth/reset-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(reset)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true));

            // The old password no longer works…
            LoginRequest oldLogin = new LoginRequest();
            oldLogin.setEmail("resetme@example.com");
            oldLogin.setPassword("password123");
            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(oldLogin)))
                    .andExpect(status().isUnauthorized());

            // …and the new one does.
            LoginRequest newLogin = new LoginRequest();
            newLogin.setEmail("resetme@example.com");
            newLogin.setPassword("Newpass1!");
            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(newLogin)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.user.email").value("resetme@example.com"));
        }

        @Test
        @DisplayName("should reject a token that was already used")
        void shouldRejectReusedToken() throws Exception {
            createAndSaveUser("onetime@example.com", Role.WORKER, true);
            String token = requestResetToken("onetime@example.com");

            ResetPasswordRequest reset = new ResetPasswordRequest();
            reset.setToken(token);
            reset.setNewPassword("Newpass1!");

            mockMvc.perform(post("/auth/reset-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(reset)))
                    .andExpect(status().isOk());

            // Same token again → single-use enforced.
            mockMvc.perform(post("/auth/reset-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(reset)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("Invalid or expired")));
        }

        @Test
        @DisplayName("should return 400 for an invalid token")
        void shouldRejectInvalidToken() throws Exception {
            ResetPasswordRequest reset = new ResetPasswordRequest();
            reset.setToken("bogus-token");
            reset.setNewPassword("Newpass1!");

            mockMvc.perform(post("/auth/reset-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(reset)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("Invalid or expired")));
        }

        @Test
        @DisplayName("should return 400 for a weak new password")
        void shouldRejectWeakPassword() throws Exception {
            createAndSaveUser("weak@example.com", Role.WORKER, true);
            String token = requestResetToken("weak@example.com");

            ResetPasswordRequest reset = new ResetPasswordRequest();
            reset.setToken(token);
            reset.setNewPassword("newsecret1");  // Right length, no uppercase/special

            mockMvc.perform(post("/auth/reset-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(reset)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("uppercase")));
        }
    }

    @Nested
    @DisplayName("POST /auth/login")
    class Login {

        @Test
        @DisplayName("should login with valid credentials")
        void shouldLogin() throws Exception {
            createAndSaveUser("login@example.com", Role.WORKER, true);

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
                    .andExpect(jsonPath("$.user.active").value(true));
        }

        @Test
        @DisplayName("should return 401 for wrong password")
        void shouldReturn401ForWrongPassword() throws Exception {
            createAndSaveUser("wrongpass@example.com", Role.WORKER, true);

            LoginRequest request = new LoginRequest();
            request.setEmail("wrongpass@example.com");
            request.setPassword("wrong-password");

            mockMvc.perform(post("/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("should return 400 for deactivated user")
        void shouldReturn400ForDeactivatedUser() throws Exception {
            createAndSaveUser("deactivated@example.com", Role.WORKER, false);

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
            createAndSaveUser("refresh@example.com", Role.WORKER, true);

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

}
