import { defineConfig, type Kit } from "@acme/app";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import {
  type CaptureError,
  createErrorHandler,
  type RenderErrorPage,
} from "./error-page";
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

const buildApp = (capture?: CaptureError, page?: RenderErrorPage) => {
  const app = buildThrowingApp();
  const lookups = { findCapture: () => capture, findPage: () => page };
  const handleError = createErrorHandler(lookups);
  app.onError(handleError);

  return app;
};

const recordingCapture = (caught: unknown[]): CaptureError => {
  return (_ctx, error) => {
    caught.push(error);
    return Promise.resolve(EVENT_ID);
  };
};

const projectPage: RenderErrorPage = (_ctx, { status, reference }) => {
  const body = `project page ${status} ${reference}`;
  const response = new Response(body, { status });
  return Promise.resolve(response);
};

const fetchFrom = async (app: Hono, path: string, accept?: string) => {
  const headers = accept === undefined ? undefined : { accept };

  const request = new Request(`http://app.test${path}`, { headers });
  return app.fetch(request, {});
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
      reference: EVENT_ID,
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
      reference: null,
    });
  });

  it("escapes a reference before putting it in the page", async () => {
    const capture: CaptureError = () => {
      return Promise.resolve("<script>x</script>");
    };
    const app = buildApp(capture);
    const res = await fetchFrom(app, "/boom", BROWSER_ACCEPT);

    await expect(res.text()).resolves.toContain("&lt;script&gt;x");
  });

  it("answers a browser with the project's page, given status and reference", async () => {
    const app = buildApp(recordingCapture([]), projectPage);
    const res = await fetchFrom(app, "/boom", BROWSER_ACCEPT);

    expect(res.status).toBe(500);
    await expect(res.text()).resolves.toBe(`project page 500 ${EVENT_ID}`);
  });

  it("answers JSON, not the project's page, to a client asking for JSON", async () => {
    const app = buildApp(recordingCapture([]), projectPage);
    const res = await fetchFrom(app, "/boom", "application/json");

    await expect(res.json()).resolves.toMatchObject({ reference: EVENT_ID });
  });

  it("falls back to the plain page when the project's page throws", async () => {
    const brokenPage: RenderErrorPage = () => {
      return Promise.reject(new Error("layout exploded"));
    };
    const app = buildApp(recordingCapture([]), brokenPage);
    const res = await fetchFrom(app, "/boom", BROWSER_ACCEPT);

    expect(res.status).toBe(500);
    await expect(res.text()).resolves.toContain("Something went wrong");
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

// Alone in this file: what a kit registers reaches every later composed app.
describe("composeApp", () => {
  it("reports and renders through what a declared kit registers", async () => {
    const caught: unknown[] = [];
    const capturingKit: Kit = {
      name: "@fixture/capturing",
      init: ({ register }) => {
        register("captureError", recordingCapture(caught));
        register("renderErrorPage", projectPage);
        return {};
      },
    };
    const config = defineConfig({ kits: [capturingKit] });
    const app = buildThrowingApp();
    const composedApp = composeApp(app, config);
    const res = await fetchFrom(composedApp, "/boom", BROWSER_ACCEPT);

    await expect(res.text()).resolves.toBe(`project page 500 ${EVENT_ID}`);
    expect(caught).toHaveLength(1);
  });
});
