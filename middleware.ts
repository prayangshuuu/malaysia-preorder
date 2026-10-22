import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { isAdminOrStaffRole } from "@/lib/auth/rbac";

/**
 * Next.js Edge / Request Middleware
 * Protects /admin routes and /account routes from unauthenticated or unauthorized access.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAccountRoute = pathname.startsWith("/account");
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminLoginRoute = pathname === "/admin/login";

  // Public routes or assets pass through
  if (!isAccountRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  // Admin login page is accessible publicly without being redirected to itself
  if (isAdminLoginRoute) {
    // If already logged in as admin, redirect to /admin
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
      const session = await verifySessionToken(token);
      if (session && isAdminOrStaffRole(session.role)) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    if (isAdminRoute) {
      return NextResponse.redirect(
        new URL(`/admin/login?returnUrl=${encodeURIComponent(pathname)}`, request.url)
      );
    }
    return NextResponse.redirect(
      new URL(`/login?returnUrl=${encodeURIComponent(pathname)}`, request.url)
    );
  }

  const session = await verifySessionToken(token);
  if (!session || !session.isActive) {
    if (isAdminRoute) {
      return NextResponse.redirect(
        new URL(`/admin/login?error=session_expired`, request.url)
      );
    }
    return NextResponse.redirect(
      new URL(`/login?error=session_expired`, request.url)
    );
  }

  // If accessing /admin, require staff/admin role
  if (isAdminRoute) {
    if (!isAdminOrStaffRole(session.role)) {
      // Forbidden: customer trying to view admin page
      return NextResponse.redirect(
        new URL("/unauthorized?reason=admin_required", request.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
