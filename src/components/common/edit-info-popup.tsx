import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useBlocker } from "@tanstack/react-router";
import { X } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/language";
import { cn } from "@/lib/utils";

/**
 * My Company › Edit information pop-up. One shell for the seller, buyer and
 * advisor forms: shade, header, scrolling body and a pinned footer the form
 * portals its own Cancel and Save into. Closing asks first while dirty —
 * Back included, through the router blocker.
 */

export function useTr() {
  const { language } = useTranslation();
  return useCallback((en: string, th: string) => (language === "th" ? th : en), [language]);
}

type Ctx = {
  /** Pinned footer node: forms portal their Cancel / Save here. */
  footer: HTMLElement | null;
  /** Scroll container of the body (section links scroll inside it). */
  body: HTMLElement | null;
  /** Header slot for Edit my startup's main tabs. */
  tabsSlot: HTMLElement | null;
  setDirty: (d: boolean) => void;
  /** Cancel: asks first while dirty. */
  requestClose: () => void;
  /** After Save: closes without asking. */
  done: () => void;
};
const EditInfoCtx = createContext<Ctx | null>(null);
export const useEditInfo = () => useContext(EditInfoCtx);

/** Renders the form's buttons in the pop-up's footer, or in place outside it. */
export function EditInfoFooter({ children, inline }: { children: ReactNode; inline?: ReactNode }) {
  const ctx = useEditInfo();
  if (!ctx) return <>{inline ?? children}</>;
  if (!ctx.footer) return null;
  return createPortal(<div className="flex w-full items-center justify-end gap-2">{children}</div>, ctx.footer);
}

/** Puts the form's main tabs into the pop-up header. */
export function EditInfoTabsSlot({ children }: { children: ReactNode }) {
  const ctx = useEditInfo();
  if (!ctx?.tabsSlot) return null;
  return createPortal(children, ctx.tabsSlot);
}

/* --------------------------- history bookkeeping --------------------------- */

let pushedByPopup = false;
/** Call right before navigating (push) to the ?edit= address. */
export function markEditPushed() { pushedByPopup = true; }
/** Leave the ?edit= address without leaving the pop-up in history. */
export function leaveEditUrl(replaceWithout: () => void) {
  if (pushedByPopup && typeof window !== "undefined") { pushedByPopup = false; window.history.back(); }
  else replaceWithout();
}

/* --------------------------------- shell ---------------------------------- */

export type RoleTone = "seller" | "buyer" | "advisor";
const ROLE_FILL: Record<RoleTone, string> = {
  seller: "bg-[#F6A823] text-[#0E162F]",
  buyer: "bg-[#4338CA] text-white",
  advisor: "bg-[#0F766E] text-white",
};

