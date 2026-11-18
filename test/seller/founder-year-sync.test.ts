import { describe, expect, it } from "vitest";
import { composeFounderBio, initialFounderStory, syncFounderStoriesYear, syncFounderStoryYear } from "../../src/lib/founder-story";

describe("founder story company-year synchronization", () => {
  it("leaves the year empty when no company year exists", () => {
    expect(initialFounderStory(null, null, "en", "", "").parts.year).toBe("");
    expect(initialFounderStory(null, null, "th", "", "").parts.year).toBe("");
  });

  it("updates an unedited English and Thai year when the company year changes", () => {
    const en = initialFounderStory(null, null, "en", "2026", "");
    const th = initialFounderStory(null, null, "th", "2026", "");
    expect(syncFounderStoryYear(en, "2026", "2018")?.parts.year).toBe("2018");
    expect(syncFounderStoryYear(th, "2026", "2018")?.parts.year).toBe("2018");
  });

  it("fills a blank unedited year after the company year is supplied", () => {
    const story = initialFounderStory(null, null, "en", "", "");
    expect(syncFounderStoryYear(story, "", "2018")?.parts.year).toBe("2018");
  });

  it("preserves a custom-typed year and the other story parts", () => {
    const story = initialFounderStory(null, null, "en", "2026", "");
    story.parts.year = "1999";
    story.parts.grew = "a family manufacturer";
    const synced = syncFounderStoryYear(story, "2026", "2018");
    expect(synced).toBe(story);
    expect(synced?.parts).toMatchObject({ year: "1999", grew: "a family manufacturer" });
  });

  it("recomposes the synchronized sentence without changing own-words mode", () => {
    const lines = initialFounderStory(null, null, "en", "2026", "");
    lines.parts.grew = "a regional exporter";
    const syncedLines = syncFounderStoryYear(lines, "2026", "2018")!;
    expect(composeFounderBio(syncedLines)).toBe("Founded the company in 2018 and developed it into a regional exporter.");

    const own = {...lines, mode: "own" as const};
    const syncedOwn = syncFounderStoryYear(own, "2026", "2018")!;
    expect(syncedOwn.mode).toBe("own");
    expect(syncedOwn.parts.year).toBe("2018");
  });

  it("updates saved founder state while its editor is closed and preserves an own-words bio", () => {
    const lines = initialFounderStory(null, null, "en", "2026", "");
    lines.parts.grew = "a regional exporter";
    const own = {...initialFounderStory(null, null, "th", "2026", ""), mode: "own" as const};
    const [synced] = syncFounderStoriesYear([{
      full_name: "Test Founder",
      bio: composeFounderBio(lines),
      bio_story: lines,
      bio_th: "คำเล่าของผู้ก่อตั้ง",
      bio_story_th: own,
    }], "2026", "2018");
    expect(synced.bio_story?.parts.year).toBe("2018");
    expect(synced.bio_story_th?.parts.year).toBe("2018");
    expect(synced.bio).toBe("Founded the company in 2018 and developed it into a regional exporter.");
    expect(synced.bio_th).toBe("คำเล่าของผู้ก่อตั้ง");
  });
});
