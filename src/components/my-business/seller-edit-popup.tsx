import { useEffect, useRef } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { EditInfoPopup, leaveEditUrl, markEditPushed, useTr } from "@/components/common/edit-info-popup";
import { StartupForm, PRIVATE_TABS, PUBLIC_TABS, type PrivateTab } from "@/components/startups/startup-form";
import { BasicInformationRestrictionsTab } from "@/components/startups/basic-information-restrictions-tab";
import { useStartup } from "@/hooks/use-startup";
import { useEntryFacts, useHiddenProfile, useHiddenProfileActions } from "@/hooks/use-hidden-profiles";
import type { StartupDetail } from "@/lib/startups.functions";
import type { PublicTab } from "@/components/hidden-profile/public-view-fields";

type View = "public" | "private";
type EditSearch = { panel?: string; edit?: "startup"; view?: string; tab?: string; section?: string };

/** Opens Seller › My Company › Edit information at a view, tab and (optionally) section. */
export function useOpenSellerEdit() {
  const navigate = useNavigate();
  return (id: string, view: View, tab: string, section?: string) => {
    markEditPushed();
    void navigate({
      to: "/my-startups",
      search: ((p: Record<string, unknown>) => ({ ...p, panel: id, edit: "startup", view, tab, section })) as never,
    });
  };
}

function viewAndTab(view: string | undefined, tab: string | undefined, fallback: View): [View, string] {
  const isPub = PUBLIC_TABS.includes(tab as PublicTab);
  const isPriv = PRIVATE_TABS.includes(tab as PrivateTab);
  let v: View = view === "public" || view === "private" ? view : isPub ? "public" : isPriv ? "private" : fallback;
  if (view === "public" && isPriv) v = "private";
  if (view === "private" && isPub) v = "public";
  const t = v === "public" ? (isPub ? tab! : "identity") : (isPriv ? tab! : "images");
  return [v, t];
}

/** The pop-up over Seller › My Company, holding Edit my startup. */
export function SellerEditPopup({ fallbackView }: { fallbackView: View }) {
  const s = useSearch({ strict: false }) as EditSearch;
  const navigate = useNavigate();
  const tr = useTr();
  const id = s.edit === "startup" ? s.panel : undefined;
  const { data, isLoading } = useStartup(id);
  const { row, isLoading: rowLoading } = useHiddenProfile(id);
  const { data: facts } = useEntryFacts(id);
  const actions = useHiddenProfileActions();
  const [view, tab] = viewAndTab(s.view, s.tab, fallbackView);
  const last = useRef<Record<View, string>>({ public: "identity", private: "images" });
  last.current[view] = tab;

  // Create public view / Edit public view open Public view: make the draft listing first.
  const creating = useRef(false);
  useEffect(() => {
    if (!id || row || rowLoading || view !== "public" || creating.current) return;
    creating.current = true;
    actions.create.mutate({ startupId: id });
  }, [id, row, rowLoading, view]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!id) return null;
  const close = () => leaveEditUrl(() => void navigate({
    to: "/my-startups",
    search: ((p: Record<string, unknown>) => ({ ...p, edit: undefined, view: undefined, tab: undefined, section: undefined })) as never,
    replace: true,
  }));
  const onNav = (v: View, t: string) => void navigate({
    to: "/my-startups",
    search: ((p: Record<string, unknown>) => ({ ...p, view: v, tab: t || last.current[v], section: undefined })) as never,
    replace: true,
  });
  const name = data?.startup_name ?? "";
  const showPublic = view === "public" && !!row;
  const subtitle = showPublic ? `${row?.code_name || tr("Public view", "มุมมองสาธารณะ")} · ${tr("Public view", "มุมมองสาธารณะ")}` : `${name || tr("Your company", "บริษัทของท่าน")} · ${tr("Private view", "มุมมองส่วนตัว")}`;
  const ready = !!data && !(view === "public" && !row);

  return (
    <EditInfoPopup open subtitle={subtitle} companyName={name} onClosed={close} phoneTabs>
      {!ready || isLoading ? (
        <div className="space-y-3 pt-5"><Skeleton className="h-10" /><Skeleton className="h-[260px]" /></div>
      ) : (
        <StartupForm
          key={id}
          startup={data as unknown as StartupDetail}
          workspace="my-startups"
          section={s.section}
          popup={{
            view: showPublic ? "public" : "private",
            tab: showPublic ? tab : view === "public" ? "images" : tab,
            onNav,
            row,
            facts,
            restrictions: <BasicInformationRestrictionsTab startup={data as unknown as StartupDetail} scope="my-startups" />,
          }}
        />
      )}
    </EditInfoPopup>
  );
}
