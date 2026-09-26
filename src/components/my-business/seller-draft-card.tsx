import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileClock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionContext } from "@/hooks/use-session-context";
import { answeredCount, clearDraft, firstOpenStep, loadDraft, WIZARD_QUESTION_TITLES, type SellerDraft } from "@/lib/seller-wizard";

/** Unfinished "Add my business" wizard, shown as a Draft in My Business. */
export function SellerDraftCard() {
  const { data } = useSessionContext();
  const userId = data?.user?.id as string | undefined;
  const [draft, setDraft] = useState<SellerDraft | null>(null);
  useEffect(() => {
    const read = () => setDraft(loadDraft(userId));
    read();
    window.addEventListener("ps-seller-draft", read);
    return () => window.removeEventListener("ps-seller-draft", read);
  }, [userId]);
  if (!draft || !userId) return null;
  const n = answeredCount(draft);
  const next = firstOpenStep(draft);
  const resumeAt = next >= 9 ? "Review" : WIZARD_QUESTION_TITLES[next];
  return (
    <div className="flex items-center gap-4 rounded-lg border border-dashed border-border bg-card p-4 shadow-card">
      <FileClock className="h-6 w-6 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{draft.name.trim() || "Untitled business"}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Draft</span>
        </div>
        <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-muted">
          <i className="block h-full bg-primary" style={{ width: `${Math.round((n / 9) * 100)}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{n} of 9 questions answered · resumes at: {resumeAt}</p>
      </div>
      <Button asChild size="sm"><Link to="/my-startups/new">Continue setup</Link></Button>
      <Button size="sm" variant="ghost" aria-label="Discard draft" onClick={() => clearDraft(userId)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
