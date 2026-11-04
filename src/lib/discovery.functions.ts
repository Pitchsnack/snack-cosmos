import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { DiscoveryData, DiscoveryListing } from './discovery';
import type { BoCard } from './buy-orders.functions';
import { PRICE_BANDS } from './asking-price';
import { discoveryRecent } from './discovery';

function publicClient() {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) throw new Error('Discovery unavailable');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h }); } } });
}
async function publicDiscovery(): Promise<DiscoveryData> {
  const { data, error } = await publicClient().rpc('discovery_public_rows');
  if (error) throw new Error('Discovery is temporarily unavailable');
  // Only the allowlisted RPC is used for reads. Privileged storage signing cannot widen that projection.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const cover = await (await import('./buy-order-cover.server')).buyOrderCoverResolver(supabaseAdmin);
  const sectorCover = await (await import('./cover-urls.server')).sectorCoverResolver();
  const orders: BoCard[] = await Promise.all((data.orders ?? []).map(async (r: BoCard & { cover_image_path?: string; cover_sector_image_id?: string }) => {
    const { cover_image_path, cover_sector_image_id, ...safe } = r;
    return { ...safe, cover: await cover({ sector: r.sector, cover_image_path, cover_sector_image_id }) };
  }));
  const listings: DiscoveryListing[] = await Promise.all((data.listings ?? []).map(async (r: any) => {
    const band = PRICE_BANDS.find(b => b.key === r.priceKey);
    return { id: r.id, dealType: r.dealType, askingPrice: null, priceBand: band ? { key: band.key, label: band.label, th: band.th } : null, handover: r.handover, reason: r.reason, reasonTh: r.reasonTh, views: r.views, ndas: r.ndas, growthBand: null, ebitdaMargin: null,
      listing: { headline: r.headline || r.codeName, description: r.description || '', highlights: r.highlights, productTags: r.productTags, marketTags: r.marketTags, revenueBand: r.revenueBand, location: r.location ? `${r.location}, Thailand` : null, typeFounded: [r.companyType, r.decade ? `Founded ${r.decade}s` : null].filter(Boolean).join(' · '), employees: r.employees, certifications: [], sector: r.sector, subSector: null, verified: false, certified: r.certified, hasFinancials: r.hasFinancials, codeName: r.codeName, refNo: r.ref, coverArt: r.sector, coverImage: null, publicImageId: r.publicImageId, coverUrl: await sectorCover(r.sector, r.publicImageId), live: true, publishedAt: r.publishedAt, newDays: discoveryRecent(r.publishedAt) ? 0 : null, th: { headline: r.headlineTh || '', description: r.descriptionTh || '', highlights: r.highlightsTh, customerProfile: '' } } };
  }));
  return { orders, listings };
}
export const getDiscovery = createServerFn({ method: 'GET' }).handler(publicDiscovery);
export const recordDiscoveryView = createServerFn({ method: 'POST' }).inputValidator(d => z.object({ id: z.string().uuid(), tab: z.enum(['wanted','sale']) }).parse(d)).handler(async ({ data }) => { await publicClient().rpc('discovery_record_view', { _id: data.id, _kind: data.tab }); });
export const discoveryMyState = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { roleOf } = await import('./plan-access.server');
  const role = await roleOf(context.userId);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const [{ data: applications }, { data: ndas }] = await Promise.all([
    role === 'seller' ? context.supabase.from('buy_order_applications').select('buy_order_id,applied_at,status') : Promise.resolve({ data: [] }),
    role === 'buyer' ? supabaseAdmin.from('deal_pipelines').select('hidden_profile_id,nda_requested_at,status').eq('buyer_user_id', context.userId).not('nda_requested_at','is',null) : Promise.resolve({ data: [] }),
  ]);
  return { role, applications: (applications ?? []) as { buy_order_id: string; applied_at: string; status: 'new' | 'nda_requested' | 'not_a_fit' }[], ndas: (ndas ?? []).filter(x => !['declined','withdrawn'].includes(x.status)).map(x => ({ id: x.hidden_profile_id, at: x.nda_requested_at })) };
});
export const sendDiscoveryListingShare = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(d => z.object({ id: z.string().uuid(), email: z.string().trim().email().max(254), lang: z.enum(['en','th']), token: z.string().uuid() }).parse(d)).handler(async ({ context, data }) => {
  const { roleOf } = await import('./plan-access.server');
  const role = await roleOf(context.userId); if (!role) throw new Error('Not available');
  const item = (await publicDiscovery()).listings.find(x => x.id === data.id); if (!item) throw new Error('Listing no longer available');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const key = `discovery-listing:${context.userId}:${data.token}`;
  const { data: already } = await supabaseAdmin.from('email_alert_log').select('id').eq('ref_key',key).eq('status','sent').limit(1); if (already?.length) return { ok: true };
  const { count } = await supabaseAdmin.from('email_alert_log').select('id',{ count:'exact',head:true }).eq('user_id',context.userId).eq('alert_key','Listing share').gte('created_at',new Date(Date.now()-60000).toISOString()); if ((count ?? 0) >= 10) throw new Error('Please wait before sending again');
  const { data: me } = await context.supabase.from('users').select('first_name,last_name').eq('id',context.userId).maybeSingle();
  const name = [me?.first_name,me?.last_name].filter(Boolean).join(' ') || 'PitchSnack member';
  const th = data.lang==='th'; const l=item.listing;
  const { sendTemplateEmail } = await import('./email-templates/send-email');
  const result = await sendTemplateEmail('buy-order-share', data.email, { idempotencyKey:key, templateData:{ listing:true, name, email:data.email, lang:data.lang, existing:true, url:`https://pitchsnack.com/discovery#${encodeURIComponent(l.refNo.toLowerCase())}`, card:{title:th ? l.th?.headline || l.headline : l.headline, ref:l.refNo, description:th ? l.th?.description || l.description : l.description, tile:'#356D5F', buyer:l.sector, sealed:false, rows:[{l:th?'จังหวัด':'Province',v:l.location || ''},{l:th?'รายได้ปี 2568':'Revenue FY25',v:l.revenueBand || ''},{l:th?'ราคาเสนอขาย':'Asking price',v:th?item.priceBand?.th || '':item.priceBand?.label || ''}] } } });
  await supabaseAdmin.from('email_alert_log').insert({alert_key:'Listing share',role,user_id:context.userId,email:data.email,subject:`${name} shared a listing`,ref_key:key,status:result.sent?'sent':'suppressed'});
  if (!result.sent) throw new Error('Invitation could not be delivered');
  return { ok:true };
});