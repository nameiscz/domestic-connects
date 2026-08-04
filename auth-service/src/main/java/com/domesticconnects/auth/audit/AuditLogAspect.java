package com.domesticconnects.auth.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.aop.support.AopUtils;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;

/**
 * Intercepts every method annotated with {@link Auditable} and writes one
 * {@link AuditLog} row: actor (JWT claims forwarded by the API gateway as
 * {@code X-User-Id} / {@code X-User-Role}), action, entity type, entity id,
 * timestamp, and truncated JSON summaries of the old/new value.
 * <p>
 * Spring Boot auto-enables AspectJ AOP whenever {@code spring-boot-starter-aop}
 * is on the classpath, so no {@code @EnableAspectJAutoProxy} is needed. The
 * advice deliberately never throws: a broken audit pipeline must not break the
 * business operation, so all failures are logged and swallowed.
 *
 * <h3>Entity id resolution</h3>
 * <ol>
 *   <li>{@code idParam} of the annotation, when set (param serialised as text).</li>
 *   <li>Otherwise, {@code getId()} reflected off the method's return value
 *       (covers CREATE methods whose id is generated server-side).</li>
 * </ol>
 *
 * <h3>Old/new value resolution</h3>
 * <ul>
 *   <li>{@code oldValue} — the parameter at {@code oldValueParam}, when set.</li>
 *   <li>{@code newValue} — the parameter at {@code newValueParam}, when set;
 *       otherwise the method's return value (when non-void).</li>
 * </ul>
 * Summaries are Jackson JSON capped at {@link #MAX_SUMMARY_LENGTH} characters.
 * <p>
 * The aspect is ordered with {@code HIGHEST_PRECEDENCE} so it wraps the
 * {@code @Transactional} interceptor (default {@code LOWEST_PRECEDENCE}): on
 * success the audit row is written <b>after</b> the business transaction
 * commits, and on failure the row is written independently (via
 * {@link AuditLogService#save} with {@code REQUIRES_NEW}) so a rolled-back
 * attempt is still recorded. Because the failure path has no return value,
 * deriving the entity id from the return value only works on success — pass
 * {@code idParam} explicitly to capture the id of failed attempts too.
 */
