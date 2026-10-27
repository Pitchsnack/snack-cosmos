import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export type ContactPerson = {
  id: string;
  group: "counterparty" | "advisor";
  name: string;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  bestTime: string | null;
  companyType: string | null;
  location: string | null;
  website: string | null;
  connectedAt: string | null;
  pipelineStep: string | null;
  /** PitchSnack team row (a managed company's admins). */
  team?: boolean;
  contactRole: "seller" | "buyer" | "advisor";
  title: string | null; city: string | null; country: string | null; bio: string | null; memberSince: string | null; lastActive: string | null;
  personId: string | null; organisationId: string | null; dealId: string | null; how: string | null; client: string | null;
};

export type MyCard = { name: string; role: string | null; company: string | null; email: string | null; phone: string | null; linkedin: string | null };


export const listContacts=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({as:z.enum(['seller','buyer','advisor'])}).parse(d)).handler(async({data,context})=>{
 const {loadMarketplaceContacts}=await import('./marketplace-contacts.server');
 return loadMarketplaceContacts(data,context);
});
export const getContactCompanyCard=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({as:z.enum(['seller','buyer','advisor']),contactId:z.string()}).parse(d)).handler(async({data,context})=>{
 const {loadMarketplaceContacts}=await import('./marketplace-contacts.server');
 const contacts=await loadMarketplaceContacts(data,context);
 const c=contacts.contacts.find(c=>c.id===data.contactId);
 if(!c?.organisationId)throw new Error('This contact is no longer available');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {loadContactCompanyCards}=await import('./contact-company-cards.server');
 return loadContactCompanyCards(supabaseAdmin,{id:c.personId||'',organisations:[{id:c.organisationId,kind:c.contactRole,ref:null}]});
});
