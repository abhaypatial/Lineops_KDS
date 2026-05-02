/**
 * Runtime configuration — shared mutable settings that can be toggled via
 * POST /api/admin/settings without restarting the server.
 *
 * Values are initialised from environment variables on startup and reset to
 * those defaults on every restart.  For permanent changes, edit the .env file.
 */
export const runtimeConfig = {
  /** Whether the test-order injection endpoint is enabled. */
  testOrdersEnabled: process.env["ALLOW_TEST_ORDERS"] !== "false",

  /**
   * POS integration IDs that should be hidden in the Integration Hub UI.
   * Comma-separated in HIDDEN_INTEGRATIONS env var, e.g. "square,clover".
   */
  hiddenIntegrations: (process.env["HIDDEN_INTEGRATIONS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export type RuntimeConfig = typeof runtimeConfig;

export function applySettings(patch: Partial<RuntimeConfig>): void {
  if (typeof patch.testOrdersEnabled === "boolean") {
    runtimeConfig.testOrdersEnabled = patch.testOrdersEnabled;
  }
  if (Array.isArray(patch.hiddenIntegrations)) {
    runtimeConfig.hiddenIntegrations = patch.hiddenIntegrations.map(String);
  }
}
