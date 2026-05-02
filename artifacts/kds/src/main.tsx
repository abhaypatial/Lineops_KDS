import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Auth injection ─────────────────────────────────────────────────────────────
// Injects the stored admin password as a Bearer token into all /api/* fetch
// calls from management pages.  The KDS display at / only calls public
// endpoints so it works without a password.

const _originalFetch = window.fetch.bind(window);

window.fetch = (
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

  if (url.includes("/api/")) {
    const password = localStorage.getItem("kds_admin_password");
    if (password) {
      const headers = new Headers((init.headers as HeadersInit | undefined) ?? {});
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${password}`);
      }
      init = { ...init, headers };
    }
  }

  return _originalFetch(input, init).then((res) => {
    if (
      res.status === 401 &&
      !url.includes("/api/health") &&
      !url.includes("/api/config") &&
      !window.location.pathname.endsWith("/login")
    ) {
      localStorage.removeItem("kds_admin_password");
      window.location.href = "/login";
    }
    return res;
  });
};

// ─────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<App />);
