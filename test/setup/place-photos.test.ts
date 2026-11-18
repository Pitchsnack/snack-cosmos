import { describe, it, expect } from "vitest";
import { photoSlotFilled, placePhotos } from "@/components/startups/attachment-card";
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
  it("a drop on an occupied space replaces that photo and preserves the others", () => {
    const s = empty();
    s[0] = { ...EMPTY_SLOT, persistedPath: "first" };
    s[1] = { ...EMPTY_SLOT, persistedPath: "second" };
    const next = placePhotos(s, [f("replacement")], 1);
    expect(next[0]?.persistedPath).toBe("first");
    expect(next[1]).toMatchObject({ persistedPath: null, signedUrl: null, pendingFile: expect.any(File) });
    expect(names(next)).toEqual([null, "replacement", null]);
  });
  it("extra files dropped on an occupied space fill only the remaining empty spaces", () => {
    const s = empty();
    s[0] = { ...EMPTY_SLOT, persistedPath: "first" };
    s[1] = { ...EMPTY_SLOT, persistedPath: "second" };
    expect(names(placePhotos(s, [f("replacement"), f("third")], 1))).toEqual([null, "replacement", "third"]);
    expect(placePhotos(s, [f("replacement"), f("third")], 1)[0]?.persistedPath).toBe("first");
  });
  it("a broken stored image is empty and accepts the next dropped photo", () => {
    const s = empty();
    s[0] = { ...EMPTY_SLOT, persistedPath: "missing", signedUrl: "https://img.invalid/missing" };
    const broken = new Set(["https://img.invalid/missing"]);
    expect(photoSlotFilled(s[0], broken)).toBe(false);
    expect(names(placePhotos(s, [f("replacement")], undefined, (slot) => photoSlotFilled(slot, broken)))).toEqual(["replacement", null, null]);
  });
  it("a pending replacement is filled even when the old stored URL failed", () => {
    const oldUrl = "https://img.invalid/missing";
    const slot = { ...EMPTY_SLOT, persistedPath: "missing", signedUrl: oldUrl, pendingFile: f("new") };
    expect(photoSlotFilled(slot, new Set([oldUrl]))).toBe(true);
  });
});
