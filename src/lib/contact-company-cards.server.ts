import { buildPublicListing } from './public-listing';
import { priceFor } from './asking-price';
import { isCorporateBuyer } from './investor-browse';

/** Caller must authorize each organisation before invoking this projection. */
export async function loadContactCompanyCards(sb: any, contact: {id:string; organisations:{id:string;kind:'seller'|'buyer'|'advisor';ref:string|null}[]}) {
  const signed = async (path: string | null) => {
    if (!path) return null;
    if (/^https:\/\//.test(path)) return path;
    const {data, error} = await sb.storage.from('startup-media').createSignedUrl(path, 3600);
    if (error) throw new Error('Unable to load company image');
    return data?.signedUrl || null;
  };
  return Promise.all(contact.organisations.map(async o => {
    if (o.kind === 'advisor') {
      const {loadFirmCards} = await import('./advisor-firm.functions');
      const firms = await loadFirmCards(sb, [o.id]);
      return {kind: 'advisor' as const, id: o.id, firm: firms[0] || null};
    }
    if (o.kind === 'seller') {
      const [{data: s, error}, {data: h}, {data: media}, {data: inc}, {data: fin}] = await Promise.all([
        sb.from('startups').select('startup_name,registered_name,website_url,email,city,region,headquarters,company_type,year_founded,company_size,last_year_revenue,sector,business_model,industry,product_tags,market_tags,long_description,short_description,regulatory_licenses,iso_standards,logo_url,registration_verified_at').eq('id', o.id).single(),
        sb.from('hidden_profiles').select('ref_no,live,headline,description,highlights,customers_summary,deal_type,asking_price_thb,asking_price,published_at,public_image_id').eq('startup_id', o.id).maybeSingle(),
        sb.from('startup_media').select('image_url,slot').eq('startup_id', o.id).order('slot'),
        sb.from('income_statement_items').select('fiscal_year,item_code,amount').eq('startup_id', o.id).in('item_code', ['total_revenue', 'revenue_sales_services']).order('fiscal_year', {ascending: false}),
        sb.from('financial_statements').select('id').eq('startup_id', o.id).limit(1),
      ]);
      if (error || !s) throw new Error('Unable to load company card');
      const snapshot = h?.live || h || {};
      const l = buildPublicListing(s, {...snapshot, ref_no: o.ref || h?.ref_no, live: !!h?.live, published_at: h?.published_at}, !!fin?.length);
      const {managedStartupIds} = await import('./managed.server');
      l.managed = (await managedStartupIds(sb, [o.id])).has(o.id);
      l.certified = !!s.registration_verified_at;
      const fy = inc?.[0]?.fiscal_year ?? null;
      const revenue = inc?.find((r: any) => r.fiscal_year === fy && r.item_code === 'total_revenue')?.amount ?? inc?.find((r: any) => r.fiscal_year === fy)?.amount ?? null;
      return {kind: 'seller' as const, id: o.id, listing: l, deal: {dealType: snapshot.deal_type || null, ...priceFor(snapshot, true)}, privateData: {
        companyName: s.startup_name, description: s.long_description || s.short_description || null,
        photoUrl: await signed(media?.find((m: any) => m.image_url)?.image_url || null), logoPath: s.logo_url, employees: s.company_size,
        fy: fy == null ? null : Number(fy), revenue: revenue == null ? null : Number(revenue), netProfit: null, growthPct: null,
        legalNameEn: null, legalNameTh: s.registered_name, regNo: null, website: s.website_url, location: s.city, founded: s.year_founded ? String(s.year_founded) : null,
      }};
    }
    const [{data: i, error}, {data: b}, {data: verification}] = await Promise.all([
      sb.from('investors').select('investor_name,investor_type,country,address_city_district,address_province_state,website_url,linkedin_url,email,year_founded,aum,aum_exact_usd,min_ticket_size,max_ticket_size,revenue_min_m,revenue_max_m,short_description,long_description,keywords,investment_focus,preferred_stages,preferred_industries,logo_url,aum_band,ticket_band,revenue_min_band,acts_for_types,media').eq('id', o.id).single(),
      sb.from('buyer_profiles').select('buyer_relation,deal_types,pof_verified_at,ref_no').eq('investor_id', o.id).maybeSingle(),
      sb.from('investor_profile_verifications').select('status').eq('investor_id', o.id).maybeSingle(),
    ]);
    if (error || !i) { console.error('Admin buyer card query failed', error?.code); throw new Error('Unable to load company card'); }
    i.city = i.address_province_state || i.address_city_district || null;
    const privateData = {...i, acts_for_types: i.acts_for_types || [], keywords: i.keywords || [], investment_focus: i.investment_focus || [], preferred_stages: i.preferred_stages || [], preferred_industries: i.preferred_industries || [],
      logo_signed_url: await signed(i.logo_url), media: await Promise.all((i.media || []).sort((a: any, b: any) => a.slot - b.slot).map(async (m: any) => ({slot: m.slot, image_signed_url: await signed(m.image_path)}))), people: [], linked_startups: []};
    const card = {refNo: o.ref || b?.ref_no || '', codeName: '', name: i.investor_name, type: i.investor_type, city: i.city, country: i.country, description: i.short_description, sectors: i.preferred_industries || [], stages: i.preferred_stages || [], dealTypes: b?.deal_types || [], geography: (i.investment_focus || []).join(' · '), verified: verification?.status === 'verified', proofOfFunds: !!b?.pof_verified_at, ticketLabel: null, aumLabel: null, revLabel: null, relation: b?.buyer_relation, actsFor: i.acts_for_types || []};
    const {managedInvestorIds} = await import('./managed.server');
    const money = (v: string | null) => v || null;
    return {kind: 'buyer' as const, id: o.id, card: {...card, managed: (await managedInvestorIds(sb, [o.id])).has(o.id)}, privateData,
      exactFigures: {figures: [{label: 'Ticket size', value: [money(i.min_ticket_size), money(i.max_ticket_size)].filter(Boolean).join(' – ') || null}, ...(b?.buyer_relation === 'individual' || b?.buyer_relation === 'agent' ? [] : [{label: isCorporateBuyer(i.investor_type) ? 'Group revenue' : 'AUM', value: i.aum_exact_usd == null ? money(i.aum) : `US$ ${Number(i.aum_exact_usd).toLocaleString('en-US')}`}])], fit: {label: 'Min. target revenue', value: i.revenue_min_m == null ? null : `฿ ${Math.round(Number(i.revenue_min_m) * 1e6).toLocaleString('en-US')}`}},
    };
  }));
}