/** Public routes that render without an authenticated session. */
export const guestRoutes = ['/login', '/register', '/forgot-password'];

/** Authenticated routes with no required path params. */
export const staticAuthenticatedRoutes = ['/', '/projects', '/profile', '/admin/users', '/admin/permissions'];
