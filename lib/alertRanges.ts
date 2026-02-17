export interface PropertyForAlert {
  type: string;
  last_value: unknown;
}

export interface ThresholdRange {
  min: number | null;
  max: number | null;
}

/**
 * Returns whether a property value is outside the given range (in alert).
 * Only alerts if:
 * - min is set and value < min, OR
 * - max is set and value > max
 * If both min and max are null/undefined, no alert is triggered.
 */
export function isPropertyInAlert(
  property: PropertyForAlert,
  range?: ThresholdRange | null
): boolean {
  const t = (property.type || "").toUpperCase();
  if (t !== "INT" && t !== "FLOAT") return false;

  const val = property.last_value;
  const num = typeof val === "number" ? val : Number(val);
  if (Number.isNaN(num)) return false;

  // If no range provided or both min and max are null, no alert
  if (!range || (range.min === null && range.max === null)) {
    return false;
  }

  // Check if value is below min (if min is set)
  if (range.min !== null && num < range.min) {
    return true;
  }

  // Check if value is above max (if max is set)
  if (range.max !== null && num > range.max) {
    return true;
  }

  return false;
}
