package com.domesticconnects.job.audit;

import com.domesticconnects.job.dto.JobPostRequest;
import com.domesticconnects.job.dto.JobPostResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link AuditLogAspect}. The advice is exercised directly with
 * mocked {@link ProceedingJoinPoint}s (whose {@link MethodSignature} exposes the
 * real {@link Auditable}-annotated methods of {@link AnnotatedMethods}), so no
 * Spring context is needed.
 */
class AuditLogAspectTest {

    private static final ObjectMapper OBJECT_MAPPER =
            new ObjectMapper().registerModule(new JavaTimeModule());

    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final AuditLogAspect aspect = new AuditLogAspect(auditLogService, OBJECT_MAPPER);

    @BeforeEach
    void setUp() {
        RequestContextHolder.resetRequestAttributes();
        reset(auditLogService);
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void createAuditsActorActionEntityAndIdDerivedFromReturnValue() throws Throwable {
        withRequest("42", "EMPLOYER");

        JobPostRequest request = new JobPostRequest();
        request.setTitle("Plumbing repair");
        request.setLocation("Hyderabad");
        request.setEmployerId(1L);
        request.setWagePerDay(new BigDecimal("500"));

        ProceedingJoinPoint joinPoint = joinPoint(method("create", JobPostRequest.class),
                new Object[]{request},
                JobPostResponse.builder().id(7L).title("Plumbing repair").build());

        Object returned = aspect.audit(joinPoint);

        assertNotNull(returned);
        assertEquals(7L, ((JobPostResponse) returned).getId());

        AuditLog row = capturedAuditLog();
        assertEquals("42", row.getActorId());
        assertEquals("EMPLOYER", row.getActorRole());
        assertEquals("CREATE", row.getAction());
        assertEquals("JobPost", row.getEntityType());
        // idParam = -1 → derived from the return value's getId()
        assertEquals("7", row.getEntityId());
        // newValueParam = 0 → summary of the request DTO
        assertTrue(row.getNewValue().contains("Plumbing repair"));
        assertNull(row.getOldValue());
        assertTrue(row.isSuccess());
        // createdAt is stamped by JPA's @PrePersist on real persistence (the
        // repository is mocked here), so it is intentionally not asserted.
    }

    @Test
    void deleteUsesIdParamOldValueParamAndDetail() throws Throwable {
        withRequest("9", "ADMIN");

        ProceedingJoinPoint joinPoint = joinPoint(method("delete", Long.class),
                new Object[]{5L}, null);

        aspect.audit(joinPoint);

        AuditLog row = capturedAuditLog();
        assertEquals("DELETE", row.getAction());
        assertEquals("5", row.getEntityId());
        assertEquals("5", row.getOldValue());
        assertEquals("Soft-delete job post", row.getDetail());
        assertNull(row.getNewValue());
        assertTrue(row.isSuccess());
    }

    @Test
    void explicitNewValueParamWinsEvenWhenNull() throws Throwable {
        withRequest("3", "EMPLOYER");

        // update(id, null) — newValueParam=1 points at a null argument.
        ProceedingJoinPoint joinPoint = joinPoint(method("update", Long.class, JobPostRequest.class),
                new Object[]{5L, null}, null);

        aspect.audit(joinPoint);

        AuditLog row = capturedAuditLog();
        assertEquals("5", row.getEntityId());
        // No silent fallback to the return value.
        assertNull(row.getNewValue());
    }

    @Test
    void failureIsAuditedAndRethrown() throws Throwable {
        withRequest("1", "EMPLOYER");

        JobPostRequest request = new JobPostRequest();
        request.setTitle("House cleaning");

        ProceedingJoinPoint joinPoint = joinPoint(method("update", Long.class, JobPostRequest.class),
                new Object[]{5L, request}, null);
        doThrow(new IllegalStateException("boom")).when(joinPoint).proceed();

        assertThrows(IllegalStateException.class, () -> aspect.audit(joinPoint));

        AuditLog row = capturedAuditLog();
        assertFalse(row.isSuccess());
        assertEquals("5", row.getEntityId());
        assertTrue(row.getDetail().contains("IllegalStateException"));
        assertTrue(row.getDetail().contains("boom"));
    }

    @Test
    void auditFailureNeverBreaksBusinessOperation() throws Throwable {
        withRequest("1", "EMPLOYER");

        ProceedingJoinPoint joinPoint = joinPoint(method("delete", Long.class),
                new Object[]{5L}, null);
        doThrow(new RuntimeException("db down")).when(auditLogService).save(any());

        Object result = aspect.audit(joinPoint);

        // The business result still flows through despite the broken audit store.
        assertNull(result);
        verify(auditLogService).save(any());
    }

    @Test
    void missingRequestContextFallsBackToAnonymous() throws Throwable {
        // No RequestContextHolder is set on purpose — e.g. scheduled execution.
        ProceedingJoinPoint joinPoint = joinPoint(method("delete", Long.class),
                new Object[]{5L}, null);

        aspect.audit(joinPoint);

        AuditLog row = capturedAuditLog();
        assertEquals("anonymous", row.getActorId());
        assertEquals("", row.getActorRole());
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private ProceedingJoinPoint joinPoint(Method annotatedMethod, Object[] args, Object result)
            throws Throwable {
        ProceedingJoinPoint joinPoint = mock(ProceedingJoinPoint.class);
        when(joinPoint.getArgs()).thenReturn(args);
        when(joinPoint.proceed()).thenReturn(result);
        when(joinPoint.getTarget()).thenReturn(new AnnotatedMethods());
        MethodSignature signature = mock(MethodSignature.class);
        when(signature.getMethod()).thenReturn(annotatedMethod);
        when(joinPoint.getSignature()).thenReturn(signature);
        return joinPoint;
    }

    private Method method(String name, Class<?>... paramTypes) throws NoSuchMethodException {
        return AnnotatedMethods.class.getMethod(name, paramTypes);
    }

    private void withRequest(String userId, String role) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-User-Id", userId);
        request.addHeader("X-User-Role", role);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    private AuditLog capturedAuditLog() {
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogService).save(captor.capture());
        return captor.getValue();
    }

    /**
     * Real methods carrying the {@link Auditable} annotations under test, so
     * the tests exercise the exact annotation instances the aspect resolves.
     */
    private static final class AnnotatedMethods {

        @Auditable(action = "CREATE", entity = "JobPost", newValueParam = 0)
        public JobPostResponse create(JobPostRequest request) {
            return null;
        }

        @Auditable(action = "DELETE", entity = "JobPost", idParam = 0,
                oldValueParam = 0, detail = "Soft-delete job post")
        public void delete(Long id) {
        }

        @Auditable(action = "UPDATE", entity = "JobPost", idParam = 0, newValueParam = 1)
        public JobPostResponse update(Long id, JobPostRequest request) {
            return null;
        }
    }
}
