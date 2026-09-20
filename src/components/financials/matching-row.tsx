/**
 * Matching, on one row: two inline dropdowns, an arrow, the result.
 * The row only grows when something is wrong — a narrowing suggestion
 * or a no-match line, never a permanent caution box.
 */
import { Link } from "@tanstack/react-router";

import { SectorPicker, BusinessModelPicker } from "@/components/startups/sector-fields";

export type MatchingRowProps = {
  sector: string | null;
  model: string | null;
  canEdit: boolean;
  isControl: boolean;
  onSector: (v: string | null) => void;
  onModel: (v: string | null) => void;
  /** Peer set name when a set matched, otherwise null. */
  appliedLabel: string | null;
  peerCount: number | null;
  refreshText: string | null;
  /** One sentence shown only when a narrower set exists. */
  suggestion: { label: string; peerCount: number; modelLabel: string; model: string } | null;
  right?: React.ReactNode;
};

function ReadOnly({ value }: { value: string | null }) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-[6px] border px-[9px] text-[12.5px] ${
        value
          ? "border-[#D3D9E2] bg-white font-medium text-[#0F1B33]"
          : "border-[#E9D4B4] bg-[#FDF9F3] text-[#B45309]"
      }`}
    >
      {value ?? "Not set"}
    </span>
  );
}

export function MatchingRow({
  sector,
  model,
  canEdit,
  isControl,
  onSector,
  onModel,
  appliedLabel,
  peerCount,
  refreshText,
  suggestion,
  right,
}: MatchingRowProps) {
  const thin = peerCount !== null && peerCount < 5;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="text-muted-foreground">Sector</span>
        {canEdit ? (
          <SectorPicker compact value={sector} onChange={onSector} />
        ) : (
          <ReadOnly value={sector} />
        )}
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">Model</span>
        {canEdit ? (
          <BusinessModelPicker compact sector={sector} value={model} onChange={onModel} />
        ) : (
          <ReadOnly value={model} />
        )}
        <span className="text-[#A8B8DC]">→</span>
        <span className="inline-flex items-center gap-1.5 font-medium text-[#0F1B33]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${appliedLabel ? "bg-[#15803D]" : "bg-[#C7CDD6]"}`}
          />
          {appliedLabel ?? (
            <span className="font-normal text-muted-foreground">no peer set</span>
          )}
          {appliedLabel && (
            <small className="font-normal text-muted-foreground">
              ·{" "}
              <span className={thin ? "text-[#B45309]" : undefined}>
                {peerCount} peer{peerCount === 1 ? "" : "s"}
              </span>
              {refreshText ? ` · ${refreshText}` : ""}
            </small>
          )}
        </span>
        {right && <span className="ml-auto">{right}</span>}
      </div>

      {suggestion && (
        <div className="mt-2 border-t border-[#F2F4F6] pt-2 text-[11.5px] text-muted-foreground">
          A <b className="text-[#0F1B33]">{suggestion.label}</b> set exists with{" "}
          {suggestion.peerCount} peer{suggestion.peerCount === 1 ? "" : "s"}. Setting the model
          would narrow the match — only if that describes the company.
          {canEdit && (
            <button
              type="button"
              onClick={() => onModel(suggestion.model)}
              className="ml-[7px] font-semibold text-[#1E3A8A]"
            >
              Set to {suggestion.modelLabel}
            </button>
          )}
        </div>
      )}

      {!appliedLabel && (
        <div className="mt-2 border-t border-[#F2F4F6] pt-2 text-[11.5px] text-[#B45309]">
          {sector ? (
            <>
              No set exists for <b className="text-[#B45309]">{sector}</b>, with or without a
              business model.
            </>
          ) : (
            <>No sector is set, so nothing can be matched.</>
          )}{" "}
          Multiples are unavailable; the benchmark above still works.
          {isControl && (
            <Link
              to="/peer-comparables"
              search={sector ? { sector } : {}}
              className="ml-[7px] font-semibold text-[#1E3A8A]"
            >
              Create a peer set →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
