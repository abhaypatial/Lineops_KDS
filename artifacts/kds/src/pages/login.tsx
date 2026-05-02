import { useState } from "react";
import { useLocation } from "wouter";

const KEY = "kds_admin_password";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/health", {
        headers: { Authorization: `Bearer ${password}` },
      });

      if (res.ok || res.status === 200) {
        const json = await res.json();
        // If auth is disabled the server always returns ok — accept any password
        if (!json.authEnabled || res.ok) {
          localStorage.setItem(KEY, password);
          navigate("/dashboard");
          return;
        }
      }

      if (res.status === 401) {
        setError("Incorrect password. Try again.");
      } else {
        setError("Could not reach the KDS server. Is it running?");
      }
    } catch {
      setError("Network error — make sure the KDS server is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0a0a0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360, padding: "0 24px" }}>
        {/* Logo / wordmark */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "linear-gradient(135deg,#f59e0b,#ef4444)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              🍳
            </div>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "-0.5px",
              }}
            >
              LineOps KDS
            </span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>
            Admin Access
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "32px 28px",
          }}
        >
          <form onSubmit={handleSubmit}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 8,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 14px",
                background: "rgba(255,255,255,0.06)",
                border: error
                  ? "1px solid rgba(239,68,68,0.6)"
                  : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                color: "#fff",
                fontSize: 15,
                outline: "none",
                transition: "border-color 0.2s",
                marginBottom: error ? 8 : 20,
              }}
            />

            {error && (
              <p
                style={{
                  color: "#ef4444",
                  fontSize: 12,
                  margin: "0 0 16px",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: "100%",
                padding: "11px 0",
                background:
                  loading || !password
                    ? "rgba(245,158,11,0.3)"
                    : "linear-gradient(135deg,#f59e0b,#ef4444)",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                cursor: loading || !password ? "not-allowed" : "pointer",
                transition: "opacity 0.2s",
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "rgba(255,255,255,0.18)",
            fontSize: 12,
            marginTop: 24,
          }}
        >
          KDS display is always accessible at{" "}
          <a
            href="/"
            style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}
          >
            /
          </a>
        </p>
      </div>
    </div>
  );
}
