import { describe, expect, it } from "vitest";
import { coverUploadAllowed, resolveBuyOrderCover, validCoverFile } from "../../src/lib/buy-order-cover";
const pictures = [
  { id: "new", sector_key: "Fashion", file_name: "new.jpg", uploaded_at: "2026-10-30", url: "/new.jpg" },
  { id: "old", sector_key: "Fashion", file_name: "old.jpg", uploaded_at: "2026-10-01", url: "/old.jpg" },
  { id: "other", sector_key: "Packaging", file_name: "other.jpg", uploaded_at: "2026-09-01", url: "/other.jpg" },
];
describe("Buy-order cover precedence", () => {
  it("uses the individual upload before a selected sector image", () => expect(resolveBuyOrderCover(pictures, "Fashion", "new", { url: "/upload.jpg", name: "upload.jpg" })).toEqual({ url: "/upload.jpg", name: "upload.jpg", source: "upload", imageId: null }));
  it("uses a selected same-sector image before the oldest", () => expect(resolveBuyOrderCover(pictures, "Fashion", "new").imageId).toBe("new"));
  it("ignores a selected image from another sector", () => expect(resolveBuyOrderCover(pictures, "Fashion", "other").imageId).toBe("old"));
  it("falls back to the oldest upload when a selected picture is deleted", () => expect(resolveBuyOrderCover(pictures, "Fashion", "deleted").url).toBe("/old.jpg"));
  it("uses the drawn cover when the sector has no pictures", () => expect(resolveBuyOrderCover(pictures, "Mining")).toEqual({ url: null, name: null, source: "drawn", imageId: null }));
  it("removing an uploaded picture restores the oldest sector picture", () => expect(resolveBuyOrderCover(pictures, "Fashion", null, { url: null, name: null }).imageId).toBe("old"));
});
describe("Upload limits", () => {
  it("accepts only JPG, PNG and WebP", () => { for (const mime of ["image/jpeg", "image/png", "image/webp"]) expect(validCoverFile(mime, 100, 1200, 675)).toBe(true); expect(validCoverFile("image/svg+xml", 100, 1200, 675)).toBe(false); });
  it("allows up to 5 MB but rejects one byte more", () => { expect(validCoverFile("image/jpeg", 5 * 1024 * 1024, 1200, 675)).toBe(true); expect(validCoverFile("image/jpeg", 5 * 1024 * 1024 + 1, 1200, 675)).toBe(false); });
  it("requires at least 1200 pixels wide", () => expect(validCoverFile("image/jpeg", 100, 1199, 675)).toBe(false));
  it("requires at least 675 pixels tall", () => expect(validCoverFile("image/jpeg", 100, 1200, 674)).toBe(false));
  it("requires landscape rather than square or portrait", () => { expect(validCoverFile("image/jpeg", 100, 1200, 1200)).toBe(false); expect(validCoverFile("image/jpeg", 100, 1200, 1600)).toBe(false); });
  it("permits only Control Admins", () => { expect(coverUploadAllowed(true, "admin")).toBe(true); for (const role of ["seller", "buyer", "advisor", null]) expect(coverUploadAllowed(true, role)).toBe(false); expect(coverUploadAllowed(false, "admin")).toBe(false); });
});