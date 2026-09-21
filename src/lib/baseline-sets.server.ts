/**
 * Generation of sector Baseline peer sets.
 *
 * A baseline set is a sector-wide peer set (business_model = null,
 * is_baseline = true) holding EVERY SET-listed company in that sector.
 * mai companies never enter a baseline set — they only reach peer sets
 * through hand-built business-model sets.
 *
 * Reads ONLY listed_companies and peer_sets/peer_set_members. No startup
 * table, no startup sector picker, no Industry field.
 */

export const BASELINE_MIN_COMPANIES = 3;

export interface BaselineSectorChange {
  sector: string;
  added: string[];
  removed: string[];
}

export interface BaselineSummary {
  created: number;
  updated: number;
  unchanged: number;
  removed: string[];
  skipped: string[];
  changes: BaselineSectorChange[];
}

type AnyClient = { from: (t: string) => any };

export async function generateBaselineSets(
  supabase: AnyClient,
  userId: string | null,
): Promise<BaselineSummary> {
  const { data: companies, error: cErr } = await supabase
    .from("listed_companies")
    .select("id, name, ticker, sector, market")
    .eq("market", "SET");
  if (cErr) throw new Error(cErr.message);

  const bySector = new Map<string, { id: string; label: string }[]>();
  for (const c of (companies ?? []) as {
    id: string;
    name: string;
    ticker: string | null;
    sector: string | null;
  }[]) {
    const sector = (c.sector ?? "").trim();
    if (!sector) continue;
    const list = bySector.get(sector) ?? [];
    list.push({ id: c.id, label: c.ticker ? `${c.ticker} — ${c.name}` : c.name });
    bySector.set(sector, list);
  }

  const { data: sets, error: sErr } = await supabase
    .from("peer_sets")
    .select("id, sector, business_model, is_baseline")
    .is("business_model", null);
  if (sErr) throw new Error(sErr.message);

  const wideSets = new Map<string, string>();
  for (const s of (sets ?? []) as { id: string; sector: string | null }[]) {
    if (s.sector) wideSets.set(s.sector, s.id);
  }

  const setIds = [...wideSets.values()];
  const membersBySet = new Map<string, Set<string>>();
  if (setIds.length > 0) {
    const { data: members } = await supabase
      .from("peer_set_members")
      .select("peer_set_id, listed_company_id")
      .in("peer_set_id", setIds);
    for (const m of (members ?? []) as {
      peer_set_id: string;
      listed_company_id: string;
    }[]) {
      const s = membersBySet.get(m.peer_set_id) ?? new Set<string>();
      s.add(m.listed_company_id);
      membersBySet.set(m.peer_set_id, s);
    }
  }

  const summary: BaselineSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    removed: [],
    skipped: [],
    changes: [],
  };

  const audit = async (
    setId: string,
    sector: string,
    action: "CREATE" | "UPDATE" | "DELETE",
    added: string[],
    removed: string[],
  ) => {
    await supabase.from("audit_logs").insert({
      tenant_id: null,
      entity_type: "peer_set",
      entity_id: setId,
      action,
      old_value: { key: `${sector} · Baseline`, removed } as never,
      new_value: action === "DELETE" ? null : ({ key: `${sector} · Baseline`, added } as never),
    });
  };

  const sectors = [...new Set([...bySector.keys(), ...wideSets.keys()])].sort((a, b) =>
    a.localeCompare(b),
  );

  for (const sector of sectors) {
    const wanted = bySector.get(sector) ?? [];
    const existingId = wideSets.get(sector);

    if (wanted.length < BASELINE_MIN_COMPANIES) {
      if (existingId) {
        const before = membersBySet.get(existingId) ?? new Set<string>();
        const { error } = await supabase.from("peer_sets").delete().eq("id", existingId);
        if (error) throw new Error(error.message);
        summary.removed.push(sector);
        await audit(existingId, sector, "DELETE", [], [...before].map(String));
      } else {
        summary.skipped.push(sector);
      }
      continue;
    }

    const wantedIds = new Set(wanted.map((w) => w.id));
    const labelOf = new Map(wanted.map((w) => [w.id, w.label]));
    const now = new Date().toISOString();

    if (!existingId) {
      const { data: created, error } = await supabase
        .from("peer_sets")
        .insert({
          sector,
          business_model: null,
          is_baseline: true,
          last_refreshed_at: now,
          owner_user_id: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const setId = created.id as string;
      const { error: insErr } = await supabase
        .from("peer_set_members")
        .insert([...wantedIds].map((id) => ({ peer_set_id: setId, listed_company_id: id })));
      if (insErr) throw new Error(insErr.message);
      summary.created += 1;
      const added = [...wantedIds].map((id) => labelOf.get(id) ?? id);
      summary.changes.push({ sector, added, removed: [] });
      await audit(setId, sector, "CREATE", added, []);
      continue;
    }

    const before = membersBySet.get(existingId) ?? new Set<string>();
    const toAdd = [...wantedIds].filter((id) => !before.has(id));
    const toRemove = [...before].filter((id) => !wantedIds.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      // Membership identical — write nothing at all, so the audit log stays useful.
      summary.unchanged += 1;
      continue;
    }

    if (toRemove.length > 0) {
      const { error } = await supabase
        .from("peer_set_members")
        .delete()
        .eq("peer_set_id", existingId)
        .in("listed_company_id", toRemove);
      if (error) throw new Error(error.message);
    }
    if (toAdd.length > 0) {
      const { error } = await supabase
        .from("peer_set_members")
        .insert(toAdd.map((id) => ({ peer_set_id: existingId, listed_company_id: id })));
      if (error) throw new Error(error.message);
    }

    const { error: upErr } = await supabase
      .from("peer_sets")
      .update({ is_baseline: true, last_refreshed_at: now, updated_at: now })
      .eq("id", existingId);
    if (upErr) throw new Error(upErr.message);

    summary.updated += 1;
    const added = toAdd.map((id) => labelOf.get(id) ?? id);
    const removed = toRemove.map(String);
    summary.changes.push({ sector, added, removed });
    await audit(existingId, sector, "UPDATE", added, removed);
  }

  summary.removed.sort((a, b) => a.localeCompare(b));
  summary.skipped.sort((a, b) => a.localeCompare(b));
  return summary;
}
