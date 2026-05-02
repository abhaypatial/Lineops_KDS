/**
 * Runtime configuration — shared mutable settings that can be toggled via
 * POST /api/admin/settings without restarting the server.
 *
 * Values are initialised from environment variables on startup and reset to
 * those defaults on every restart.  For permanent changes, edit the .env file.
 */

export interface SoundConfig {
  /** Default chime type for new orders: "ding" | "beep" | "blip" | "chime" */
  defaultChime: string;
  /** Per-station chime overrides keyed by station ID, e.g. { "grill": "ding", "fryer": "blip" } */
  stationChimes: Record<string, string>;
  /** Master volume 0–1 */
  volume: number;
}

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

  /**
   * Optional KDS sound config pushed by an external management system via
   * POST /api/admin/settings.  When set, the KDS frontend reads it from
   * GET /api/config and merges it over the device-local settings.
   * null = let each device keep its own localStorage preferences.
   */
  soundConfig: null as SoundConfig | null,
};

export type RuntimeConfig = typeof runtimeConfig;

export function applySettings(patch: Partial<RuntimeConfig>): void {
  if (typeof patch.testOrdersEnabled === "boolean") {
    runtimeConfig.testOrdersEnabled = patch.testOrdersEnabled;
  }
  if (Array.isArray(patch.hiddenIntegrations)) {
    runtimeConfig.hiddenIntegrations = patch.hiddenIntegrations.map(String);
  }
  if (patch.soundConfig !== undefined) {
    runtimeConfig.soundConfig = patch.soundConfig;
  }
}
