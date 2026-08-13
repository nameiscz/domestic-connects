package com.domesticconnects.performance.config;

import com.domesticconnects.performance.dto.NotificationEvent;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Shared test configuration for full-context tests.
 * <p>
 * The test {@code application.yml} excludes {@code KafkaAutoConfiguration} so no
 * real Kafka producer machinery is created (no broker runs in the test
 * environment). This config supplies a no-op mock {@link KafkaTemplate} in its
 * place so the real {@code NotificationPublisher} can still be wired up; the
 * mock's {@code send} returns an already-completed future, so the best-effort
 * publish path completes instantly instead of blocking on metadata lookup.
 */
@TestConfiguration(proxyBeanMethods = false)
public class KafkaTestConfig {

    @Bean
    @SuppressWarnings({"rawtypes", "unchecked"})
    public KafkaTemplate<String, NotificationEvent> kafkaTemplate() {
        KafkaTemplate<String, NotificationEvent> template = mock(KafkaTemplate.class);
        when(template.send(anyString(), anyString(), any(NotificationEvent.class)))
                .thenReturn(CompletableFuture.completedFuture(null));
        return template;
    }
}
