package com.domesticconnects.job.config;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

/**
 * Redis-backed Spring Cache configuration for job-service.
 * <p>
 * Caches {@code GET /jobs} and {@code GET /jobs/{id}} responses:
 * <ul>
 *   <li>{@link #CACHE_JOB_POSTS} — the full active job-post list.</li>
 *   <li>{@link #CACHE_JOB_POST} — a single job post, keyed by its id.</li>
 * </ul>
 * Entries are written as JSON with embedded type information (default typing)
 * so {@code JobPostResponse} — including its {@code BigDecimal}, enum and
 * {@code LocalDateTime} fields — round-trips correctly without a shared
 * serializer contract (the DTO carries a no-args constructor for Jackson).
 * {@code LocalDateTime} values are stored as ISO-8601 strings via the Jackson
 * {@code JavaTimeModule}.
 * <p>
 * Cache names referenced in {@code @Cacheable}/{@code @CacheEvict} should use
 * the constants below instead of string literals.
 * <p>
 * A Redis outage never fails a request: the {@link CacheErrorHandler} logs and
 * swallows cache errors, so reads fall through to the database.
 */
@Configuration
@EnableCaching
public class RedisCacheConfig {

    private static final Logger log = LoggerFactory.getLogger(RedisCacheConfig.class);

    /** Cache of the full active job-post list ({@code GET /jobs}). */
    public static final String CACHE_JOB_POSTS = "jobPosts";

    /** Cache of a single job post, keyed by job-post id ({@code GET /jobs/{id}}). */
    public static final String CACHE_JOB_POST = "jobPost";

    /** How long cached job data stays fresh before the next read hits the DB. */
    private static final Duration DEFAULT_TTL = Duration.ofMinutes(10);

    @Bean
    public RedisCacheConfiguration redisCacheConfiguration() {
        return RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(DEFAULT_TTL)
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(redisValueSerializer()));
    }

    /**
     * JSON serializer shared by all caches in this service.
     * <p>
     * Default typing uses {@link JsonTypeInfo.As#WRAPPER_ARRAY} so every value —
     * including collection roots such as {@code List<JobPostResponse>} — is
     * written as {@code ["<className>", <payload>]} and can be reconstructed
     * with its concrete type when read back as {@code Object}. {@code As.PROPERTY}
     * cannot express a type id on a JSON array root, which breaks cached lists.
     * ISO-8601 {@code LocalDateTime} values (via {@code JavaTimeModule}) and
     * field visibility for the Lombok DTOs are layered on top.
     */
    @Bean
    public GenericJackson2JsonRedisSerializer redisValueSerializer() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);
        mapper.activateDefaultTyping(LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL, JsonTypeInfo.As.WRAPPER_ARRAY);
        return new GenericJackson2JsonRedisSerializer(mapper);
    }

    /**
     * Only {@link CachingConfigurer#errorHandler()} is overridden — the
     * CacheManager / resolver / key generator stay {@code null} so Spring
     * falls back to the auto-configured {@code RedisCacheManager}.
     */
    @Bean
    public CachingConfigurer cachingConfigurer() {
        return new CachingConfigurer() {
            @Override
            public CacheErrorHandler errorHandler() {
                return new CacheErrorHandler() {
                    @Override
                    public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                        log.warn("Redis GET failed for cache '{}' key '{}'; serving from DB", cache.getName(), key, exception);
                    }

                    @Override
                    public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                        log.warn("Redis PUT failed for cache '{}' key '{}'", cache.getName(), key, exception);
                    }

                    @Override
                    public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                        log.warn("Redis EVICT failed for cache '{}' key '{}'", cache.getName(), key, exception);
                    }

                    @Override
                    public void handleCacheClearError(RuntimeException exception, Cache cache) {
                        log.warn("Redis CLEAR failed for cache '{}'", cache.getName(), exception);
                    }
                };
            }
        };
    }
}