@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class AuditLogAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditLogAspect.class);

    /** Hard cap for serialised value summaries — keeps audit rows lean. */
    private static final int MAX_SUMMARY_LENGTH = 2000;

    /** Actor fallback when no request context / identity headers are present. */
    private static final String UNKNOWN_ACTOR = "anonymous";

    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    /**
     * Wraps the annotated method, records the outcome (success or failure),
     * and persists the audit row after the method returns.
     */
    @Around("@annotation(com.domesticconnects.auth.audit.Auditable)")
    public Object audit(ProceedingJoinPoint joinPoint) throws Throwable {
        Auditable auditable = resolveAnnotation(joinPoint);
        if (auditable == null) {
            // Should never happen — the pointcut only matches @Auditable methods.
            return joinPoint.proceed();
        }
        Object result;
        try {
            result = joinPoint.proceed();
            writeAuditLog(joinPoint, auditable, result, true, null);
            return result;
        } catch (Throwable t) {
            // Failed attempts are still audited, then the original error rethrown.
            writeAuditLog(joinPoint, auditable, null, false, t);
            throw t;
        }
    }

    /**
     * Reads the {@link Auditable} annotation from the intercepted method.
     * The pointcut deliberately matches by annotation <em>type</em> only and
     * resolves the annotation reflectively here, rather than relying on
     * AspectJ parameter-name binding ({@code @annotation(auditable)} with an
     * advice argument) — that binding silently fails under some AspectJ/JDK
     * combinations, whereas type matching + reflection always works.
     */
    private Auditable resolveAnnotation(ProceedingJoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Auditable auditable = AnnotatedElementUtils.findMergedAnnotation(method, Auditable.class);
        if (auditable == null) {
            // CGLIB proxies may hand back an interface/superclass method;
            // resolve the most specific one on the target class.
            method = AopUtils.getMostSpecificMethod(method, joinPoint.getTarget().getClass());
            auditable = AnnotatedElementUtils.findMergedAnnotation(method, Auditable.class);
        }
        return auditable;
    }

    private void writeAuditLog(ProceedingJoinPoint joinPoint, Auditable auditable,
                               Object result, boolean success, Throwable failure) {
        try {
            Actor actor = resolveActor();

            AuditLog auditLog = AuditLog.builder()
                    .actorId(actor.id())
                    .actorRole(actor.role())
                    .action(auditable.action())
                    .entityType(auditable.entity())
                    .entityId(resolveEntityId(joinPoint, auditable, result))
                    .oldValue(summarize(resolveParam(joinPoint, auditable.oldValueParam())))
                    .newValue(summarize(resolveNewValue(joinPoint, auditable, result)))
                    .detail(buildDetail(auditable.detail(), failure))
                    .success(success)
                    .build();

            auditLogService.save(auditLog);
        } catch (Exception e) {
            // Audit must never break the business operation.
            log.warn("Failed to write audit log for {}.{}: {}",
                    joinPoint.getSignature().getDeclaringTypeName(),
                    joinPoint.getSignature().getName(), e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // Value resolution
    // ------------------------------------------------------------------

    /**
     * Resolves the entity id: the {@code idParam} argument if set, else
     * {@code getId()} reflected off the return value.
     */
    private String resolveEntityId(ProceedingJoinPoint joinPoint, Auditable auditable,
                                   Object result) {
        Object idArg = resolveParam(joinPoint, auditable.idParam());
        if (idArg != null) {
            return String.valueOf(idArg);
        }
        if (result != null) {
            try {
                Method getId = result.getClass().getMethod("getId");
                Object id = getId.invoke(result);
                if (id != null) {
                    return String.valueOf(id);
                }
            } catch (ReflectiveOperationException e) {
                // Return value has no getId() — entity id stays null.
            }
        }
        return null;
    }

    /**
     * Post-change state: {@code newValueParam} argument if set, else the
     * method's return value when non-void.
     */
    private Object resolveNewValue(ProceedingJoinPoint joinPoint, Auditable auditable,
                                   Object result) {
        if (auditable.newValueParam() >= 0) {
            // Explicitly configured parameter wins — even when its value is
            // null, no silent fallback to the return value.
            return resolveParam(joinPoint, auditable.newValueParam());
        }
        return result;
    }

    private Object resolveParam(ProceedingJoinPoint joinPoint, int index) {
        Object[] args = joinPoint.getArgs();
        if (index >= 0 && index < args.length) {
            return args[index];
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Actor resolution — JWT claims forwarded by the API gateway
    // ------------------------------------------------------------------

    /**
     * Reads the caller's identity from the current HTTP request. The gateway's
     * {@code JwtAuthGlobalFilter} validates the JWT and injects the trusted
     * {@code X-User-Id} / {@code X-User-Role} headers derived from its claims
     * (stripping any client-supplied copies first). Falls back to
     * {@code "anonymous"} when there is no request context (e.g. scheduled
     * tasks) or no identity header.
     */
    private Actor resolveActor() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes servletRequestAttributes) {
            HttpServletRequest request = servletRequestAttributes.getRequest();
            String id = request.getHeader("X-User-Id");
            String role = request.getHeader("X-User-Role");
            return new Actor(
                    id == null || id.isBlank() ? UNKNOWN_ACTOR : id.trim(),
                    role == null ? "" : role.trim());
        }
        return new Actor(UNKNOWN_ACTOR, "");
    }

    private record Actor(String id, String role) {
    }

    // ------------------------------------------------------------------
    // Summaries
    // ------------------------------------------------------------------

    /**
     * Serialises a value to a compact JSON summary, truncated to
     * {@link #MAX_SUMMARY_LENGTH} characters. Null-safe and failure-safe.
     */
    private String summarize(Object value) {
        if (value == null) {
            return null;
        }
        try {
            String json = objectMapper.writeValueAsString(value);
            return truncate(json, MAX_SUMMARY_LENGTH);
        } catch (JsonProcessingException e) {
            // Not serialisable (e.g. a stream) — fall back to toString().
            return truncate(String.valueOf(value), MAX_SUMMARY_LENGTH);
        }
    }

    /**
     * Builds the detail column: the annotation's free-text description plus,
     * for failed operations, a summary of the thrown exception.
     */
    private String buildDetail(String detail, Throwable failure) {
        String result = detail;
        if (failure != null) {
            String reason = failure.getClass().getSimpleName()
                    + (failure.getMessage() != null ? ": " + failure.getMessage() : "");
            result = (result == null || result.isBlank())
                    ? "FAILED: " + reason
                    : result + " | FAILED: " + reason;
        }
        return (result == null || result.isBlank()) ? null : truncate(result, 500);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength
                ? value
                : value.substring(0, maxLength) + "...[truncated]";
    }
}
