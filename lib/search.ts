/**
 * Case-insensitive substring match across a device's name, brand and model
 * number. An empty (or whitespace-only) query matches everything.
 */
export function matchesQuery(
  device: { name: string; brand: string | null; model_number: string | null },
  query: string,
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") {
    return true;
  }

  const haystacks = [device.name, device.brand ?? "", device.model_number ?? ""];
  return haystacks.some((value) => value.toLowerCase().includes(trimmed));
}
