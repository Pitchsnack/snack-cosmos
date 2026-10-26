import type { ReactNode, Ref } from 'react';
import type { DialogTitle } from '@/components/ui/dialog';

/** Identity shared by the Directory investor header and both Pipeline profiles. */
export function CompanyProfileIdentity({ name, logo, meta, line, title, titleRef, expanded=false }: {
  name: string; logo: string | null; meta: ReactNode; line?: ReactNode;
  title?: typeof DialogTitle; titleRef?: Ref<HTMLHeadingElement>; expanded?: boolean;
}) {
  const Title = title ?? 'h2';
  return <div className={expanded ? 'full-profile-identity' : 'flex min-w-0 flex-1 flex-col gap-4 sm:flex-row'}>
    <div className={expanded ? 'full-profile-logo' : 'flex h-12 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30'}>
      {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <span className="text-sm font-semibold text-muted-foreground">{name.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()}</span>}
    </div>
    <div className="min-w-0 flex-1"><Title ref={titleRef} tabIndex={expanded ? -1 : undefined} className={expanded ? 'full-profile-name' : 'text-2xl font-semibold leading-tight'}>{name}</Title>
      <div className={expanded ? 'full-profile-meta' : 'mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground'}>{meta}</div>
      {line && <div className={expanded ? 'full-profile-nda' : 'mt-[2px] text-[14px] leading-[1.5] text-muted-foreground'}>{line}</div>}
    </div>
  </div>;
}