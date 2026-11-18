import { describe, expect, it } from "vitest";
import { LatestChangeQueue } from "../../src/lib/media/latest-change-queue";
import { orphanedStartupMediaPaths } from "../../src/lib/media/startup-media-sync";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("photo autosave queue", () => {
  it("saves a delete clicked during an upload without restoring the uploaded photo", async () => {
    const upload = deferred();
    const finished = deferred();
    const started: string[] = [];
    const applied: string[] = [];
    const queue = new LatestChangeQueue<string>(async (change, isLatest) => {
      started.push(change);
      if (change === "upload photo") await upload.promise;
      if (isLatest()) applied.push(change);
      if (change === "delete photo") finished.resolve();
    }, (error) => { throw error; });

    queue.push("upload photo");
    queue.push("delete photo");
    expect(started).toEqual(["upload photo"]);

    upload.resolve();
    await finished.promise;
    expect(started).toEqual(["upload photo", "delete photo"]);
    expect(applied).toEqual(["delete photo"]);
  });

  it("coalesces rapid changes to the newest state and continues after an earlier failure", async () => {
    const upload = deferred();
    const finished = deferred();
    const started: string[] = [];
    const errors: unknown[] = [];
    const queue = new LatestChangeQueue<string>(async (change, isLatest) => {
      started.push(change);
      if (change === "upload photo") {
        await upload.promise;
        throw new Error("upload failed");
      }
      expect(isLatest()).toBe(true);
      finished.resolve();
    }, (error) => { errors.push(error); });

    queue.push("upload photo");
    queue.push("replace photo");
    queue.push("delete photo");
    upload.resolve();
    await finished.promise;

    expect(started).toEqual(["upload photo", "delete photo"]);
    expect(errors).toHaveLength(1);
  });
});

describe("startup media storage cleanup", () => {
  const first = "tenant/startup/first.webp";
  const second = "tenant/startup/second.webp";

  it("keeps the second photo's file when deleting photo one moves it into slot one", () => {
    expect(orphanedStartupMediaPaths(
      [{ slot: 1, image_url: first }, { slot: 2, image_url: second }],
      [{ slot: 1, image_path: second }],
    )).toEqual([first]);
  });

  it("deletes only paths absent from every incoming slot", () => {
    expect(orphanedStartupMediaPaths(
      [{ slot: 1, image_url: first }, { slot: 2, image_url: second }],
      [{ slot: 1, image_path: first }],
    )).toEqual([second]);
    expect(orphanedStartupMediaPaths(
      [{ slot: 1, image_url: first }, { slot: 2, image_url: second }],
      [],
    )).toEqual([first, second]);
  });
});
