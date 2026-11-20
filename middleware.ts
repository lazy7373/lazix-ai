import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const username = process.env.LAZIX_ACCESS_USER;
  const password = process.env.LAZIX_ACCESS_PASSWORD;

  if (process.env.NODE_ENV === "production" && (!username || !password)) {
    return new NextResponse("LAZIX is not configured securely. Set LAZIX_ACCESS_USER and LAZIX_ACCESS_PASSWORD.", { status: 503 });
  }

  if (!username || !password) return NextResponse.next();

  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Basic ")) {
    try {
      const decoded = atob(authorization.slice(6));
      const separator = decoded.indexOf(":");
      if (separator >= 0 && decoded.slice(0, separator) === username && decoded.slice(separator + 1) === password) {
        return NextResponse.next();
      }
    } catch {
      // Invalid Basic Auth payload; request the credentials again.
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="LAZIX", charset="UTF-8"' }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
