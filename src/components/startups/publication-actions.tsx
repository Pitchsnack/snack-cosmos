import { useState } from "react";
import { Globe, EyeOff, Loader2, Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PublicationBadge } from "@/components/startups/publication-badge";
import { usePublication } from "@/hooks/use-publication";
import { toDirectoryProjection } from "@/lib/publication";

type StartupLike = Parameters<typeof toDirectoryProjection>[0] & {
  tenant_id?: string | null;
};

/**
 * Publish / Unpublish to Startup Directory.
 * Rendered only inside My Startups surfaces. Uses the existing permission
 * decision passed in by the caller — no RBAC, ownership or guard changes.
 */
export function PublicationActions({
  startup,
  canPublish,
}: {
  startup: StartupLike;
  canPublish: boolean;
}) {
  const pub = usePublication(startup.id);
  const [confirm, setConfirm] = useState<null | "publish" | "unpublish">(null);

  const published = pub.status === "published";

  const submit = async () => {
    const ok = published
      ? await pub.unpublish()
      : await pub.publish(toDirectoryProjection(startup), startup.tenant_id ?? null);
    if (ok) setConfirm(null);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Directory publication
          </span>
          <PublicationBadge status={pub.status} />
          {isPublicationPreview && (
            <span
              title={PREVIEW_DISCLAIMER}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
            >
              <FlaskConical className="h-3 w-3" aria-hidden="true" />
              Preview mode
            </span>
          )}
        </div>
        {canPublish && (
          <Button
            size="sm"
            variant={published ? "outline" : "default"}
            disabled={pub.isPending || !pub.canMutate}
            aria-busy={pub.isPending}
            onClick={() => setConfirm(published ? "unpublish" : "publish")}
            className="gap-1.5"
          >
            {pub.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : published ? (
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {published ? "Unpublish from Startup Directory" : "Publish to Startup Directory"}
          </Button>
        )}
      </div>

      {pub.previewNotice && (
        <p role="status" className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {pub.previewNotice}
        </p>
      )}
      {!pub.canMutate && pub.unavailableReason && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {pub.unavailableReason}
        </p>
      )}
      {pub.error && (
        <div
          role="alert"
          className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5"
        >
          <p className="text-[11px] text-destructive">{pub.error}</p>
          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={submit} disabled={pub.isPending}>
            Try Again
          </Button>
        </div>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "unpublish"
                ? "Unpublish from Startup Directory"
                : "Publish to Startup Directory"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {confirm === "unpublish" ? (
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  <li>The startup will be removed from the Startup Directory.</li>
                  <li>The startup remains in My Startups.</li>
                </ul>
              ) : (
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  <li>The startup remains in My Startups.</li>
                  <li>Only approved public information appears in the Startup Directory.</li>
                  <li>Private information stays hidden and is not sent.</li>
                  <li>Publication can be withdrawn later.</li>
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pub.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pub.isPending}
              onClick={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {pub.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {confirm === "unpublish" ? "Unpublish" : "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Small status-only badge bound to the publication adapter. */
export function PublicationStatusBadge({
  startupRef,
  className,
}: {
  startupRef: string;
  className?: string;
}) {
  const pub = usePublication(startupRef);
  return <PublicationBadge status={pub.status} className={className} />;
}
