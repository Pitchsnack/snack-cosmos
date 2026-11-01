import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTr } from "./edit-info-popup";
import { cn } from "@/lib/utils";

export function SuggestLink({ onClick }: { onClick: () => void }) {
  const L = useTr();
  return <Button type="button" variant="unstyled" size="unstyled" onClick={onClick} className="listing-suggest"><Sparkles aria-hidden />{L("Suggest", "แนะนำ")}</Button>;
}

export function FieldRow({ label, missing, right, suggest, children, htmlFor, after, source }: {
  label: ReactNode; missing?: boolean; right?: ReactNode; suggest?: () => void; children: ReactNode; htmlFor?: string; after?: ReactNode; source?: ReactNode;
}) {
  const L = useTr();
  return <div className="listing-editor-field"><div className="listing-editor-label-row"><div className="listing-editor-label"><label htmlFor={htmlFor} className={cn(missing && "text-destructive")}>{label}</label>{after}{missing && <span className="text-destructive">{L("· Missing", "· ยังขาด")}</span>}</div><div className="listing-editor-label-actions">{source}{right != null && <span className="listing-editor-count">{right}</span>}{suggest && <SuggestLink onClick={suggest} />}</div></div>{children}</div>;
}

export function AutoFillTabButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const L = useTr();
  return <Button type="button" variant="outline" disabled={disabled} onClick={onClick} className="listing-autofill"><Sparkles aria-hidden />{L("Auto-fill this tab", "เติมข้อมูลแท็บนี้อัตโนมัติ")}</Button>;
}

export function ListingEditorTitle({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="listing-editor-title"><h3>{title}</h3>{children}</div>;
}