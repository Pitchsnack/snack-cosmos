export type ExistingStartupMedia = { slot: number; image_url: string };
export type IncomingStartupMedia = { slot: number; image_path: string };

/** A path is orphaned only when no incoming slot still references it. */
export function orphanedStartupMediaPaths(
  existing: ExistingStartupMedia[],
  incoming: IncomingStartupMedia[],
): string[] {
  const retainedPaths = new Set(incoming.map((item) => item.image_path));
  return [...new Set(
    existing
      .map((item) => item.image_url)
      .filter((path) => !retainedPaths.has(path)),
  )];
}
