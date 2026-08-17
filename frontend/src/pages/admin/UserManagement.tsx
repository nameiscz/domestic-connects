import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useToasts } from '../../hooks/useToasts';
import { useClientTable } from '../../hooks/useClientTable';
import ToastStack from '../../components/ToastStack';
import TableToolbar from '../../components/TableToolbar';
import type { AdminUserInfo, Role } from '../../types';

const ROLE_BADGE: Record<Role, string> = {
  WORKER: 'primary',
  EMPLOYER: 'success',
  ADMIN: 'danger',
};

// Fields matched by the table search (module-level so the hook memo is stable).
const USER_SEARCH_FIELDS: (keyof AdminUserInfo)[] = ['name', 'email', 'role'];

/**
 * UserManagement — platform-wide user management (admin).
 *
 * Fetches the full user list from the admin-service aggregator
 * (GET /admin-service/admin/users, exposed through the gateway as
 * GET /api/admin/users, ApiResponse-wrapped) and lets an ADMIN activate or
 * deactivate accounts via the auth-service PATCH endpoints
 * (PATCH /api/auth/admin/users/{id}/activate and .../deactivate, ADMIN-only).
 * The row's status is updated in place on success.
 */
export default function UserManagement() {
  const { toasts, pushToast, dismissToast } = useToasts();

  const [users, setUsers] = useState<AdminUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);

  const {
    query,
    changeQuery,
    page,
    setPage,
    pageSize,
    changePageSize,
    filteredCount,
    totalPages,
    pageRows,
  } = useClientTable(users, { searchFields: USER_SEARCH_FIELDS });

  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await axiosInstance.get('/api/admin/users', { signal });
      setUsers(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
        setLoadError(
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Unable to load users. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers, refresh]);

  const toggleActive = async (user: AdminUserInfo) => {
    if (togglingId) return;
    setTogglingId(user.id);
    try {
      const action = user.active ? 'deactivate' : 'activate';
      await axiosInstance.patch(`/api/auth/admin/users/${user.id}/${action}`);
      // Update the row status locally on success.
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u))
      );
      pushToast(
        user.active
          ? `"${user.name}" was deactivated.`
          : `"${user.name}" was activated.`
      );
    } catch (err) {
      pushToast(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Unable to update the account. Please try again.',
        'danger'
      );
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = users.filter((u) => u.active).length;
  const showToolbar = !loading && !loadError && users.length > 0;

  return (
    <section aria-busy={loading || Boolean(togglingId)}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">
          Users{' '}
          {!loading && !loadError && (
            <span className="text-muted fw-normal">
              · {activeCount} active of {users.length}
            </span>
          )}
        </h3>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => setRefresh((r) => r + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {showToolbar && (
        <TableToolbar
          query={query}
          onQueryChange={changeQuery}
          searchPlaceholder="Search by name, email or role…"
          count={filteredCount}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={changePageSize}
        />
      )}

      {loading ? (
        <div className="text-center py-5" data-testid="user-management-loading">
          <div className="spinner-border text-danger" role="status">
            <span className="visually-hidden">Loading users…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Fetching users…</p>
        </div>
      ) : loadError ? (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load users</h4>
          <p className="mb-2">{loadError}</p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => setRefresh((r) => r + 1)}
          >
            Try again
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">👥</p>
            <h5 className="card-title">No users yet</h5>
            <p className="card-text text-muted mb-0">
              Registered accounts will appear here.
            </p>
          </div>
        </div>
      ) : filteredCount === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">🔍</p>
            <h5 className="card-title">No matching users</h5>
            <p className="card-text text-muted mb-0">
              Nothing matches &quot;{query}&quot;. Try a different search.
            </p>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-end">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((user) => {
                  const isToggling = togglingId === user.id;
                  return (
                    <tr key={user.id}>
                      <td className="fw-semibold">{user.name}</td>
                      <td className="text-muted">{user.email}</td>
                      <td>
                        <span
                          className={`badge badge-soft-${ROLE_BADGE[user.role] || 'secondary'} text-uppercase`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td>
                        {user.active ? (
                          <span className="badge badge-soft-success">Active</span>
                        ) : (
                          <span className="badge badge-soft-danger">Inactive</span>
                        )}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className={`btn btn-sm ${
                            user.active
                              ? 'btn-outline-danger'
                              : 'btn-outline-success'
                          }`}
                          onClick={() => toggleActive(user)}
                          disabled={Boolean(togglingId)}
                          title={user.active ? 'Deactivate account' : 'Activate account'}
                          data-testid={`toggle-${user.id}`}
                        >
                          {isToggling ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm me-1"
                                aria-hidden="true"
                              />
                              Saving…
                            </>
                          ) : user.active ? (
                            'Deactivate'
                          ) : (
                            'Activate'
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
