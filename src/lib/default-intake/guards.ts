/**
 * Default Intake — shared safety guards.
 *
 * `FIXTURE_ID_PREFIX` is the ONE authoritative prefix for mock-adapter
 * identifiers. Both client and server code must call `assertNoFixtureIds`
 * before any value crosses into a real mutation path.
 */
import { DefaultIntakeError } from "./types";

export const FIXTURE_ID_PREFIX = "fixture-default-intake-" as const;

export function isFixtureId(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(FIXTURE_ID_PREFIX);
}

export function assertNoFixtureIds(values: Array<string | null | undefined>): void {
  for (const v of values) {
    if (isFixtureId(v)) {
      throw new DefaultIntakeError(
        "FIXTURE_ID_REJECTED",
        "Default Intake mock fixture IDs must not be sent to real mutations.",
      );
    }
  }
}
