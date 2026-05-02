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
  stationId:  string;       // KDS station id
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

export function mapStation(label: string, stationMap: StationMap = DEFAULT_STATION_MAP): string {
  const lower = label.toLowerCase();
  for (const [k, v] of Object.entries(stationMap)) {
    if (lower.includes(k)) return v;
  }
  return "other";
}
