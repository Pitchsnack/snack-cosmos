import type { AssignableTenantDTO } from "@/lib/tenants.functions";

/**
 * Shared queryFn for the assignable-tenants authorized-choice list.
 *
 * The underlying server fn is auth-protected. During sign-out transitions or
 * when a refetch fires after the session token has expired, the client has no
 * bearer token to attach and the call rejects with "Unauthorized". That state
 * is transient (the auth gate redirects to /login), so the choice list
 * degrades to empty instead of surfacing an uncaught runtime error.
 */
export async function queryAssignableTenants(
  fetchFn: () => Promise<AssignableTenantDTO[]>,
): Promise<AssignableTenantDTO[]> {
  try {
    return await fetchFn();
  } catch (error) {
    if (
      error instanceof Error &&
      /unauthorized|no authorization header/i.test(error.message)
    ) {
      return [];
    }
    throw error;
  }
}
