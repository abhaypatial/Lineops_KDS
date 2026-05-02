/** Normalised order that every POS adapter must return. */
export interface NormalisedOrder {
  externalId:   string;
  orderNumber:  string;
  customerName?: string;
  notes?:       string;
  priority:     "normal" | "rush" | "vip";
  items: NormalisedItem[];
}

export interface NormalisedItem {
  name:       string;
  quantity:   number;
  stationId:  string;       // KDS station id — can be a name ("grill") or a number ("1", "2")
  modifiers?: string[];
  notes?:     string;
}

/** Each adapter returns this or throws. */
export interface AdapterResult {
  shouldProcess: boolean;  // false = silently ignore this event type
  order?: NormalisedOrder;
}

/** Station mapping: POS category/label → KDS stationId */
export type StationMap = Record<string, string>;

export const DEFAULT_STATION_MAP: StationMap = {
  // Common POS category → KDS station fallbacks
  "grill":   "grill",  "hot":      "grill",
  "fryer":   "fryer",  "fried":    "fryer",
  "cold":    "cold",   "salad":    "cold",  "beverage": "cold",
  "dessert": "dessert","sweet":    "dessert",
  "bar":     "cold",   "drink":    "cold",
  "pizza":   "grill",  "pasta":    "grill",
};

/**
 * Map a POS category label to a KDS stationId.
 *
 * Resolution order:
 *   1. Exact key match (covers numeric IDs like "1","2" and named overrides)
 *   2. Case-insensitive exact match
 *   3. Substring keyword match (e.g. "Grill items" → "grill")
 *   4. Pure-numeric label → pass through as-is (allows stationId "1","2","3" in CreateOrderBody)
 *   5. Fall back to "other"
 */
export function mapStation(label: string, stationMap: StationMap = DEFAULT_STATION_MAP): string {
  // 1. Exact key match
  if (stationMap[label] !== undefined) return stationMap[label];

  // 2. Case-insensitive exact match
  const lower = label.toLowerCase().trim();
  for (const [k, v] of Object.entries(stationMap)) {
    if (k.toLowerCase() === lower) return v;
  }

  // 3. Substring keyword match
  for (const [k, v] of Object.entries(stationMap)) {
    if (lower.includes(k.toLowerCase())) return v;
  }

  // 4. Pure numeric — pass through so numeric station IDs route correctly
  if (/^\d+$/.test(label.trim())) return label.trim();

  return "other";
}
