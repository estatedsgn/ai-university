import "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleRooms } from "./lib/rooms.server";
import { handleEnrollment } from "./lib/enrollment.server";
export { Rooms } from "./lib/rooms.server";
type ServerEntry = {
  fetch: (r: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};
function secure(response: Response) {
  if (response.status === 101) return response;
  const h = new Headers(response.headers);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  h.set(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://higgsfield.ai https://*.higgsfield.ai https://higgsfield.app https://*.higgsfield.app https://higgsfield-dev.app https://*.higgsfield-dev.app; base-uri 'self'; object-src 'none'",
  );
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: h,
  });
}
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const u = new URL(request.url);
      if (u.pathname === "/robots.txt")
        return secure(
          new Response(
            "User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: " + u.origin + "/sitemap.xml",
            { headers: { "content-type": "text/plain" } },
          ),
        );
      if (u.pathname === "/sitemap.xml")
        return secure(
          new Response(
            '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' +
              u.origin +
              "/</loc></url></urlset>",
            { headers: { "content-type": "application/xml" } },
          ),
        );
      if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
        u.pathname = u.pathname.slice(0, -1);
        return secure(Response.redirect(u.toString(), 301));
      }
      const enrollment = await handleEnrollment(request, env);
      if (enrollment) return secure(enrollment);
      const room = await handleRooms(request, env);
      if (room) return secure(room);
      const m = await import("@tanstack/react-start/server-entry");
      const entry = (m.default ?? m) as ServerEntry;
      return secure(await entry.fetch(request, env, ctx));
    } catch {
      return secure(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html;charset=utf-8" },
        }),
      );
    }
  },
};
