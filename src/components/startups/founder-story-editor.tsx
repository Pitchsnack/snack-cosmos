import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n/language";
import { useTr } from "@/components/common/edit-info-popup";
import { composeFounderBio, initialFounderStory, plainStoryPart, STORY_HINTS, STORY_LINES, type FounderStory } from "@/lib/founder-story";

function StoryPart({value, hint, onChange}: {value: string; hint: string; onChange: (v: string) => void}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value) el.textContent = value;
  }, [value]);
  function insertText(text: string) {
    const el = ref.current;
    if (!el) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || !el.contains(range.commonAncestorContainer)) return;
    const selected = range.toString().length;
    const remaining = Math.max(0, 120 - (el.textContent?.length ?? 0) + selected);
    const plain = plainStoryPart(text).slice(0, remaining);
    range.deleteContents();
    const node = document.createTextNode(plain);
    range.insertNode(node); range.setStartAfter(node); range.collapse(true);
    selection?.removeAllRanges(); selection?.addRange(range);
    onChange(el.textContent ?? "");
  }
  return <span ref={ref} className="founder-story-part" contentEditable="plaintext-only" suppressContentEditableWarning
    role="textbox" tabIndex={0} aria-label={hint.charAt(0).toUpperCase() + hint.slice(1)} aria-placeholder={hint} data-placeholder={hint}
    onKeyDown={e => {if (e.key === "Enter") e.preventDefault();}}
    onPaste={e => {e.preventDefault(); insertText(e.clipboardData.getData("text/plain"));}}
    onBeforeInput={e => {
      const event = e.nativeEvent as InputEvent;
      if (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak") e.preventDefault();
      if (event.data && (ref.current?.textContent?.length ?? 0) - (window.getSelection()?.toString().length ?? 0) + event.data.length > 120) e.preventDefault();
    }}
    onInput={e => {const el = e.currentTarget; const plain = plainStoryPart(el.textContent ?? ""); if (el.textContent !== plain) el.textContent = plain; onChange(plain);}} />;
}

export function FounderStoryEditor({bio, story: saved, year, sales, onChange}: {
  bio?: string | null; story?: FounderStory | null; year: string; sales: string;
  onChange: (patch: {bio: string; bio_story: FounderStory}) => void;
}) {
  const {language} = useTranslation();
  const lang = language === "th" ? "th" : "en";
  const tr = useTr();
  const story = initialFounderStory(bio, saved, lang, year, sales);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const focusOwn = useRef(false);
  useEffect(() => {if (focusOwn.current) {textarea.current?.focus(); focusOwn.current = false;}}, [story.mode]);
  function update(next: FounderStory, ownBio = bio ?? "") {
    const current = {...next, lang};
    onChange({bio: current.mode === "lines" ? composeFounderBio(current) : ownBio, bio_story: current});
  }
  return <div className="min-w-0">
    {story.mode === "own" ? <Textarea ref={textarea} aria-label={tr("About this founder", "เกี่ยวกับผู้ก่อตั้งคนนี้")}
      className="founder-own-bio" maxLength={5000} value={bio ?? ""} onChange={e => update(story, e.target.value)} /> :
      <div className="founder-story" role="group" aria-label={tr("About this founder", "เกี่ยวกับผู้ก่อตั้งคนนี้")}>
        {STORY_LINES[lang].map((line, i) => <div key={i}>{line.map((token, j) => typeof token === "string" ? token :
          <StoryPart key={j} value={story.parts[token[0]]} hint={STORY_HINTS[lang][token[0]]}
            onChange={v => update({...story, parts:{...story.parts, [token[0]]:v}})} />)}</div>)}
      </div>}
    <div className="founder-story-footer">
      <span>{story.mode === "own" ? tr("Your own words.", "ข้อความที่ท่านเขียนเอง") : tr("Click a highlighted part to change it.", "คลิกส่วนที่ไฮไลต์เพื่อแก้ไข")}</span>
      <Button variant="link" type="button" className="h-auto p-0 text-[13px] font-semibold text-link"
        onClick={() => {
          if (story.mode === "lines") {focusOwn.current = true; update({...story, mode:"own"}, composeFounderBio(story, lang));}
          else update({...story, mode:"lines"});
        }}>{story.mode === "own" ? tr("Use the sentences instead", "กลับไปใช้ประโยคสำเร็จรูป") : tr("Write it yourself", "เขียนเอง")}</Button>
    </div>
  </div>;
}