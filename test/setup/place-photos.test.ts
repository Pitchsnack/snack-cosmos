import { describe, it, expect } from "vitest";
import { placePhotos } from "@/components/startups/attachment-card";
import { EMPTY_SLOT, type EntityMediaState } from "@/components/media/entity-media-editor";

const f = (n: string) => new File(["x"], n, { type: "image/png" });
const empty = () => [{ ...EMPTY_SLOT }, { ...EMPTY_SLOT }, { ...EMPTY_SLOT }] as EntityMediaState["slots"];
const names = (s: EntityMediaState["slots"]) => s.map((x) => x.pendingFile?.name ?? null);

describe("dropping photos", () => {
  it("a drop on space 2 lands in space 2", () => {
    expect(names(placePhotos(empty(), [f("a")], 1))).toEqual([null, "a", null]);
  });
  it("several files: first in the target space, rest in the next empty spaces", () => {
    expect(names(placePhotos(empty(), [f("a"), f("b"), f("c")], 2))).toEqual(["b", "c", "a"]);
  });
  it("a drop elsewhere fills the first empty space and never more than 3", () => {
    const s = empty(); s[0] = { ...EMPTY_SLOT, persistedPath: "p" };
    expect(names(placePhotos(s, [f("a"), f("b"), f("c")]))).toEqual([null, "a", "b"]);
  });
});
