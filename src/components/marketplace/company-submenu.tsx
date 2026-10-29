import { Building2 } from 'lucide-react';
import { useRouterState } from '@tanstack/react-router';
import { usePersona } from '@/hooks/use-marketplace';
import { useTranslation } from '@/i18n/language';
import { ApprovalSidebarBadge } from '@/components/approval/approval-banners';
import { WorkspaceSubmenu } from './workspace-submenu';

export function CompanySubmenu({ collapsed = false }: { collapsed?: boolean }) {
  const { persona } = usePersona();
  const { language, t } = useTranslation();
  const path = useRouterState({ select: s => s.location.pathname });
  const destination = persona === 'seller' ? '/my-startups' : '/marketplace/my-company';
  const company = path === destination || path.startsWith(`${destination}/`);
  const profile = path === '/my-page';
  const th = language === 'th';
  const badge = <ApprovalSidebarBadge />;
  return <WorkspaceSubmenu id="my-company" label={t('My Company')}
    heading={th ? t('My Company') : 'MY COMPANY'} icon={Building2}
    groupLabel={th ? 'หน้าบริษัทของฉัน' : 'My Company pages'}
    destination={destination} active={company || profile} collapsed={collapsed} company
    focusSelector="main h1" badge={persona === "buyer" ? undefined : badge} railBadge={badge}
    items={[
      { to: destination, label: th ? 'โปรไฟล์บริษัท' : 'Company profile', current: company, suffix: persona === "buyer" ? badge : undefined },
      { to: '/my-page', label: t('My Profile'), current: profile },
    ]} />;
}
