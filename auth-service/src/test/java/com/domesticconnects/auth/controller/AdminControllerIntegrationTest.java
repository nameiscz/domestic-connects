package com.domesticconnects.auth.controller;

import com.domesticconnects.auth.entity.Role;
import com.domesticconnects.auth.entity.User;
import com.domesticconnects.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("AdminController Integration Tests")
class AdminControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    private User createAndSaveUser(Long id, String email, Role role, boolean active) {
        User user = User.builder()
                .id(id)
                .name("Test User")
                .email(email)
                .password("encoded")
                .role(role)
                .isVerified(true)
                .isActive(active)
                .build();
        return userRepository.save(user);
    }

    @Nested
    @DisplayName("PATCH /auth/admin/users/{id}/activate")
    class Activate {

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("should activate a deactivated user when admin")
        void shouldActivateUser() throws Exception {
            User user = createAndSaveUser(100L, "deactivated@example.com", Role.WORKER, false);

            mockMvc.perform(patch("/auth/admin/users/{id}/activate", user.getId())
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("activated")));

            User updated = userRepository.findById(user.getId()).orElseThrow();
            assertThat(updated.isActive()).isTrue();
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("should indicate if already active")
        void shouldIndicateAlreadyActive() throws Exception {
            User user = createAndSaveUser(101L, "active@example.com", Role.WORKER, true);

            mockMvc.perform(patch("/auth/admin/users/{id}/activate", user.getId())
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("already active")));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("should return 404 for non-existent user")
        void shouldReturn404ForUnknownUser() throws Exception {
            mockMvc.perform(patch("/auth/admin/users/{id}/activate", 9999L)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("PATCH /auth/admin/users/{id}/deactivate")
    class Deactivate {

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("should deactivate an active user when admin")
        void shouldDeactivateUser() throws Exception {
            User user = createAndSaveUser(200L, "to-deactivate@example.com", Role.WORKER, true);

            mockMvc.perform(patch("/auth/admin/users/{id}/deactivate", user.getId())
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("deactivated")));

            User updated = userRepository.findById(user.getId()).orElseThrow();
            assertThat(updated.isActive()).isFalse();
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("should indicate if already deactivated")
        void shouldIndicateAlreadyDeactivated() throws Exception {
            User user = createAndSaveUser(201L, "already-off@example.com", Role.WORKER, false);

            mockMvc.perform(patch("/auth/admin/users/{id}/deactivate", user.getId())
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("already deactivated")));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("should return 404 for non-existent user")
        void shouldReturn404ForUnknownUser() throws Exception {
            mockMvc.perform(patch("/auth/admin/users/{id}/deactivate", 9999L)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("Authorization")
    class Authorization {

        @Test
        @WithMockUser(roles = "WORKER")
        @DisplayName("should return 403 for WORKER role")
        void shouldReturn403ForWorker() throws Exception {
            mockMvc.perform(patch("/auth/admin/users/{id}/activate", 1L)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @WithMockUser(roles = "EMPLOYER")
        @DisplayName("should return 403 for EMPLOYER role")
        void shouldReturn403ForEmployer() throws Exception {
            mockMvc.perform(patch("/auth/admin/users/{id}/deactivate", 1L)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("should return 200 for ADMIN role on activate")
        void shouldReturn200ForAdminOnActivate() throws Exception {
            User user = createAndSaveUser(300L, "admin-test@example.com", Role.WORKER, false);

            mockMvc.perform(patch("/auth/admin/users/{id}/activate", user.getId())
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("should return 403 when not authenticated (anonymous user)")
        void shouldReturn403WhenUnauthenticated() throws Exception {
            // Unauthenticated requests are treated as anonymous by Spring Security,
            // and @PreAuthorize denies anonymous users with 403 Forbidden.
            mockMvc.perform(patch("/auth/admin/users/{id}/activate", 1L)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isForbidden());
        }
    }
}
