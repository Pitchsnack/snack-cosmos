import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StoryPart } from "./founder-story-editor";
import type { ListingSource } from "@/lib/public-listing";
import {
  composeDescription,
  DESCRIPTION_HINTS,
  descriptionStoryLines,
  initialDescriptionStory,
  typeDescriptionPart,
  type DescriptionHandover,
  type DescriptionLanguage,
  type DescriptionStory,
  type DescriptionStoryPair,
  type DescriptionStoryValue,
  type DescriptionTextPair,
} from "@/lib/description-story";

export function DescriptionStoryEditor({
  id = "description-story",
  description,
  descriptionTh,
  story,
  storyTh,
  source,
  handover,
  lang,
  large = false,
  tr,
  onChange,
}: {
  id?: string;
  description: string;
  descriptionTh: string;
  story?: DescriptionStory | null;
  storyTh?: DescriptionStory | null;
  source: ListingSource;
  handover: DescriptionHandover;
  lang: DescriptionLanguage;
  large?: boolean;
  tr: (en: string, th: string) => string;
  onChange: (value: DescriptionStoryValue) => void;
}) {
  const stories: DescriptionStoryPair = useMemo(() => ({
    en: initialDescriptionStory(description, story, "en", source, handover),
    th: initialDescriptionStory(descriptionTh, storyTh, "th", source, handover),
  }), [description, descriptionTh, story, storyTh, source, handover.stays, handover.months]); // eslint-disable-line react-hooks/exhaustive-deps
  const texts: DescriptionTextPair = { en: description, th: descriptionTh };
  const ownTextarea = useRef<HTMLTextAreaElement>(null);
  const focusOwn = useRef(false);
  const current = stories[lang];
  const thai = lang === "th";

  useEffect(() => {
    const nextTexts = {
      en: stories.en.mode === "lines" ? composeDescription(stories.en) : texts.en,
      th: stories.th.mode === "lines" ? composeDescription(stories.th) : texts.th,
    };
    const storiesChanged = JSON.stringify({ en: story ?? null, th: storyTh ?? null }) !== JSON.stringify(stories);
    if (!storiesChanged && nextTexts.en === texts.en && nextTexts.th === texts.th) return;
    onChange({ stories, texts: nextTexts });
  }, [JSON.stringify(stories)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focusOwn.current) return;
    focusOwn.current = false;
    ownTextarea.current?.focus();
  }, [current.mode]);

  const emit = (nextStories: DescriptionStoryPair, nextTexts = texts) => onChange({ stories: nextStories, texts: nextTexts });
  const updatePart = (key: keyof DescriptionStory["parts"], value: string) => {
    const next = typeDescriptionPart(current, key, value);
    const nextStories = { ...stories, [lang]: next } as DescriptionStoryPair;
    emit(nextStories, { ...texts, [lang]: composeDescription(next) });
  };
  const updateOwn = (value: string) => emit(stories, { ...texts, [lang]: value });
  const toggleMode = () => {
    if (current.mode === "lines") {
      focusOwn.current = true;
      const nextStories = {
        en: { ...stories.en, mode: "own" as const },
        th: { ...stories.th, mode: "own" as const },
      };
      emit(nextStories, {
        en: composeDescription(stories.en),
        th: composeDescription(stories.th),
      });
    } else {
      const nextStories = {
        en: { ...stories.en, mode: "lines" as const },
        th: { ...stories.th, mode: "lines" as const },
      };
      emit(nextStories, { en: composeDescription(nextStories.en), th: composeDescription(nextStories.th) });
    }
  };

  return <div className="min-w-0">
    {current.mode === "own" ? (
      <Textarea
        ref={ownTextarea}
        id={id}
        lang={lang}
        aria-label={tr("Description", "คำอธิบาย")}
        maxLength={420}
        rows={large ? 6 : 5}
        value={texts[lang]}
        onChange={(event) => updateOwn(event.target.value)}
        className={large ? "seller-wording-input min-h-28 resize-y" : "min-h-28 resize-y rounded-[9px] border-input bg-background px-[13px] py-[10px] text-[15px] leading-[1.5] focus-visible:ring-0 focus-visible:ring-offset-0"}
      />
    ) : (
      <div id={id} lang={lang} className={`founder-story description-story ${large ? "description-story-large" : ""}`} role="group" aria-label={tr("Description", "คำอธิบาย")}>
        {descriptionStoryLines(lang, handover).map((line, index) => <div key={index}>
          {line.map((token, tokenIndex) => typeof token === "string" ? token : (() => {
            const key = token[0];
            return <StoryPart
              key={`${index}-${tokenIndex}`}
              value={current.parts[key]}
              hint={DESCRIPTION_HINTS[lang][key]}
              auto={!!current.auto?.[key]}
              maxLength={420}
              onChange={(value) => updatePart(key, value)}
            />;
          })())}
        </div>)}
      </div>
    )}
    <div className="founder-story-footer">
      <span>{current.mode === "own" ? tr("Your own words.", "ข้อความที่ท่านเขียนเอง") : tr("Click a highlighted part to change it.", "คลิกส่วนที่ไฮไลต์เพื่อแก้ไข")}</span>
      <Button variant="link" type="button" className="h-auto p-0 text-[13px] font-semibold text-link" onClick={toggleMode}>
        {current.mode === "own" ? tr("Use the sentences instead", "ใช้ประโยคแทน") : tr("Write it yourself", "เขียนเอง")}
      </Button>
    </div>
  </div>;
}