export function EditInfoPopup({ open, subtitle, companyName, onClosed, children, phoneTabs }: {
  open: boolean;
  subtitle: string;
  companyName: string;
  /** Leaves the ?edit= address (the pop-up then unmounts). */
  onClosed: () => void;
  children: ReactNode;
  phoneTabs?: boolean;
}) {
  const tr = useTr();
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [tabsSlot, setTabsSlot] = useState<HTMLElement | null>(null);
  const dirtyRef = useRef(false);
  const bypass = useRef(false);
  const [confirm, setConfirm] = useState<null | { go: () => void; stay: () => void }>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) opener.current = (document.activeElement as HTMLElement) ?? null;
  }, [open]);

  const leave = useCallback(() => {
    bypass.current = true;
    dirtyRef.current = false;
    onClosed();
    const el = opener.current;
    setTimeout(() => { bypass.current = false; el?.isConnected && el.focus?.(); }, 0);
  }, [onClosed]);

  const requestClose = useCallback(() => {
    if (!dirtyRef.current) return leave();
    setConfirm({ go: leave, stay: () => setConfirm(null) });
  }, [leave]);

  // Back button (or any navigation away from ?edit=) while dirty asks first.
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => open && dirtyRef.current && !bypass.current && !(next.search as { edit?: string } | undefined)?.edit,
    withResolver: true,
    enableBeforeUnload: () => dirtyRef.current,
  }) as unknown as { status: "blocked" | "idle"; proceed: () => void; reset: () => void };
  useEffect(() => {
    if (blocker.status !== "blocked") return;
    setConfirm({
      go: () => { dirtyRef.current = false; bypass.current = true; blocker.proceed(); setTimeout(() => { bypass.current = false; }, 0); },
      stay: () => blocker.reset(),
    });
  }, [blocker.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx: Ctx = {
    footer, body, tabsSlot,
    setDirty: (d) => { dirtyRef.current = d; },
    requestClose,
    done: leave,
  };

  // Body height follows the content: grows/shrinks at the bottom, 200ms.
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    setH(el.offsetHeight);
    return () => ro.disconnect();
  }, [open]);

  return (
    <EditInfoCtx.Provider value={ctx}>
      <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) requestClose(); }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="edit-info-shade fixed inset-0 z-50 bg-[rgba(17,24,39,0.32)] dark:bg-[rgba(0,0,0,0.5)]" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              setTimeout(() => {
                const root = inner.current;
                if (!root || root.contains(document.activeElement)) return;
                root.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]):not([type=file]), textarea, select, [role=combobox]")?.focus({ preventScroll: true });
              }, 60);
            }}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className={cn(
              "edit-info-pop fixed z-50 flex flex-col bg-card text-foreground outline-none",
              "left-1/2 top-[max(24px,10vh)] w-[min(960px,calc(100vw-48px))] -translate-x-1/2 rounded-[16px] shadow-[0_24px_64px_rgba(16,24,40,0.24)]",
              "max-h-[calc(100vh-max(24px,10vh)-24px)]",
              "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-10 max-sm:w-full max-sm:max-h-none max-sm:translate-x-0 max-sm:left-0 max-sm:rounded-b-none max-sm:shadow-[0_-12px_40px_rgba(16,24,40,0.2)]",
            )}
            style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
          >
            <div className={cn("flex shrink-0 items-center gap-4 border-b border-[#EEF0F3] px-6 py-[18px] dark:border-border", phoneTabs && "max-sm:flex-wrap")}>
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-[18px] font-semibold leading-tight text-[#151A28] dark:text-foreground">{tr("Edit information", "แก้ไขข้อมูล")}</DialogPrimitive.Title>
                <div className="mt-[3px] text-[13px] text-[#6B7280] dark:text-muted-foreground">{subtitle}</div>
              </div>
              <div ref={setTabsSlot} className={cn("shrink-0 empty:hidden", phoneTabs && "max-sm:order-3 max-sm:mt-4 max-sm:w-full")} />
              <button type="button" aria-label={tr("Close", "ปิด")} onClick={requestClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-[#434A5C] hover:bg-[#F2F4F7] dark:text-muted-foreground dark:hover:bg-muted">
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
            <div ref={setBody} data-edit-info-body
              className="min-h-0 shrink overflow-y-auto overscroll-contain transition-[height] duration-200 ease-out motion-reduce:transition-none max-sm:!h-auto max-sm:flex-1"
              style={h != null ? { height: h } : undefined}>
              <div ref={inner} className="px-6 pb-[26px] pt-0">{children}</div>
            </div>
            <div ref={setFooter} className="flex shrink-0 items-center justify-end gap-2 border-t border-[#EEF0F3] px-6 py-[14px] dark:border-border" />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) { confirm?.stay(); setConfirm(null); } }}>
        <AlertDialogContent className="z-[60]">
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Discard your changes?", "ยกเลิกการแก้ไขหรือไม่")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr(`Your changes to ${companyName || "this company"} aren't saved yet.`, `การแก้ไขข้อมูลของ ${companyName || "บริษัท"} ยังไม่ได้บันทึก`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button autoFocus variant="outline" onClick={() => { confirm?.stay(); setConfirm(null); }}>{tr("Keep editing", "แก้ไขต่อ")}</Button>
            <Button variant="destructive" onClick={() => { const c = confirm; setConfirm(null); c?.go(); }}>{tr("Discard", "ไม่บันทึก")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EditInfoCtx.Provider>
  );
}

/* ------------------------------ tabs pieces ------------------------------- */

export function MissingCount({ n, className }: { n: number; className?: string }) {
  const tr = useTr();
  if (!n) return null;
  return (
    <span aria-label={tr(`${n} missing`, `ขาด ${n} รายการ`)}
      className={cn("inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FEE2E2] px-[5px] text-[11px] font-bold leading-none text-[#B91C1C]", className)}>
      <span aria-hidden>{n}</span>
    </span>
  );
}

