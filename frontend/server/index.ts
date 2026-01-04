import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth, hasUsers } from "./auth";

const app = new Hono();

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

const port = parseInt(process.env.AUTH_PORT || "3001", 10);

console.log(`Auth server starting on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
