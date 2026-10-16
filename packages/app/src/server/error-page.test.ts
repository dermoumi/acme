import { defineConfig, type Kit } from "@acme/app";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import { type CaptureError, createErrorHandler } from "./error-page";
import { composeApp } from "./serve";

const EVENT_ID = "0123456789abcdef0123456789abcdef";
const BROWSER_ACCEPT = "text/html,application/xhtml+xml,*/*;q=0.8";

const buildThrowingApp = () => {
  return new Hono()
    .get("/boom", () => {
      throw new Error("route exploded");
    })
    .get("/missing", () => {
      throw new HTTPException(404, { message: "no such thing" });
    })
    .get("/unavailable", () => {
      throw new HTTPException(503, { message: "try later" });
    });
};

const buildApp = (capture?: CaptureError) => {
  const app = buildThrowingApp();
  app.onError(createErrorHandler(() => capture));

  return app;
};

const recordingCapture = (caught: unknown[]): CaptureError => {
  return (_ctx, error) => {
    caught.push(error);
    return Promise.resolve(EVENT_ID);
  };
};

const fetchFrom = async (app: Hono, path: string, accept?: string) => {
  const headers = accept === undefined ? undefined : { accept };

  return app.fetch(new Request(`http://app.test${path}`, { headers }), {});
};

describe("createErrorHandler", () => {
  it("answers a browser with a page naming the event", async () => {
    const app = buildApp(recordingCapture([]));
    const res = await fetchFrom(app, "/boom", BROWSER_ACCEPT);

    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("text/html");
    await expect(res.text()).resolves.toContain(EVENT_ID);
  });

  it("answers a client asking for JSON with the event id", async () => {
    const app = buildApp(recordingCapture([]));
    const res = await fetchFrom(app, "/boom", "application/json");

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Internal Server Error",
      sentryEventId: EVENT_ID,
    });
  });

  it("answers JSON to a client naming no type", async () => {
    const app = buildApp(recordingCapture([]));
    const res = await fetchFrom(app, "/boom");

    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("still answers a browser with a page when nothing captures", async () => {
    const res = await fetchFrom(buildApp(), "/boom", BROWSER_ACCEPT);

    expect(res.status).toBe(500);
    await expect(res.text()).resolves.toContain("Something went wrong");
  });

  it("reports a null event id when nothing captures", async () => {
    const res = await fetchFrom(buildApp(), "/boom", "application/json");

    await expect(res.json()).resolves.toEqual({
      error: "Internal Server Error",
      sentryEventId: null,
    });
  });

  it("hands the thrown error to the capture", async () => {
    const caught: unknown[] = [];
    const app = buildApp(recordingCapture(caught));
    await fetchFrom(app, "/boom");

    expect(caught).toEqual([new Error("route exploded")]);
  });

  it("answers an expected HTTPException as thrown, capturing nothing", async () => {
    const caught: unknown[] = [];
    const app = buildApp(recordingCapture(caught));
    const res = await fetchFrom(app, "/missing", BROWSER_ACCEPT);

    expect(res.status).toBe(404);
    await expect(res.text()).resolves.toBe("no such thing");
    expect(caught).toEqual([]);
  });

  it("captures a server HTTPException, answering it as thrown", async () => {
    const caught: unknown[] = [];
    const app = buildApp(recordingCapture(caught));
    const res = await fetchFrom(app, "/unavailable", BROWSER_ACCEPT);

    expect(res.status).toBe(503);
    expect(caught).toHaveLength(1);
  });
});

// Alone in this file: a registered captureError reaches every later composed app.
describe("composeApp", () => {
  it("reports through the captureError a declared kit registers", async () => {
    const caught: unknown[] = [];
    const capturingKit: Kit = {
      name: "@fixture/capturing",
      init: ({ register }) => {
        register("captureError", recordingCapture(caught));
        return {};
      },
    };
    const config = defineConfig({ kits: [capturingKit] });
    const composed = composeApp(buildThrowingApp(), config);
    const res = await fetchFrom(composed, "/boom", BROWSER_ACCEPT);

    await expect(res.text()).resolves.toContain(EVENT_ID);
    expect(caught).toHaveLength(1);
  });
});
