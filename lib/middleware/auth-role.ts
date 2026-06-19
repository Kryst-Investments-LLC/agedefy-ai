/**
 * Re-export shim so older routes that import from @/lib/middleware/auth-role
 * continue to work. New routes should import directly from @/lib/rbac.
 */
export { requireAuth, requireRole, requireAuthWithRole } from "@/lib/rbac"
