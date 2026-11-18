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
/**
 * No jumping ahead: steps after the first unanswered step are locked. A step without an
 * explicit `answered` flag counts as answered only when its state is "done".
 * Returns the index of the first unanswered step (-1 when every step is answered).
 */
export function firstBlockingStep(steps: readonly { state: string; answered?: boolean }[]): number {
  return steps.findIndex((s) => !(s.answered ?? s.state === "done"));
}
export const stepLocked = (i: number, block: number) => block >= 0 && i > block;
