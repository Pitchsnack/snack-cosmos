import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminChangeRegistration, getRegReview } from "@/lib/reg-admin.functions";
import { useTranslation } from "@/i18n/language";

/** Admin review: the registration number (locked for users), duplicates on other accounts, and Change registration number. */
export function RegAdminBox({ kind, id, onChanged }: { kind: "seller" | "buyer" | "advisor"; id: string; onChanged?: () => void }) {
  const { t } = useTranslation();
  const get = useServerFn(getRegReview);
  const change = useServerFn(adminChangeRegistration);
  const qc = useQueryClient();
  const key = ["reg-review", kind, id];
  const { data } = useQuery({ queryKey: key, queryFn: () => get({ data: { kind, id } }) });
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return null;
  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await change({ data: { kind, id, reg: val } });
      if (!r.ok) setErr(r.error); else { setOpen(false); setVal(""); await qc.invalidateQueries({ queryKey: key }); onChanged?.(); }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div className="mb-3 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{t("Registration number")}</span>
        <b>{data.reg || t("Not added")}</b>
        {data.locked && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock size={12} />{t("Locked for the user")}</span>}
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setOpen((o) => !o)}>{t("Change registration number")}</Button>
      </div>
      {data.duplicates.map((d) => (
        <p key={d.kind + d.id} className="mt-2 flex items-center gap-1.5 text-amber-700 dark:text-amber-400"><TriangleAlert size={14} />
          {t("Registration number also used by")}{" "}
          <a className="underline" href={d.kind === "seller" ? `/startups/${d.id}` : d.kind === "buyer" ? `/marketplace/investors?open=${d.id}` : `/marketplace/advisors?open=${d.id}`}>{d.ref}</a>
        </p>
      ))}
      {open && (
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <Input aria-label={t("New registration number")} inputMode="numeric" maxLength={13} className="w-48" value={val} onChange={(e) => setVal(e.target.value.replace(/\D/g, "").slice(0, 13))} placeholder={t("13 digits")} />
          <Button size="sm" disabled={busy || val.length !== 13} onClick={() => void save()}>{busy ? t("Saving…") : t("Check and save")}</Button>
          {err && <p className="w-full text-destructive">{t(err)}</p>}
        </div>
      )}
    </div>
  );
}
