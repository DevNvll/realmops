import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth, hasUsers } from "./auth";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const app = new Hono();
const isProduction = process.env.NODE_ENV === "production";

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// Custom endpoint: Check if setup is needed (no users exist)
// Must be registered BEFORE the wildcard better-auth handler
app.get("/api/auth/setup-status", (c) => {
  const needsSetup = !hasUsers();
  return c.json({ needsSetup });
});

// Better-auth handler - mount at /api/auth/*
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// In production, serve static files from the dist directory
if (isProduction) {
  // Serve static assets (JS, CSS, images, etc.)
  app.use(
    "/assets/*",
    serveStatic({
      root: "./dist",
      rewriteRequestPath: (path) => path,
    })
  );

  // Serve other static files
  app.use(
    "/*",
    serveStatic({
      root: "./dist",
      rewriteRequestPath: (path) => path,
    })
  );

  // SPA fallback - serve index.html for all unmatched routes
  app.get("*", (c) => {
    const indexPath = join(process.cwd(), "dist", "index.html");
    if (existsSync(indexPath)) {
      const html = readFileSync(indexPath, "utf-8");
      return c.html(html);
    }
    return c.notFound();
  });
}

const port = parseInt(process.env.AUTH_PORT || "3001", 10);
// In production, serve on port 3000 (main app port)
const serverPort = isProduction ? parseInt(process.env.PORT || "3000", 10) : port;

console.log(
  isProduction
    ? `RealmOps server starting on http://localhost:${serverPort}`
    : `Auth server starting on http://localhost:${port}`
);

serve({
  fetch: app.fetch,
  port: serverPort,
});
