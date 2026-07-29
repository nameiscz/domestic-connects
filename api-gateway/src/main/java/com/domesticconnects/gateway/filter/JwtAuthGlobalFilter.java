package com.domesticconnects.gateway.filter;

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

/**
 * Global pre-filter that intercepts every request entering the Gateway,
 * extracts the JWT from the {@code Authorization} header, and validates it.
 * <p>
 * <b>Stub implementation:</b> Currently logs the token presence and
 * passes it through.  Replace the body of {@link #validateToken(String)}
 * with real JWT parsing/verification (e.g. using the {@code jjwt} library
 * and the secret from {@code jwt.secret}).
 * <p>
 * Public endpoints (e.g. login, register) should be whitelisted so the
 * filter does not reject them.  Whitelist paths are checked before any
 * validation takes place.
 */
@Component
public class JwtAuthGlobalFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthGlobalFilter.class);

    @Autowired
    private Environment environment;

    /**
     * Request paths that do <b>not</b> require a valid JWT.
     * Add to this list as needed.
     */
    private static final String[] WHITELIST = {
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh",
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

        // ---- 3. Validate token (STUB — replace with real validation) ----
        if (!validateToken(token)) {
            log.warn("JWT validation failed for path: {}", path);
            return respondUnauthorized(exchange, "Invalid or expired JWT token");
        }

        // ---- 4. Pass validated token downstream (e.g. as a header) ----
        ServerHttpRequest mutatedRequest = request.mutate()
                .header("X-User-Id", extractUserId(token))
                .header("X-User-Roles", extractRoles(token))
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
     * Validates the JWT token.
     * <p>
     * <b>Stub:</b> Always returns {@code true}. Replace with real
     * signature verification (e.g., JJWT or Nimbus JOSE + JWT).
     *
     * @param token the raw JWT string
     * @return {@code true} if the token is valid
     */
    private boolean validateToken(String token) {
        // TODO: Implement real JWT validation using jwt.secret from config
        // Example (with jjwt library on classpath):
        //
        //   String secret = environment.getProperty("jwt.secret");
        //   if (secret == null || secret.isEmpty()) {
        //       log.error("jwt.secret is not configured");
        //       return false;
        //   }
        //   try {
        //       Claims claims = Jwts.parserBuilder()
        //               .setSigningKey(Keys.hmacShaKeyFor(secret.getBytes()))
        //               .build()
        //               .parseClaimsJws(token)
        //               .getBody();
        //       return true;
        //   } catch (JwtException e) {
        //       log.warn("JWT validation failed: {}", e.getMessage());
        //       return false;
        //   }

        log.debug("JWT stub validation — always passes. " +
                "jwt.secret present={}", environment.containsProperty("jwt.secret"));
        return true;
    }

    /**
     * Extracts a user identifier from the JWT (stub).
     *
     * @param token the raw JWT string
     * @return placeholder user ID
     */
    private String extractUserId(String token) {
        // TODO: Parse claims and extract "sub" or custom "user_id" claim
        // Example:
        //   String secret = environment.getProperty("jwt.secret");
        //   Claims claims = Jwts.parserBuilder()
        //           .setSigningKey(Keys.hmacShaKeyFor(secret.getBytes()))
        //           .build()
        //           .parseClaimsJws(token)
        //           .getBody();
        //   return claims.getSubject();
        return "unknown";
    }

    /**
     * Extracts roles from the JWT (stub).
     *
     * @param token the raw JWT string
     * @return placeholder roles string
     */
    private String extractRoles(String token) {
        // TODO: Parse claims and extract "roles" claim
        // Example:
        //   String secret = environment.getProperty("jwt.secret");
        //   Claims claims = Jwts.parserBuilder()
        //           .setSigningKey(Keys.hmacShaKeyFor(secret.getBytes()))
        //           .build()
        //           .parseClaimsJws(token)
        //           .getBody();
        //   return claims.get("roles", String.class);
        return "ROLE_USER";
    }

    /**
     * Sends a 401 Unauthorized response with a JSON body.
     */
    private Mono<Void> respondUnauthorized(ServerWebExchange exchange, String message) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().set(HttpHeaders.CONTENT_TYPE, "application/json");
        byte[] body = String.format("{\"error\":\"Unauthorized\",\"message\":\"%s\"}", message).getBytes();
        return exchange.getResponse()
                .writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(body)));
    }
}
