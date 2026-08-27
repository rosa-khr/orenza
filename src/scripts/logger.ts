type ClientLogLevel = "info" | "warn" | "error";

const originalFetch = window.fetch.bind(window);
const clientIdKey = "orenza-client-id";
let clientId = localStorage.getItem(clientIdKey);
if (!clientId) {
  clientId = crypto.randomUUID();
  localStorage.setItem(clientIdKey, clientId);
}

const cleanMessage = (value: unknown) => String(value || "خطای نامشخص").slice(0, 500);

export const logClientEvent = (level: ClientLogLevel, event: string, data: Record<string, unknown> = {}) => {
  const payload = {
    level,
    event: event.slice(0, 80),
    data,
    path: `${location.pathname}${location.search}`.slice(0, 500),
    clientId,
    userAgent: navigator.userAgent.slice(0, 300)
  };
  void originalFetch("/api/v1/analytics/client-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => undefined);
};

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const startedAt = performance.now();
  try {
    const response = await originalFetch(input, init);
    if (url.includes("/api/") && !url.includes("/analytics/client-log") && response.status >= 400) {
      logClientEvent("warn", "api_request_failed", {
        method: init?.method || (input instanceof Request ? input.method : "GET"),
        endpoint: new URL(url, location.origin).pathname,
        statusCode: response.status,
        durationMs: Math.round(performance.now() - startedAt)
      });
    }
    return response;
  } catch (error) {
    if (!url.includes("/analytics/client-log")) {
      logClientEvent("error", "api_request_error", {
        endpoint: new URL(url, location.origin).pathname,
        message: cleanMessage(error)
      });
    }
    throw error;
  }
};

window.addEventListener("error", (event) => {
  logClientEvent("error", "frontend_error", {
    message: cleanMessage(event.error || event.message),
    source: event.filename ? new URL(event.filename).pathname : undefined,
    line: event.lineno || undefined
  });
});

window.addEventListener("unhandledrejection", (event) => {
  logClientEvent("error", "unhandled_promise_rejection", { message: cleanMessage(event.reason) });
});

logClientEvent("info", "page_view");
