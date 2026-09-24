import { EyeOff, Lock, Pencil, Plus, Store, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  decadeOf,
  hiddenStatusOf,
  identityTerms,
  isStartupEntry,
  moneyRange,
  runIdentityCheck,
  staffRange,
  type EntryFacts,
  type HiddenDraft,
  type HiddenProfileRow,
} from "@/lib/hidden-profile";
import { Flagged, Marker, SectorArt } from "./bits";

function fmtDate(s?: string | null) {
  return s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function HiddenProfileTab({
  name,
  companyType,
  row,
  facts,
  showMarkers,
  onEdit,
  onCreate,
  onPublish,
  creating,
  industry,
}: {
  name: string;
  companyType?: string | null;
  row: HiddenProfileRow | null;
  facts: EntryFacts | undefined;
  showMarkers: boolean;
  onEdit: () => void;
  onCreate: () => void;
  onPublish: () => void;
  creating?: boolean;
  industry: string;
}) {
  if (isStartupEntry(companyType)) {
    return <Empty text="Startups can't be listed in the Marketplace yet" />;
  }
  if (!row) {
    return (
      <Empty text={`${name} has no hidden profile yet`}>
        <Button onClick={onCreate} disabled={creating} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="mr-1.5 h-4 w-4" /> Create hidden profile
        </Button>
      </Empty>
    );
  }
  const status = hiddenStatusOf(row, companyType);
  const d = row as HiddenDraft;
  const terms = facts ? identityTerms(facts) : [];
  const findings = facts ? runIdentityCheck(d, facts) : [];
  const f = facts ?? ({} as EntryFacts);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
        {status === "draft" ? (
          <span className="text-muted-foreground"><strong className="text-amber-700 dark:text-amber-400">Draft</strong> · buyers can't see it · SME Takeover · {row.ref_no} · saved {fmtDate(row.updated_at)}</span>
        ) : status === "live_edited" ? (
          <span className="text-muted-foreground"><strong className="text-emerald-700 dark:text-emerald-400">Live</strong> · your changes aren't published yet</span>
        ) : (
          <span className="text-muted-foreground"><strong className="text-emerald-700 dark:text-emerald-400">Live in SME Takeover</strong> · Since {fmtDate(row.published_at)} as {row.live?.code_name ?? row.code_name} · {row.views} views · {row.ndas_approved} NDAs approved</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit hidden profile</Button>
          {status === "draft" ? (
            <Button size="sm" onClick={onPublish} className="bg-accent text-accent-foreground hover:bg-accent/90">Publish</Button>
          ) : (
            <Button size="sm" variant="outline" asChild><Link to="/marketplace"><Store className="mr-1.5 h-3.5 w-3.5" />View in Marketplace</Link></Button>
          )}
        </div>
      </div>

      {findings.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {findings.length} detail{findings.length === 1 ? "" : "s"} could name the company. They are marked below. Edit the hidden profile to fix them before you publish.
        </div>
      )}

      <div className="rounded-xl border border-border p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What buyers see before the NDA</div>
        <div className="flex gap-4">
          <SectorArt art={d.cover_art} className="h-24 w-40 shrink-0 rounded-lg">
            <span className="absolute bottom-1 left-2 text-[10px]">Identity after NDA</span>
          </SectorArt>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded border border-dashed border-border text-muted-foreground"><EyeOff className="h-3.5 w-3.5" /></div>
              <h3 className="text-lg font-semibold"><Flagged text={d.code_name} terms={terms} /></h3>
              <Marker kind="own" show={showMarkers} />
            </div>
            <div className="text-xs text-muted-foreground">{row.ref_no} · {d.region || "—"}</div>
            <p className="text-sm font-medium"><Flagged text={d.headline} terms={terms} /> <Marker kind="shared" show={showMarkers} /></p>
            <p className="text-sm text-muted-foreground"><Flagged text={d.description} terms={terms} /> <Marker kind="own" show={showMarkers} /></p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Fact label="Founded" value={decadeOf(f.year_founded) ?? "—"} m="range" show={showMarkers} />
          <Fact label="Type" value={companyType ?? "—"} m="shared" show={showMarkers} />
          <Fact label="Industry" value={industry} m="shared" show={showMarkers} />
          <Fact label="Region" value={d.region ?? "—"} m="range" show={showMarkers} />
          <Fact label="Employees" value={staffRange(f.company_size) ?? "—"} m="range" show={showMarkers} />
          <Fact label="Revenue" value={moneyRange(f.last_year_revenue) ?? "—"} m="range" show={showMarkers} />
          <Fact label="Website" value="Hidden until NDA" m="nda" show={showMarkers} />
          <Fact label="Email" value="Hidden until NDA" m="nda" show={showMarkers} />
          <Fact label="LinkedIn" value="Hidden until NDA" m="nda" show={showMarkers} />
        </dl>

        <Block title="Highlights" m="shared" show={showMarkers}>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {d.highlights.filter((h) => h.trim()).map((h, i) => <li key={i}><Flagged text={h} terms={terms} /></li>)}
          </ul>
        </Block>
        <Block title="Product overview" m="nda" show={showMarkers}>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="h-3.5 w-3.5" />Shown after the NDA</p>
        </Block>
        <Block title="People" m="own" show={showMarkers}>
          <p className="text-sm text-muted-foreground">{(f.people ?? []).length ? `${f.people!.length} people · names after the NDA` : "Roles only · names after the NDA"}</p>
        </Block>
        <Block title="Customers" m="own" show={showMarkers}>
          <p className="text-sm"><Flagged text={d.customers_summary} terms={terms} /></p>
        </Block>
        <Block title="Deal terms" m="shared" show={showMarkers}>
          <p className="text-sm">
            {d.asking_price == null ? "Price on request" : `฿${d.asking_price}M`} · {d.stake_pct ?? "—"}% · {d.deal_type ?? "—"}
            {d.reason ? <> · <Flagged text={d.reason} terms={terms} /></> : null}
          </p>
        </Block>
      </div>
    </div>
  );
}

function Fact({ label, value, m, show }: { label: string; value: string; m: Parameters<typeof Marker>[0]["kind"]; show: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-medium"><span>{value}</span>{"\u00a0"}<Marker kind={m} show={show} /></dd>
    </div>
  );
}

function Block({ title, m, show, children }: { title: string; m: Parameters<typeof Marker>[0]["kind"]; show: boolean; children: React.ReactNode }) {
  return (
    <section className="mt-4 border-t border-border pt-3">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
        <Marker kind={m} labelled show={show} />
      </div>
      {children}
    </section>
  );
}

function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
      <EyeOff className="h-6 w-6" />
      {text}
      {children}
    </div>
  );
}
