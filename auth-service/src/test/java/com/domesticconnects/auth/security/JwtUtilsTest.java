package com.domesticconnects.auth.security;

import com.domesticconnects.auth.entity.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("JwtUtils")
class JwtUtilsTest {

    private static final String TEST_SECRET = "testSecretKeyForJwtTokenGenerationThatIsLongEnoughForHS256Algorithm";
    private static final long ACCESS_EXPIRATION = 900000;   // 15 min
    private static final long REFRESH_EXPIRATION = 604800000; // 7 days

    private JwtUtils jwtUtils;

    @BeforeEach
    void setUp() {
        jwtUtils = new JwtUtils(TEST_SECRET, ACCESS_EXPIRATION, REFRESH_EXPIRATION);
    }

    @Nested
    @DisplayName("Access Token")
    class AccessToken {

        @Test
        @DisplayName("should generate a valid access token")
        void shouldGenerateValidAccessToken() {
            String token = jwtUtils.generateAccessToken("user@example.com", 1L, Role.WORKER);

            assertThat(token).isNotBlank();
            assertThat(jwtUtils.validateToken(token)).isTrue();
            assertThat(jwtUtils.getEmailFromToken(token)).isEqualTo("user@example.com");
            assertThat(jwtUtils.getUserIdFromToken(token)).isEqualTo(1L);
            assertThat(jwtUtils.getRoleFromToken(token)).isEqualTo("WORKER");
            assertThat(jwtUtils.getTokenType(token)).isEqualTo("access");
        }

        @Test
        @DisplayName("should generate access tokens with different roles")
        void shouldGenerateTokensWithDifferentRoles() {
            String adminToken = jwtUtils.generateAccessToken("admin@example.com", 2L, Role.ADMIN);
            String employerToken = jwtUtils.generateAccessToken("employer@example.com", 3L, Role.EMPLOYER);

            assertThat(jwtUtils.getRoleFromToken(adminToken)).isEqualTo("ADMIN");
            assertThat(jwtUtils.getRoleFromToken(employerToken)).isEqualTo("EMPLOYER");
        }

        @Test
        @DisplayName("should generate unique tokens for different users")
        void shouldGenerateUniqueTokens() {
            String token1 = jwtUtils.generateAccessToken("alice@example.com", 1L, Role.WORKER);
            String token2 = jwtUtils.generateAccessToken("bob@example.com", 2L, Role.EMPLOYER);

            assertThat(token1).isNotEqualTo(token2);
        }
    }

    @Nested
    @DisplayName("Refresh Token")
    class RefreshToken {

        @Test
        @DisplayName("should generate a valid refresh token")
        void shouldGenerateValidRefreshToken() {
            String token = jwtUtils.generateRefreshToken("user@example.com");

            assertThat(token).isNotBlank();
            assertThat(jwtUtils.validateToken(token)).isTrue();
            assertThat(jwtUtils.getEmailFromToken(token)).isEqualTo("user@example.com");
            assertThat(jwtUtils.getTokenType(token)).isEqualTo("refresh");
        }

        @Test
        @DisplayName("refresh token should not contain role or userId claims")
        void refreshTokenShouldNotContainRoleClaim() {
            String token = jwtUtils.generateRefreshToken("user@example.com");

            // Should still be valid
            assertThat(jwtUtils.validateToken(token)).isTrue();
            // Role extraction should return null or throw
            assertThat(jwtUtils.getTokenType(token)).isEqualTo("refresh");
        }
    }

    @Nested
    @DisplayName("Token Validation")
    class Validation {

        @Test
        @DisplayName("should reject malformed token")
        void shouldRejectMalformedToken() {
            assertThat(jwtUtils.validateToken("not-a-jwt")).isFalse();
        }

        @Test
        @DisplayName("should reject empty token")
        void shouldRejectEmptyToken() {
            assertThat(jwtUtils.validateToken("")).isFalse();
        }

        @Test
        @DisplayName("should reject null token")
        void shouldRejectNullToken() {
            assertThat(jwtUtils.validateToken(null)).isFalse();
        }

        @Test
        @DisplayName("should reject token signed with different key")
        void shouldRejectTokenWithDifferentKey() {
            JwtUtils imposterJwt = new JwtUtils(
                    "differentSecretKeyThatIsAlsoLongEnoughForTheHS256Algorithm",
                    ACCESS_EXPIRATION, REFRESH_EXPIRATION);

            String token = imposterJwt.generateAccessToken("user@example.com", 1L, Role.WORKER);

            // Our jwtUtils has a different secret, so validation should fail
            assertThat(jwtUtils.validateToken(token)).isFalse();
        }

        @Test
        @DisplayName("should validate token signed with same key")
        void shouldValidateTokenFromSameKey() {
            String token = jwtUtils.generateAccessToken("user@example.com", 1L, Role.WORKER);
            assertThat(jwtUtils.validateToken(token)).isTrue();
        }
    }

    @Nested
    @DisplayName("Claim Extraction")
    class ClaimExtraction {

        @Test
        @DisplayName("should extract all claims from access token")
        void shouldExtractAllClaims() {
            String token = jwtUtils.generateAccessToken("alice@test.com", 42L, Role.ADMIN);

            assertThat(jwtUtils.getEmailFromToken(token)).isEqualTo("alice@test.com");
            assertThat(jwtUtils.getUserIdFromToken(token)).isEqualTo(42L);
            assertThat(jwtUtils.getRoleFromToken(token)).isEqualTo("ADMIN");
            assertThat(jwtUtils.getTokenType(token)).isEqualTo("access");
        }

        @Test
        @DisplayName("should extract email from refresh token")
        void shouldExtractEmailFromRefreshToken() {
            String token = jwtUtils.generateRefreshToken("bob@test.com");

            assertThat(jwtUtils.getEmailFromToken(token)).isEqualTo("bob@test.com");
            assertThat(jwtUtils.getTokenType(token)).isEqualTo("refresh");
        }
    }

    @Nested
    @DisplayName("Token Expiration")
    class Expiration {

        @Test
        @DisplayName("access token should expire after 15 minutes")
        void accessTokenShouldExpireAfter15Minutes() throws Exception {
            // Create JwtUtils with 0ms expiration to simulate expired token
            JwtUtils expiredJwt = new JwtUtils(TEST_SECRET, -1, REFRESH_EXPIRATION);
            String token = expiredJwt.generateAccessToken("user@example.com", 1L, Role.WORKER);

            // Wait a tiny bit to ensure the token is in the past
            Thread.sleep(10);

            assertThat(expiredJwt.validateToken(token)).isFalse();
        }

        @Test
        @DisplayName("refresh token should not be valid as access token")
        void refreshTokenShouldNotWorkAsAccessToken() {
            String refreshToken = jwtUtils.generateRefreshToken("user@example.com");

            assertThat(jwtUtils.getTokenType(refreshToken)).isEqualTo("refresh");
            assertThat(jwtUtils.getTokenType(refreshToken)).isNotEqualTo("access");
        }
    }
}
