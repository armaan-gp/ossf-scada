export function normalizeDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "N/A";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "N/A";
  }
}

export function resolvePropertyDecimalPlaces(
  thingId: string,
  propertyId: string,
  globalDecimalPlaces: number | null,
  perPropertyMap: Record<string, number | null>
): number | null {
  const perProperty = perPropertyMap[`${thingId}:${propertyId}`];
  return perProperty ?? globalDecimalPlaces ?? null;
}

export function formatNumericDisplayValue(value: unknown, decimalPlaces: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || decimalPlaces === null) {
    return normalizeDisplayValue(value);
  }
  return value.toFixed(decimalPlaces);
}
