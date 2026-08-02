package com.domesticconnects.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

/**
 * Global pre-filter that intercepts every request entering the Gateway,
 * extracts the JWT from the {@code Authorization} header, and validates it.
 * <p>
 * The JWT is parsed and its signature verified using the shared
 * {@code jwt.secret} (sourced from config-server, same value as auth-service).
 * On success the caller's user id and role are forwarded downstream as
 * {@code X-User-Id} and {@code X-User-Role} / {@code X-User-Roles} headers so
 * backend services can enforce authorisation without re-parsing the token.
 * <p>
 * Public endpoints (login, register, refresh, verify, health) are whitelisted
 * and skip validation entirely.
 */
@Component
public class JwtAuthGlobalFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthGlobalFilter.class);

    @Autowired
    private Environment environment;

    /**
     * Request paths that do <b>not</b> require a valid JWT.
     */
    private static final String[] WHITELIST = {
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh",
            "/api/auth/verify",
            "/actuator/health"
    };

    private static final String BEARER_PREFIX = "Bearer ";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // ---- 1. Skip authentication for whitelisted endpoints ----
        if (isWhitelisted(path)) {
            log.debug("Skipping JWT check for whitelisted path: {}", path);
            return chain.filter(exchange);
        }

        // ---- 2. Extract Authorization header ----
        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            log.warn("Missing or invalid Authorization header for path: {}", path);
            return respondUnauthorized(exchange, "Missing or invalid Authorization header");
        }

        String token = authHeader.substring(BEARER_PREFIX.length()).trim();
        if (token.isEmpty()) {
            log.warn("Empty JWT token for path: {}", path);
            return respondUnauthorized(exchange, "Empty JWT token");
        }

        // ---- 3. Validate the token (signature + expiry + type) ----
        Claims claims = parseClaims(token);
        if (claims == null) {
            log.warn("JWT validation failed for path: {}", path);
            return respondUnauthorized(exchange, "Invalid or expired JWT token");
        }

        // Only access tokens may call protected endpoints; refresh tokens
        // must be exchanged at /api/auth/refresh first.
        if (!"access".equals(claims.get("type"))) {
            log.warn("JWT rejected for path {}: token type is not 'access'", path);
            return respondUnauthorized(exchange, "Invalid token type");
        }

        // ---- 4. Pass validated identity downstream ----
        ServerHttpRequest mutatedRequest = request.mutate()
                .header("X-User-Id", extractUserId(claims))
                .header("X-User-Role", extractRole(claims))
                .header("X-User-Roles", extractRole(claims))
                .build();

        log.debug("JWT validated successfully for path: {}", path);
        return chain.filter(exchange.mutate().request(mutatedRequest).build());
    }

    @Override
    public int getOrder() {
        // Highest priority so this filter runs before any route-specific filters
        return -100;
    }

    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------

    /**
     * Checks whether the given request path is in the whitelist.
     */
    private boolean isWhitelisted(String path) {
        for (String prefix : WHITELIST) {
            if (path.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Parses and verifies the JWT token. Returns the claims on success, or
     * {@code null} when the token is malformed, expired, or not signed with
     * the shared secret.
     */
    private Claims parseClaims(String token) {
        String secret = environment.getProperty("jwt.secret");
        if (secret == null || secret.isEmpty()) {
            log.error("jwt.secret is not configured in the gateway");
            return null;
        }

        try {
            SecretKey signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
            return Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("JWT validation failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extracts the user id from the JWT claims.
     *
     * @param claims parsed JWT claims
     * @return the numeric user id, or the subject (email) as a fallback
     */
    private String extractUserId(Claims claims) {
        Object userId = claims.get("userId");
        if (userId != null) {
            return String.valueOf(userId);
        }
        String subject = claims.getSubject();
        return subject != null ? subject : "unknown";
    }

    /**
     * Extracts the role from the JWT claims.
     *
     * @param claims parsed JWT claims
     * @return the role (e.g. {@code EMPLOYER}), or an empty string if absent
     */
    private String extractRole(Claims claims) {
        Object role = claims.get("role");
        return role != null ? String.valueOf(role) : "";
    }

    /**
     * Sends a 401 Unauthorized response with a JSON body.
     */
    private Mono<Void> respondUnauthorized(ServerWebExchange exchange, String message) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().set(HttpHeaders.CONTENT_TYPE, "application/json");
        byte[] body = String.format("{\"error\":\"Unauthorized\",\"message\":\"%s\"}", message)
                .getBytes(StandardCharsets.UTF_8);
        return exchange.getResponse()
                .writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(body)));
    }
}