/** Arrow / Home / End keys for a tablist; each tab opens as focus moves. */
function onTabKeys<T extends string>(e: RKeyboardEvent, keys: T[], cur: T, open: (k: T) => void) {
  const i = keys.indexOf(cur);
  let n = -1;
  if (e.key === "ArrowRight") n = (i + 1) % keys.length;
  else if (e.key === "ArrowLeft") n = (i - 1 + keys.length) % keys.length;
  else if (e.key === "Home") n = 0;
  else if (e.key === "End") n = keys.length - 1;
  if (n < 0) return;
  e.preventDefault();
  open(keys[n]);
  const list = e.currentTarget as HTMLElement;
  requestAnimationFrame(() => list.querySelector<HTMLElement>(`[data-tab="${keys[n]}"]`)?.focus());
}

export function MainTabs<T extends string>({ tabs, value, onChange, tone, idBase }: {
  tabs: { key: T; label: string; icon: ReactNode; count: number }[];
  value: T; onChange: (k: T) => void; tone: RoleTone; idBase: string;
}) {
  const tr = useTr();
  return (
    <div role="tablist" aria-label={tr("Views", "มุมมอง")} onKeyDown={(e) => onTabKeys(e, tabs.map((t) => t.key), value, onChange)}
      className="flex gap-1 rounded-[12px] bg-[#F1F2F5] p-1 dark:bg-muted">
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button key={t.key} type="button" role="tab" data-tab={t.key} id={`${idBase}-main-${t.key}`} aria-selected={on} tabIndex={on ? 0 : -1}
            aria-controls={`${idBase}-main-panel`} onClick={() => onChange(t.key)}
            className={cn("inline-flex h-9 items-center justify-center rounded-[9px] px-[14px] text-[14px] font-semibold max-sm:flex-1 max-sm:px-2 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[2]",
              on ? ROLE_FILL[tone] : "text-[#6A7181] hover:text-[#151A28] dark:text-muted-foreground dark:hover:text-foreground")}>
            {t.icon}<span className="ml-[7px] whitespace-nowrap">{t.label}</span>
            {t.count > 0 && <MissingCount n={t.count} className="ml-[9px]" />}
          </button>
        );
      })}
    </div>
  );
}

export function TabRow<T extends string>({ tabs, value, onChange, label, idBase, extra }: {
  tabs: { key: T; label: string; count?: number; icon?: ReactNode }[];
  value: T; onChange: (k: T) => void; label: string; idBase: string; extra?: ReactNode;
}) {
  return (
    <div data-sticky-tabs className="sticky top-0 z-10 -mx-6 mb-5 bg-card px-6">
      <div role="tablist" aria-label={label} onKeyDown={(e) => onTabKeys(e, tabs.map((t) => t.key), value, onChange)}
        className="flex gap-[22px] overflow-x-auto border-b border-[#E6E8EC] [scrollbar-width:none] max-sm:gap-[18px] dark:border-border">
        {tabs.map((t) => {
          const on = t.key === value;
          return (
            <button key={t.key} type="button" role="tab" data-tab={t.key} id={`${idBase}-tab-${t.key}`} aria-selected={on} tabIndex={on ? 0 : -1}
              aria-controls={`${idBase}-panel`} onClick={() => onChange(t.key)}
              className={cn("-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-[14px]",
                on ? "border-[#151A28] font-semibold text-[#151A28] dark:border-foreground dark:text-foreground" : "border-transparent font-medium text-[#6A7181] dark:text-muted-foreground")}>
              {t.label}{t.icon}
              {!!t.count && <MissingCount n={t.count} />}
            </button>
          );
        })}
        {extra}
      </div>
    </div>
  );
}

/** Each tab's first row: its heading on the left, the view's button on the right. */
export function TabHead({ title, children, line }: { title: string; children?: ReactNode; line?: ReactNode }) {
  return (
    <div className="mb-[10px]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-[10px]">
        <h3 className="text-[15px] font-semibold text-[#151A28] dark:text-foreground">{title}</h3>
        {children}
      </div>
      {line}
    </div>
  );
}
