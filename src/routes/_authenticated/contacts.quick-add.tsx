import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  X,
  Camera,
  Upload,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
  ScanLine,
  Plus,
  Mail,
  Phone,
  Linkedin,
  Globe,
  Sparkles,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  quickAddAdapter,
  SCAN_STAGES,
  type DuplicateMatch,
  type ExtractedContact,
  type FieldConfidence,
  type ScanStage,
} from "@/lib/contacts/quick-add-adapter";

export const Route = createFileRoute("/_authenticated/contacts/quick-add")({
  head: () => ({
    meta: [
      { title: "Quick Add Contact — SnackPortal2" },
      {
        name: "description",
        content:
          "Scan business cards to add contacts instantly. Capture, extract, review, and save — mobile-first and event-ready.",
      },
      { property: "og:title", content: "Quick Add Contact — SnackPortal2" },
      {
        property: "og:description",
        content:
          "Capture, extract, and save contacts from business cards in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuickAddContactPage,
});

type Step = "front" | "back" | "scan" | "review" | "saved";

const STEP_ORDER: Step[] = ["front", "back", "scan", "review", "saved"];
const STEP_LABEL: Record<Step, string> = {
  front: "Front",
  back: "Back",
  scan: "Scan",
  review: "Review",
  saved: "Save",
};

interface StageState {
  status: "pending" | "in_progress" | "done" | "review";
}

function QuickAddContactPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("front");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [backSkipped, setBackSkipped] = useState(false);

  const [contact, setContact] = useState<ExtractedContact>({
    contactType: "Personal Contact",
  });
  const [confidence, setConfidence] = useState<
    Partial<Record<keyof ExtractedContact, FieldConfidence>>
  >({});
  const [event, setEvent] = useState<string>("");
  const [keepImages, setKeepImages] = useState(true);

  const [stages, setStages] = useState<Record<ScanStage, StageState>>({
    detect_name_company: { status: "pending" },
    read_phone_email: { status: "pending" },
    identify_website_social: { status: "pending" },
    read_address: { status: "pending" },
    finalise: { status: "pending" },
  });

  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [showDup, setShowDup] = useState(false);
  const [unclear, setUnclear] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const scanAbort = useRef<AbortController | null>(null);

  // Object URL cleanup
  useEffect(() => {
    return () => {
      if (frontUrl) URL.revokeObjectURL(frontUrl);
      if (backUrl) URL.revokeObjectURL(backUrl);
    };
  }, [frontUrl, backUrl]);

  const hasUnsaved = useMemo(
    () => !!frontFile || !!backFile || Object.keys(contact).length > 1,
    [frontFile, backFile, contact],
  );

  const handleClose = () => {
    if (hasUnsaved && step !== "saved") setCloseConfirm(true);
    else navigate({ to: "/contacts" });
  };

  const handleBack = () => {
    if (step === "front") return navigate({ to: "/contacts" });
    const idx = STEP_ORDER.indexOf(step);
    setStep(STEP_ORDER[Math.max(0, idx - 1)]);
  };

  const onPickFront = (file: File) => {
    setFrontFile(file);
    if (frontUrl) URL.revokeObjectURL(frontUrl);
    setFrontUrl(URL.createObjectURL(file));
    setUnclear(false);
  };
  const onPickBack = (file: File) => {
    setBackFile(file);
    if (backUrl) URL.revokeObjectURL(backUrl);
    setBackUrl(URL.createObjectURL(file));
    setBackSkipped(false);
  };

  const startScan = useCallback(async () => {
    if (!frontFile) return;
    setStep("scan");
    setStages({
      detect_name_company: { status: "pending" },
      read_phone_email: { status: "pending" },
      identify_website_social: { status: "pending" },
      read_address: { status: "pending" },
      finalise: { status: "pending" },
    });
    setContact((c) => ({ contactType: c.contactType ?? "Personal Contact" }));
    setConfidence({});

    const ctrl = new AbortController();
    scanAbort.current = ctrl;
    try {
      await quickAddAdapter.extractFromCard({
        frontFile,
        backFile,
        signal: ctrl.signal,
        onProgress: (evt) => {
          setStages((prev) => ({
            ...prev,
            [evt.stage]: { status: evt.status },
          }));
          if (evt.partial) setContact((c) => ({ ...c, ...evt.partial }));
          if (evt.partialConfidence)
            setConfidence((c) => ({ ...c, ...evt.partialConfidence }));
          // Progressive: move to review as soon as first stage returns data
          setStep((s) => (s === "scan" && evt.partial ? "review" : s));
        },
      });
    } catch (e) {
      if ((e as Error).message !== "aborted") {
        setUnclear(true);
        setStep("front");
      }
    }
  }, [frontFile, backFile]);

  const proceedToScan = () => {
    if (!frontFile) return;
    startScan();
  };

  const skipBack = () => {
    setBackSkipped(true);
    setBackFile(null);
    if (backUrl) {
      URL.revokeObjectURL(backUrl);
      setBackUrl(null);
    }
    startScan();
  };

  const resetForNext = (preserveEvent = true) => {
    scanAbort.current?.abort();
    setFrontFile(null);
    setBackFile(null);
    if (frontUrl) URL.revokeObjectURL(frontUrl);
    if (backUrl) URL.revokeObjectURL(backUrl);
    setFrontUrl(null);
    setBackUrl(null);
    setBackSkipped(false);
    setContact({ contactType: "Personal Contact" });
    setConfidence({});
    setStages({
      detect_name_company: { status: "pending" },
      read_phone_email: { status: "pending" },
      identify_website_social: { status: "pending" },
      read_address: { status: "pending" },
      finalise: { status: "pending" },
    });
    setDuplicates([]);
    setShowDup(false);
    setSavedId(null);
    if (!preserveEvent) setEvent("");
    setStep("front");
  };

  const doSave = async (asNew = false) => {
    setSaving(true);
    try {
      if (!asNew) {
        const dups = await quickAddAdapter.findDuplicates(contact);
        if (dups.length) {
          setDuplicates(dups);
          setShowDup(true);
          setSaving(false);
          return;
        }
      }
      const res = await quickAddAdapter.saveContact({
        contact,
        event,
        keepImages,
        frontFile,
        backFile,
      });
      setSavedId(res.id);
      setStep("saved");
      toast.success("Contact saved");
    } catch {
      toast.error("Could not save contact");
    } finally {
      setSaving(false);
    }
  };

  const saveAndScanNext = async () => {
    await doSave();
    if (savedId || step === "saved") {
      resetForNext(true);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">
              Quick Add Contact
            </h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Capture business cards. Extract details instantly. Save contacts
              in seconds.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="mx-auto max-w-5xl px-3 pb-3 sm:px-6">
          <StepProgress step={step} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
        {/* Front step */}
        {step === "front" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <CaptureCard
              title="Front of Card"
              subtitle="Position the card within the frame."
              url={frontUrl}
              onPick={onPickFront}
              onRetake={() => {
                setFrontFile(null);
                if (frontUrl) URL.revokeObjectURL(frontUrl);
                setFrontUrl(null);
              }}
              required
              unclear={unclear}
            />
            <div className="hidden lg:block">
              <TipsCard />
            </div>
            <div className="lg:col-span-2">
              <StickyActions>
                <Button
                  className="w-full sm:w-auto"
                  disabled={!frontFile}
                  onClick={() => setStep("back")}
                >
                  Continue
                </Button>
              </StickyActions>
            </div>
          </div>
        )}

        {/* Back step */}
        {step === "back" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <CaptureCard
              title="Back of Card"
              optional
              subtitle="Capture additional details on the back."
              url={backUrl}
              onPick={onPickBack}
              onRetake={() => {
                setBackFile(null);
                if (backUrl) URL.revokeObjectURL(backUrl);
                setBackUrl(null);
              }}
            />
            <div className="hidden lg:block">
              <TipsCard />
            </div>
            <div className="lg:col-span-2">
              <StickyActions>
                <Button variant="outline" onClick={skipBack}>
                  Skip Back
                </Button>
                <Button onClick={proceedToScan} disabled={!frontFile}>
                  Scan Card
                </Button>
              </StickyActions>
            </div>
          </div>
        )}

        {/* Scan step (usually flashes; page auto-advances to review) */}
        {step === "scan" && (
          <ScanPanel stages={stages} />
        )}

        {/* Review step */}
        {step === "review" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="space-y-4">
              <CardPreview label="Front" url={frontUrl} />
              {(backUrl || backSkipped) && (
                <CardPreview
                  label="Back"
                  url={backUrl}
                  placeholder={backSkipped ? "Skipped" : undefined}
                />
              )}
              <ScanPanel stages={stages} compact />
            </div>
            <ReviewForm
              contact={contact}
              setContact={setContact}
              confidence={confidence}
              event={event}
              setEvent={setEvent}
              keepImages={keepImages}
              setKeepImages={setKeepImages}
            />
            <div className="lg:col-span-2">
              <StickyActions>
                <Button
                  variant="outline"
                  onClick={() => doSave()}
                  disabled={saving}
                >
                  Save Contact
                </Button>
                <Button onClick={saveAndScanNext} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  Save &amp; Scan Next
                </Button>
              </StickyActions>
            </div>
          </div>
        )}

        {/* Saved step */}
        {step === "saved" && (
          <SavedPanel
            contact={contact}
            onScanNext={() => resetForNext(true)}
          />
        )}
      </main>

      {/* Duplicate modal */}
      <Dialog open={showDup} onOpenChange={setShowDup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Possible existing contact found
            </DialogTitle>
            <DialogDescription>
              We found contacts that may match this person.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {duplicates.map((d) => (
              <div
                key={d.id}
                className="rounded-md border border-border p-3 text-sm"
              >
                <div className="font-medium">{d.name}</div>
                {d.jobTitle && (
                  <div className="text-muted-foreground">{d.jobTitle}</div>
                )}
                {d.company && (
                  <div className="text-muted-foreground">{d.company}</div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  {d.email} {d.phone && `• ${d.phone}`}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" asChild>
              <Link to="/contacts">View Existing Contact</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowDup(false);
                toast.success("Existing contact updated");
                resetForNext(true);
              }}
            >
              Update Existing Contact
            </Button>
            <Button
              onClick={() => {
                setShowDup(false);
                doSave(true);
              }}
            >
              Save as New Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close-confirm modal */}
      <Dialog open={closeConfirm} onOpenChange={setCloseConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this contact?</DialogTitle>
            <DialogDescription>
              You have unsaved information. If you leave now, it will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseConfirm(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => navigate({ to: "/contacts" })}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function StepProgress({ step }: { step: Step }) {
  const currentIdx = STEP_ORDER.indexOf(step);
  return (
    <ol className="flex items-center gap-1.5" aria-label="Progress">
      {STEP_ORDER.map((s, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        return (
          <li key={s} className="flex flex-1 items-center gap-1.5">
            <div
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
                done && "bg-primary text-primary-foreground",
                current && "bg-primary/15 text-primary ring-2 ring-primary",
                !done && !current && "bg-muted text-muted-foreground",
              )}
              aria-current={current ? "step" : undefined}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={cn(
                "hidden text-xs sm:inline",
                current ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {STEP_LABEL[s]}
            </span>
            {i < STEP_ORDER.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CaptureCard({
  title,
  subtitle,
  optional,
  url,
  onPick,
  onRetake,
  required,
  unclear,
}: {
  title: string;
  subtitle: string;
  optional?: boolean;
  url: string | null;
  onPick: (f: File) => void;
  onRetake: () => void;
  required?: boolean;
  unclear?: boolean;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const upRef = useRef<HTMLInputElement>(null);
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
        {optional && (
          <Badge variant="secondary" className="text-[10px]">
            Optional
          </Badge>
        )}
        {required && (
          <Badge className="bg-primary/10 text-primary text-[10px]">
            Required
          </Badge>
        )}
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{subtitle}</p>

      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30">
        {url ? (
          <img
            src={url}
            alt={`${title} preview`}
            className="h-full w-full object-contain"
          />
        ) : (
          <>
            <CornerGuides />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ScanLine className="h-10 w-10 opacity-40" />
              <span className="text-xs">
                Place the card within the frame
              </span>
            </div>
          </>
        )}
      </div>

      {unclear && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>
            The card could not be read clearly. Retake the photo or enter the
            contact details manually.
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
        <input
          ref={upRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
        {url ? (
          <>
            <Button variant="outline" onClick={onRetake}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retake
            </Button>
            <Button variant="outline" onClick={() => upRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Replace
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => camRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
            <Button variant="outline" onClick={() => upRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </>
        )}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Place the card on a flat surface in a well-lit area.
      </p>
    </section>
  );
}

function CornerGuides() {
  const cls =
    "absolute h-6 w-6 border-primary/70";
  return (
    <>
      <div className={cn(cls, "left-3 top-3 border-l-2 border-t-2 rounded-tl-md")} />
      <div className={cn(cls, "right-3 top-3 border-r-2 border-t-2 rounded-tr-md")} />
      <div className={cn(cls, "bottom-3 left-3 border-b-2 border-l-2 rounded-bl-md")} />
      <div className={cn(cls, "bottom-3 right-3 border-b-2 border-r-2 rounded-br-md")} />
    </>
  );
}

function TipsCard() {
  return (
    <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold">Tips for best results</h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>• Use good lighting</li>
        <li>• Avoid shadows and glare</li>
        <li>• Place card on a flat surface</li>
        <li>• Hold camera steady</li>
      </ul>
      <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        The back of the card is optional. You can always add it later from the
        contact profile.
      </div>
    </aside>
  );
}

function ScanPanel({
  stages,
  compact,
}: {
  stages: Record<ScanStage, StageState>;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm",
        compact ? "" : "mx-auto max-w-md text-center",
      )}
    >
      {!compact && (
        <>
          <h2 className="text-lg font-semibold">Scanning your card</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Please wait while we extract the details.
          </p>
          <div className="my-6 flex justify-center">
            <div className="relative h-24 w-40 rounded-lg border-2 border-dashed border-border">
              <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-primary/70" />
              <CornerGuides />
            </div>
          </div>
        </>
      )}
      <ul className="space-y-2 text-left">
        {SCAN_STAGES.map((s) => {
          const st = stages[s.key].status;
          return (
            <li
              key={s.key}
              className="flex items-center justify-between text-sm"
            >
              <span
                className={cn(
                  st === "pending" && "text-muted-foreground",
                  st === "in_progress" && "text-foreground",
                  st === "done" && "text-foreground",
                  st === "review" && "text-amber-600 dark:text-amber-400",
                )}
              >
                {s.label}
              </span>
              <StageIcon status={st} />
            </li>
          );
        })}
      </ul>
      {!compact && (
        <p className="mt-5 text-xs text-muted-foreground">
          You can continue editing while we finish scanning.
        </p>
      )}
    </section>
  );
}

function StageIcon({ status }: { status: StageState["status"] }) {
  if (status === "done")
    return <Check className="h-4 w-4 text-emerald-600" aria-label="Done" />;
  if (status === "in_progress")
    return (
      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="In progress" />
    );
  if (status === "review")
    return (
      <AlertCircle className="h-4 w-4 text-amber-500" aria-label="Needs review" />
    );
  return (
    <span
      className="h-3 w-3 rounded-full border border-border bg-muted"
      aria-label="Pending"
    />
  );
}

function CardPreview({
  label,
  url,
  placeholder,
}: {
  label: string;
  url: string | null;
  placeholder?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        {placeholder && <Badge variant="secondary">{placeholder}</Badge>}
      </div>
      <div className="aspect-[16/10] overflow-hidden rounded-md border border-border bg-muted/30">
        {url ? (
          <img src={url} alt={`${label} card`} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-40" />
          </div>
        )}
      </div>
    </div>
  );
}

function ConfBadge({ level }: { level?: FieldConfidence }) {
  if (!level || level === "missing") return null;
  if (level === "high")
    return (
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
        aria-label="High confidence"
        title="High confidence"
      >
        <Check className="h-3 w-3" />
      </span>
    );
  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/15 text-amber-600"
      aria-label="Needs review"
      title="Needs review"
    >
      <AlertCircle className="h-3 w-3" />
    </span>
  );
}

function FieldRow({
  label,
  children,
  conf,
}: {
  label: string;
  children: React.ReactNode;
  conf?: FieldConfidence;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        <ConfBadge level={conf} />
      </div>
      {children}
    </div>
  );
}

function ReviewForm({
  contact,
  setContact,
  confidence,
  event,
  setEvent,
  keepImages,
  setKeepImages,
}: {
  contact: ExtractedContact;
  setContact: React.Dispatch<React.SetStateAction<ExtractedContact>>;
  confidence: Partial<Record<keyof ExtractedContact, FieldConfidence>>;
  event: string;
  setEvent: (v: string) => void;
  keepImages: boolean;
  setKeepImages: (v: boolean) => void;
}) {
  const update = <K extends keyof ExtractedContact>(
    k: K,
    v: ExtractedContact[K],
  ) => setContact((c) => ({ ...c, [k]: v }));

  const [tagDraft, setTagDraft] = useState("");
  const [industryDraft, setIndustryDraft] = useState("");

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <FieldRow label="Event / Contact Group">
        <Input
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="e.g. Tech Startup Expo 2026"
        />
      </FieldRow>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Contact Details</h3>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <Sparkles className="mr-1 h-3 w-3" /> Auto-filled
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldRow label="First Name" conf={confidence.firstName}>
            <Input
              value={contact.firstName ?? ""}
              onChange={(e) => update("firstName", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Last Name" conf={confidence.lastName}>
            <Input
              value={contact.lastName ?? ""}
              onChange={(e) => update("lastName", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Job Title" conf={confidence.jobTitle}>
            <Input
              value={contact.jobTitle ?? ""}
              onChange={(e) => update("jobTitle", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Department">
            <Input
              value={contact.department ?? ""}
              onChange={(e) => update("department", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Company" conf={confidence.companyName}>
            <Input
              value={contact.companyName ?? ""}
              onChange={(e) => update("companyName", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Company Website" conf={confidence.companyWebsite}>
            <Input
              value={contact.companyWebsite ?? ""}
              onChange={(e) => update("companyWebsite", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Work Email" conf={confidence.workEmail}>
            <Input
              type="email"
              value={contact.workEmail ?? ""}
              onChange={(e) => update("workEmail", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Mobile" conf={confidence.mobile}>
            <Input
              value={contact.mobile ?? ""}
              onChange={(e) => update("mobile", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Office Number">
            <Input
              value={contact.office ?? ""}
              onChange={(e) => update("office", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Personal LinkedIn" conf={confidence.personalLinkedin}>
            <Input
              value={contact.personalLinkedin ?? ""}
              onChange={(e) => update("personalLinkedin", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Country" conf={confidence.country}>
            <Input
              value={contact.country ?? ""}
              onChange={(e) => update("country", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="City" conf={confidence.city}>
            <Input
              value={contact.city ?? ""}
              onChange={(e) => update("city", e.target.value)}
            />
          </FieldRow>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldRow label="Contact Type" conf={confidence.contactType}>
          <Select
            value={contact.contactType ?? "Personal Contact"}
            onValueChange={(v) =>
              update("contactType", v as ExtractedContact["contactType"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Personal Contact">Personal Contact</SelectItem>
              <SelectItem value="PitchSnack Contact">
                PitchSnack Contact
              </SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Relationship" conf={confidence.relationship}>
          <Select
            value={contact.relationship ?? ""}
            onValueChange={(v) => update("relationship", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select relationship" />
            </SelectTrigger>
            <SelectContent>
              {[
                "Startup",
                "Investor",
                "Master Agent",
                "Partner",
                "Service Provider",
                "Client",
                "Other",
              ].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      </div>

      <FieldRow label="Industry" conf={confidence.industry}>
        <ChipEditor
          values={contact.industry ?? []}
          onChange={(v) => update("industry", v)}
          draft={industryDraft}
          setDraft={setIndustryDraft}
          placeholder="Add industry"
        />
      </FieldRow>

      <FieldRow label="Tags">
        <ChipEditor
          values={contact.tags ?? []}
          onChange={(v) => update("tags", v)}
          draft={tagDraft}
          setDraft={setTagDraft}
          placeholder="Add tag"
        />
      </FieldRow>

      <FieldRow label="Notes">
        <Textarea
          rows={3}
          value={contact.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Met at Tech Startup Expo 2026 …"
        />
      </FieldRow>

      <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div>
          <div className="text-sm font-medium">
            Keep business card images with this contact
          </div>
          <p className="text-xs text-muted-foreground">
            Images are stored securely with the contact. Turn off to discard
            after extraction.
          </p>
        </div>
        <Switch checked={keepImages} onCheckedChange={setKeepImages} />
      </div>
    </section>
  );
}

function ChipEditor({
  values,
  onChange,
  draft,
  setDraft,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  draft: string;
  setDraft: (v: string) => void;
  placeholder: string;
}) {
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-1.5">
      {values.map((v) => (
        <Badge
          key={v}
          variant="secondary"
          className="gap-1 rounded-full px-2 py-0.5 text-xs"
        >
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="ml-0.5 rounded-full hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className="min-w-[8ch] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
      />
      {draft && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={add}
          className="h-6 px-2"
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function SavedPanel({
  contact,
  onScanNext,
}: {
  contact: ExtractedContact;
  onScanNext: () => void;
}) {
  const initials = ((contact.firstName?.[0] ?? "") + (contact.lastName?.[0] ?? ""))
    .toUpperCase() || "?";
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
        <Check className="h-8 w-8" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Contact saved</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {contact.fullName ??
          [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
          "New contact"}{" "}
        has been added to your contacts.
      </p>

      <div className="mt-5 rounded-xl border border-border bg-card p-4 text-left shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {contact.fullName ??
                [contact.firstName, contact.lastName].filter(Boolean).join(" ")}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {contact.jobTitle}
              {contact.companyName ? ` • ${contact.companyName}` : ""}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-around border-t border-border pt-3 text-muted-foreground">
          <IconLink icon={Phone} href={contact.mobile ? `tel:${contact.mobile}` : undefined} label="Call" />
          <IconLink icon={Mail} href={contact.workEmail ? `mailto:${contact.workEmail}` : undefined} label="Email" />
          <IconLink icon={Linkedin} href={contact.personalLinkedin ? `https://${contact.personalLinkedin}` : undefined} label="LinkedIn" />
          <IconLink icon={Globe} href={contact.companyWebsite ? `https://${contact.companyWebsite}` : undefined} label="Website" />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={onScanNext}>
          <Camera className="mr-2 h-4 w-4" />
          Save &amp; Scan Next
        </Button>
        <Button variant="outline" asChild>
          <Link to="/contacts">Back to Contacts</Link>
        </Button>
      </div>
    </div>
  );
}

function IconLink({
  icon: Icon,
  href,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  label: string;
}) {
  const disabled = !href;
  const cls = cn(
    "grid h-9 w-9 place-items-center rounded-full",
    disabled ? "bg-muted text-muted-foreground/50" : "bg-primary/10 text-primary hover:bg-primary/20",
  );
  if (disabled)
    return (
      <span className={cls} aria-label={`${label} unavailable`}>
        <Icon className="h-4 w-4" />
      </span>
    );
  return (
    <a href={href} className={cls} aria-label={label} target="_blank" rel="noreferrer">
      <Icon className="h-4 w-4" />
    </a>
  );
}

function StickyActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-4 flex flex-col-reverse gap-2 border-t border-border bg-card/95 p-3 backdrop-blur sm:static sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
      {children}
    </div>
  );
}
