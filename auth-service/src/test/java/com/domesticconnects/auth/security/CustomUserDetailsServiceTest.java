package com.domesticconnects.auth.security;

import com.domesticconnects.auth.entity.Role;
import com.domesticconnects.auth.entity.User;
import com.domesticconnects.auth.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("CustomUserDetailsService")
class CustomUserDetailsServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private CustomUserDetailsService userDetailsService;

    @Nested
    @DisplayName("loadUserByUsername")
    class LoadUserByUsername {

        @Test
        @DisplayName("should load active verified user successfully")
        void shouldLoadActiveVerifiedUser() {
            User user = User.builder()
                    .id(1L)
                    .name("Alice")
                    .email("alice@example.com")
                    .password("encoded-password")
                    .role(Role.WORKER)
                    .isActive(true)
                    .isVerified(true)
                    .build();

            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

            UserDetails userDetails = userDetailsService.loadUserByUsername("alice@example.com");

            assertThat(userDetails).isNotNull();
            assertThat(userDetails.getUsername()).isEqualTo("alice@example.com");
            assertThat(userDetails.getPassword()).isEqualTo("encoded-password");
            assertThat(userDetails.isEnabled()).isTrue();
            assertThat(userDetails.isAccountNonLocked()).isTrue();
            assertThat(userDetails.isAccountNonExpired()).isTrue();
            assertThat(userDetails.isCredentialsNonExpired()).isTrue();
            assertThat(userDetails.getAuthorities())
                    .hasSize(1)
                    .anyMatch(a -> a.getAuthority().equals("ROLE_WORKER"));
        }

        @Test
        @DisplayName("should load inactive user as disabled")
        void shouldLoadInactiveUserAsDisabled() {
            User user = User.builder()
                    .id(2L)
                    .name("Bob")
                    .email("bob@example.com")
                    .password("encoded-password")
                    .role(Role.EMPLOYER)
                    .isActive(false)
                    .isVerified(true)
                    .build();

            when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(user));

            UserDetails userDetails = userDetailsService.loadUserByUsername("bob@example.com");

            assertThat(userDetails.isEnabled()).isFalse();
        }

        @Test
        @DisplayName("should always set accountNonLocked to true")
        void shouldAlwaysSetAccountNonLockedToTrue() {
            User unverifiedUser = User.builder()
                    .id(3L)
                    .name("Charlie")
                    .email("charlie@example.com")
                    .password("encoded-password")
                    .role(Role.WORKER)
                    .isActive(true)
                    .isVerified(false)
                    .build();

            when(userRepository.findByEmail("charlie@example.com")).thenReturn(Optional.of(unverifiedUser));

            UserDetails userDetails = userDetailsService.loadUserByUsername("charlie@example.com");

            // accountNonLocked should be true even for unverified users
            // (verification is checked separately in service layer)
            assertThat(userDetails.isAccountNonLocked()).isTrue();
        }

        @Test
        @DisplayName("should assign correct ROLE_ADMIN authority")
        void shouldAssignAdminRole() {
            User admin = User.builder()
                    .id(4L)
                    .name("Admin")
                    .email("admin@example.com")
                    .password("encoded-password")
                    .role(Role.ADMIN)
                    .isActive(true)
                    .isVerified(true)
                    .build();

            when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(admin));

            UserDetails userDetails = userDetailsService.loadUserByUsername("admin@example.com");

            assertThat(userDetails.getAuthorities())
                    .hasSize(1)
                    .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        }

        @Test
        @DisplayName("should throw UsernameNotFoundException for unknown email")
        void shouldThrowForUnknownEmail() {
            when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userDetailsService.loadUserByUsername("unknown@example.com"))
                    .isInstanceOf(UsernameNotFoundException.class)
                    .hasMessageContaining("unknown@example.com");
        }
    }
}
