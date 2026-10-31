/** Saved validity and furthest navigation are the only inputs to setup progress. */
export function furthestStep(order: readonly string[], previous: string | null | undefined, opened: string): string | null {
  const oldIndex = order.indexOf(previous ?? "");
  const newIndex = order.indexOf(opened);
  return newIndex > oldIndex ? opened : previous ?? null;
}

export function setupAnswered(key: string, valid: boolean, optional: readonly string[], order: readonly string[], reached: string | null | undefined): boolean {
  return valid || (optional.includes(key) && order.indexOf(key) < order.indexOf(reached ?? ""));
}

export function setupStepState(key: string, current: string, valid: boolean, optional: readonly string[], order: readonly string[], reached: string | null | undefined): "here" | "done" | "missed" | "todo" {
  if (key === current) return "here";
  if (key === "review") return "todo";
  if (setupAnswered(key, valid, optional, order, reached)) return "done";
  return order.indexOf(key) < order.indexOf(reached ?? "") ? "missed" : "todo";
}