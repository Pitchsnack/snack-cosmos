import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideContactRequest, listContactRequests } from "@/lib/contact-requests.functions";

const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Pipeline: contact requests a seller sent, or an investor received (anonymous listing only). */
export function ContactRequestsSection({ as }: { as: "seller" | "buyer" }) {
  const fn = useServerFn(listContactRequests);
  const decide = useServerFn(decideContactRequest);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["contact-requests-list", as], queryFn: () => fn({ data: { as } }), refetchInterval: 30_000 });
  if (!data.length) return null;
  const act = async (id: string, accept: boolean) => {
    try {
      await decide({ data: { id, accept } });
      toast.success(accept ? "Accepted. The NDA is approved and the deal is in your Tracking list." : "Declined.");
    } catch (e) { toast.error((e as Error).message); }
    qc.invalidateQueries({ queryKey: ["contact-requests-list"] });
    qc.invalidateQueries({ queryKey: ["pipeline"] });
  };
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-semibold">{as === "seller" ? "Contact requests you sent" : "Sellers who want to talk to you"}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((r) => {
          const status = r.status === "waiting" ? `Request sent ${day(r.createdAt)} · waiting` : r.status === "accepted" ? "Accepted" : "Declined";
          if (as === "seller") return (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-card p-4 shadow-card">
              <div>
                <div className="font-semibold">{r.investorLabel ?? "Investor"}</div>
                <div className="text-[13px] text-muted-foreground">Your listing {r.listingRef ?? ""}</div>
              </div>
              <span className="text-[13px] font-semibold">{status}</span>
            </div>
          );
          const l = r.listing;
          const c = r.closed;
          return (
            <div key={r.id} className="space-y-2 rounded-[12px] border border-border bg-card p-4 shadow-card">
              <div className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{l?.refNo || c?.refNo || r.listingRef}</div>
              <div className="font-semibold">{l?.headline || l?.codeName || c?.sector || "A business for sale"}</div>
              <div className="text-[13px] text-muted-foreground">{[l?.sector ?? c?.sector, l?.location ?? c?.region, l?.revenueBand ?? c?.priceBand].filter(Boolean).join(" · ")}</div>
              {l?.description && <p className="line-clamp-3 text-[13px]">{l.description}</p>}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[12.5px] text-muted-foreground">Received {day(r.createdAt)}</span>
                {r.status === "waiting" ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => act(r.id, false)}>Decline</Button>
                    <Button size="sm" onClick={() => act(r.id, true)}>Accept</Button>
                  </div>
                ) : <span className="text-[13px] font-semibold">{status}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
