export function serializeBigInt(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeBigInt);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeBigInt(item)]));
  }
  return value;
}

export function electionStatus(startTime: Date, endTime: Date, override?: string | null) {
  if (override) return override.toLowerCase();
  const now = new Date();
  if (now < startTime) return "upcoming";
  if (now > endTime) return "finished";
  return "active";
}
