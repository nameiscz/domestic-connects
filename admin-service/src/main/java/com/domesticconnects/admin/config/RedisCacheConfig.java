package com.domesticconnects.admin.config;

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
 * Redis-backed Spring Cache configuration for admin-service.
 * <p>
 * Caches the expensive {@code GET /admin/dashboard/summary} aggregation (it
 * fans out to auth/job/attendance/performance services). The summary is served
 * from Redis for 5 minutes ({@link #DASHBOARD_SUMMARY_TTL}), so the fan-out
 * runs at most once per 5 minutes regardless of dashboard traffic.
 * <p>
 * Entries are written as JSON with embedded type information (default typing)
 * so {@code DashboardSummary} — including its {@code LocalDateTime} and
 * nullable {@code Double} fields — round-trips correctly (the DTO carries a
 * no-args constructor for Jackson). {@code LocalDateTime} values are stored as
 * ISO-8601 strings via the Jackson {@code JavaTimeModule}.
 * <p>
 * A Redis outage never fails a request: the {@link CacheErrorHandler} logs and
 * swallows cache errors, so reads fall through to the downstream aggregation —
 * consistent with the service's graceful-degradation design.
 */
@Configuration
@EnableCaching
public class RedisCacheConfig {

    private static final Logger log = LoggerFactory.getLogger(RedisCacheConfig.class);

    /** Cache of the aggregated dashboard summary ({@code GET /admin/dashboard/summary}). */
    public static final String CACHE_DASHBOARD_SUMMARY = "dashboardSummary";

    /** TTL of the cached dashboard summary — the downstream fan-out runs at most this often. */
    public static final Duration DASHBOARD_SUMMARY_TTL = Duration.ofMinutes(5);

    @Bean
    public RedisCacheConfiguration redisCacheConfiguration() {
        return RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(DASHBOARD_SUMMARY_TTL)
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(redisValueSerializer()));
    }

    /**
     * JSON serializer shared by all caches in this service.
     * <p>
     * Default typing uses {@link JsonTypeInfo.As#WRAPPER_ARRAY} so every value is
     * written as {@code ["<className>", <payload>]} and can be reconstructed with
     * its concrete type when read back as {@code Object}. ISO-8601
     * {@code LocalDateTime} values (via {@code JavaTimeModule}) and field
     * visibility for the Lombok DTO are layered on top.
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
                        log.warn("Redis GET failed for cache '{}' key '{}'; serving from downstream", cache.getName(), key, exception);
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
