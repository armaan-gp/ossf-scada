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

function isFloatPropertyType(propertyType: string | null | undefined): boolean {
  return (propertyType ?? "").toUpperCase() === "FLOAT";
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

export function formatPropertyDisplayValue(
  value: unknown,
  propertyType: string | null | undefined,
  decimalPlaces: number | null
): string {
  if (!isFloatPropertyType(propertyType) || decimalPlaces === null) {
    return normalizeDisplayValue(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(decimalPlaces);
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed.toFixed(decimalPlaces);
  }

  return normalizeDisplayValue(value);
}
