package com.domesticconnects.performance.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a service method for audit logging. Methods carrying this annotation
 * are intercepted by {@link AuditLogAspect}, which writes one {@link AuditLog}
 * row per invocation with the actor (from the gateway-forwarded
 * {@code X-User-Id} / {@code X-User-Role} headers), action, entity type,
 * entity id, timestamp, and old/new value summaries.
 * <p>
 * Usage:
 * <pre>{@code
 * @Auditable(action = "DELETE", entity = "PerformanceReview", idParam = 0)
 * public void deleteReview(Long id) { ... }
 * }</pre>
 *
 * <h3>Parameter semantics</h3>
 * <ul>
 *   <li>{@code idParam} — zero-based index of the method parameter holding the
 *       entity id. Default {@code -1} means "derive the id from the return
 *       value's {@code getId()}" (handy for {@code CREATE} methods).</li>
 *   <li>{@code oldValueParam} — zero-based index of the parameter carrying the
 *       pre-change state (entity/DTO) that should be summarised. Default
 *       {@code -1} = none.</li>
 *   <li>{@code newValueParam} — zero-based index of the parameter carrying the
 *       post-change state. Default {@code -1} = fall back to the method's
 *       return value (ignored when the method returns {@code void}).</li>
 * </ul>
 *
 * <p>The aspect never throws: audit failures are logged and swallowed so they
 * can never break the business operation. Self-invocations within the same
 * bean are <b>not</b> intercepted (classic Spring AOP proxy limitation) — only
 * calls that enter the proxied bean, e.g. from a controller.</p>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {

    /**
     * Business action, e.g. {@code "CREATE"}, {@code "UPDATE"},
     * {@code "DELETE"}, {@code "ASSIGN"}. Stored verbatim.
     */
    String action();

    /**
     * Entity type, e.g. {@code "PerformanceReview"}. Stored verbatim.
     */
    String entity();

    /**
     * Zero-based index of the method parameter holding the entity id, or
     * {@code -1} to derive it from the return value's {@code getId()}.
     */
    int idParam() default -1;

    /**
     * Zero-based index of the parameter holding the pre-change state to
     * summarise into {@code oldValue}, or {@code -1} for none.
     */
    int oldValueParam() default -1;

    /**
     * Zero-based index of the parameter holding the post-change state to
     * summarise into {@code newValue}, or {@code -1} to fall back to the
     * method's return value.
     */
    int newValueParam() default -1;

    /**
     * Optional free-text description stored in the {@code detail} column.
     */
    String detail() default "";
}
