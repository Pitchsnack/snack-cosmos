import type { ContactPerson, MyCard } from './contacts.functions';
import { activeContactNda } from './admin-contacts';
import { activeAdvisorContact, investorClassification, type ContactView } from './marketplace-contacts';
const STEPS = ["NDA", "Financial & Valuation", "Letter of intent", "Contact M&A", "Legal", "Offer & SPA", "Payment"];
function step(r: any) {
  const marks = [r.nda_approved_at, r.report_shared_at, r.loi_accepted_at, r.contact_at, r.legal_at, r.spa_at, r.payment_at];
  const i = marks.findIndex((m) => !m);
  return i === -1 ? "Completed" : STEPS[i];
}

async function people(sb: any, ids: string[]) {
  if (!ids.length) return { users: {} as Record<string, any>, profs: {} as Record<string, any> };
  const [{ data: us }, { data: ps }] = await Promise.all([
    sb.from("users").select("id, first_name, last_name, email, created_at").in("id", ids),
    sb.from("user_profiles").select("*").in("user_id", ids),
  ]);
  return {
    users: Object.fromEntries((us ?? []).map((u: any) => [u.id, u])),
    profs: Object.fromEntries((ps ?? []).map((p: any) => [p.user_id, p])),
  };
}
const fullName = (u: any) => (u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email : null);

export async function loadMarketplaceContacts(data: {as: ContactView}, context: {userId:string; supabase:any}) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const {data: caller, error: callerError} = await context.supabase.from('users').select('account_role,advisor_view').eq('id',context.userId).maybeSingle();
    if(callerError || !caller || (data.as==='advisor' ? !caller.advisor_view : caller.account_role!=='admin' && caller.account_role!==data.as)) throw new Error('This page is not available for your account');
    let rows: any[] = [];
    let advisorLinks:any[]=[];
    let advisorNdas:any[]=[];
    let ownFirms:any[]=[];
    if(data.as==='advisor') {
      ownFirms=(await sb.from('advisor_firms').select('id,name').eq('owner_user_id',context.userId)).data||[];
      if(ownFirms.length) {
        advisorLinks=(await sb.from('deal_advisors').select('*').in('firm_profile_id',ownFirms.map(f=>f.id))).data||[];
        const ndaIds=advisorLinks.map(a=>a.advisor_nda_id).filter(Boolean), dealIds=advisorLinks.map(a=>a.deal_id);
        advisorNdas=ndaIds.length?(await sb.from('advisor_ndas').select('id,deal_id,firm_profile_id,signed_at,expires_at').in('id',ndaIds)).data||[]:[];
        rows=dealIds.length?(await sb.from('deal_pipelines').select('*').in('id',dealIds)).data||[]:[];
        advisorLinks=advisorLinks.filter(a=>activeAdvisorContact(a,advisorNdas.find(n=>n.id===a.advisor_nda_id),rows.find(d=>d.id===a.deal_id)));
        rows=rows.filter(d=>advisorLinks.some(a=>a.deal_id===d.id));
      }
    } else
    if (data.as === "buyer") {
      const r = await sb.from("deal_pipelines").select("*").eq("buyer_user_id", context.userId).not("nda_approved_at", "is", null).neq("status", "declined");
      rows = r.data ?? [];
    } else {
      const { data: own } = await sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", context.userId);
      const { data: su } = await sb.from("startup_users").select("startup_id").eq("user_id", context.userId);
      const ids = await (await import("@/lib/workspace-scope.server")).scopeStartupIds(context.userId, [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id as string))]);
      if (ids.length) {
        const r = await sb.from("deal_pipelines").select("*").in("startup_id", ids).not("nda_approved_at", "is", null).neq("status", "declined");
        rows = r.data ?? [];
      }
    }

    if(data.as!=='advisor') rows=rows.filter(r=>!r.ended_at && activeContactNda(r));
    rows.sort((a,b)=>(b.nda_approved_at||'').localeCompare(a.nda_approved_at||''));
    const stIds = [...new Set(rows.map((r) => r.startup_id))];
    const { data: stsRaw } = stIds.length
      ? await sb.from("startups").select("id, startup_name, industry, website_url, region, city").in("id", stIds)
      : { data: [] };
    const sts = (stsRaw ?? []).map((s: any) => ({ ...s, website: s.website_url, country: s.region }));
    const stMap = Object.fromEntries((sts ?? []).map((s: any) => [s.id, s]));
    const { data: owners } = stIds.length
      ? await sb.from("startup_ownership").select("startup_id, owning_agent_user_id, seller_relation").in("startup_id", stIds)
      : { data: [] };
    const ownerOf = Object.fromEntries((owners ?? []).map((o: any) => [o.startup_id, o.owning_agent_user_id]));

    const personIds = rows.flatMap(r=>data.as==='advisor'?[r.buyer_user_id,ownerOf[r.startup_id]]:[data.as==='seller'?r.buyer_user_id:ownerOf[r.startup_id]]).filter(Boolean);
    const {data:bps} = personIds.length ? await sb.from('buyer_profiles').select('user_id,investor_id,ref_no').in('user_id',[...new Set(personIds)]) : {data:[]};
    const invIds=(bps||[]).map((b:any)=>b.investor_id).filter(Boolean);
    const {data:invs}=invIds.length?await sb.from('investors').select('id,investor_name,investor_type,acts_for_types').in('id',invIds):{data:[]};
    const buyerOf=Object.fromEntries((bps||[]).map((b:any)=>[b.user_id,{...b,investor:(invs||[]).find((i:any)=>i.id===b.investor_id)}]));
    const { users, profs } = await people(sb, [...new Set([...personIds, context.userId])]);
    const seen = new Set<string>();
    const contacts: ContactPerson[] = [];
    const pidOf = new Map<ContactPerson, string>();
    for (const r of rows) {
      const sides: ('seller'|'buyer')[]=data.as==='advisor'?['seller','buyer']:[data.as==='seller'?'buyer':'seller'];
      for(const side of sides) {
        const pid=side==='buyer'?r.buyer_user_id:ownerOf[r.startup_id];
        if(!pid || seen.has(`${side}:${pid}`))continue;
        seen.add(`${side}:${pid}`);
        const u=users[pid], p=profs[pid]||{}, st=stMap[r.startup_id]||{}, bp=buyerOf[pid], inv=bp?.investor;
        const a=advisorLinks.find(a=>a.deal_id===r.id), n=advisorNdas.find(n=>n.id===a?.advisor_nda_id);
        const client=a?.side==='seller'?st.startup_name:buyerOf[r.buyer_user_id]?.investor?.investor_name||'Buyer';
        const c:ContactPerson={id:`${r.id}:${side}:${pid}`,group:'counterparty',contactRole:side,name:fullName(u)||'Contact',role:side==='buyer'?'Buyer':'Seller',title:p.title||null,company:p.organisation||(side==='buyer'?inv?.investor_name:st.startup_name)||null,email:u?.email||null,phone:p.phone||null,linkedin:p.linkedin||null,bestTime:null,companyType:side==='buyer'?investorClassification(inv?.investor_type||null,inv?.acts_for_types):(owners||[]).find((o:any)=>o.startup_id===r.startup_id && o.owning_agent_user_id===pid)?.seller_relation||null,location:null,city:p.city||null,country:p.country||null,bio:p.bio||null,memberSince:u?.created_at||null,lastActive:null,website:null,connectedAt:data.as==='advisor'?n?.signed_at||null:r.nda_approved_at,pipelineStep:step(r),personId:pid,organisationId:side==='buyer'?bp?.investor_id||null:r.startup_id,dealId:r.id,how:data.as==='advisor'?a?.side===side?'advisor-client':'advisor-other':'nda',client:data.as==='advisor'?client:null};
        contacts.push(c);pidOf.set(c,pid);
      }
    }

    const me = users[context.userId];
    const mp = profs[context.userId] ?? {};
    const myCompany = mp.organisation || (data.as === 'advisor' ? ownFirms[0]?.name : data.as === 'seller' ? stMap[stIds[0]]?.startup_name : null);
    const my: MyCard = {
      name: fullName(me) ?? "Me",
      role: mp.title ?? null,
      company: myCompany ?? null,
      email: me?.email ?? null,
      phone: mp.phone ?? null,
      linkedin: mp.linkedin ?? null,
    };
    // Advisors on my deals (either side), only while their advisor NDA is active.
    const dealIds = rows.map((r) => r.id);
    if (data.as!=='advisor' && dealIds.length) {
      const { data: das } = await sb.from("deal_advisors").select("deal_id, side, firm_profile_id, advisor_user_id, joined_at, advisor_nda_id").in("deal_id", dealIds);
      const ndaIds = (das ?? []).map((x: any) => x.advisor_nda_id).filter(Boolean);
      const fIds = [...new Set((das ?? []).map((x: any) => x.firm_profile_id))];
      const [{ data: ns }, { data: fs }] = await Promise.all([
        ndaIds.length ? sb.from("advisor_ndas").select("id, deal_id, firm_profile_id, signed_at, expires_at").in("id", ndaIds) : { data: [] },
        fIds.length ? sb.from("advisor_firms").select("id, name, firm_type, city, country, website, email, phone").in("id", fIds) : { data: [] },
      ]);
      const live = new Set((ns ?? []).filter((n: any) => new Date(n.expires_at) > new Date()).map((n: any) => n.id));
      const fm = Object.fromEntries((fs ?? []).map((f: any) => [f.id, f]));
      const advIds = (das ?? []).map((x: any) => x.advisor_user_id);
      const ap = await people(sb, advIds);
      const rowById = Object.fromEntries(rows.map((r) => [r.id, r]));
      for (const a of das ?? []) {
        if (!live.has(a.advisor_nda_id) || !activeAdvisorContact(a,(ns||[]).find((n:any)=>n.id===a.advisor_nda_id),rowById[a.deal_id])) continue;
        const f = fm[a.firm_profile_id] ?? {}, u = ap.users[a.advisor_user_id], p = ap.profs[a.advisor_user_id] ?? {};
        const mine = a.side === data.as;
        contacts.push({
          id: `${a.deal_id}:advisor:${a.advisor_user_id}`, group: "advisor", contactRole:"advisor", title:p.title||null, city:p.city||null,country:p.country||null,bio:p.bio||null,memberSince:u?.created_at||null,lastActive:null,personId:a.advisor_user_id,organisationId:a.firm_profile_id,dealId:a.deal_id,how:"advisor-for",client:a.side==="seller"?stMap[rowById[a.deal_id]?.startup_id]?.startup_name||"Seller":buyerOf[rowById[a.deal_id]?.buyer_user_id]?.investor?.investor_name||"Buyer", name: fullName(u) ?? f.name ?? "Advisor",
          role: `Advisor NDA · for ${mine ? "you" : a.side === "seller" ? "the seller" : "the buyer"}`,
          company: f.name ?? null, email: f.email || u?.email || null, phone: f.phone || p.phone || null, linkedin: p.linkedin ?? null,
          bestTime: null, companyType: null, location: [f.city, f.country].filter(Boolean).join(", ") || null,
          website: f.website ?? null, connectedAt: a.joined_at, pipelineStep: step(rowById[a.deal_id] ?? {}),
        });
        pidOf.set(contacts[contacts.length - 1], a.advisor_user_id);
      }
    }
    // Firms this company engaged through Browse advisors: the person who sent the accepted proposal.
    {
      const E = await import("@/lib/advisor-enquiries.server");
      const org = data.as==='advisor'?null:await E.clientOrg(sb, context.userId, data.as);
      if (org) {
        const { data: es } = await sb.from("advisor_enquiries").select("id, firm_profile_id, service_key, engaged_at").eq("client_side", data.as).eq("client_org_id", org).in("status", ["engaged", "done"]);
        if (es?.length) {
          const [{ data: ps }, { data: fs }] = await Promise.all([
            sb.from("advisor_proposals").select("enquiry_id, sent_by").in("enquiry_id", es.map((e: any) => e.id)).eq("status", "accepted"),
            sb.from("advisor_firms").select("id, name, firm_type, city, country, website, email, phone").in("id", es.map((e: any) => e.firm_profile_id)),
          ]);
          const fm = Object.fromEntries((fs ?? []).map((f: any) => [f.id, f]));
          const ap = await people(sb, (ps ?? []).map((x: any) => x.sent_by));
          for (const e of es) {
            const pid = (ps ?? []).find((x: any) => x.enquiry_id === e.id)?.sent_by;
            const f = fm[e.firm_profile_id] ?? {}, u = ap.users[pid], pr = ap.profs[pid] ?? {};
            contacts.push({
              id: `eng-${e.id}`, group: "advisor", contactRole:"advisor", title:pr.title||null, city:pr.city||null,country:pr.country||null,bio:pr.bio||null,memberSince:u?.created_at||null,lastActive:null,personId:pid||null,organisationId:e.firm_profile_id,dealId:null,how:"assigned",client:null, name: fullName(u) ?? f.name ?? "Advisor", role: pr.title ?? "Your advisor",
              company: f.name ?? null, email: u?.email || f.email || null, phone: pr.phone || f.phone || null, linkedin: pr.linkedin ?? null,
              bestTime: null, companyType: null, location: [f.city, f.country].filter(Boolean).join(", ") || null,
              website: f.website ?? null, connectedAt: e.engaged_at, pipelineStep: `Engaged · ${e.service_key}`,
            });
            if (pid) pidOf.set(contacts[contacts.length - 1], pid);
          }
        }
      }
    }
    await Promise.all(contacts.map(async c=>{if(!c.personId)return;const {data:auth,error}=await sb.auth.admin.getUserById(c.personId);if(!error)c.lastActive=auth?.user?.last_sign_in_at||null;}));
    // Admins of a managed company: one "PitchSnack team" row, never their own details.
    const team = await (await import("@/lib/managed.server")).adminUserIds(sb, [...pidOf.values()]);
    for (const c of contacts) {
      if (!team.has(pidOf.get(c) ?? "")) continue;
      Object.assign(c, { name: "PitchSnack team", role: null, email: "support@pitchsnack.com", phone: null, linkedin: null, team: true, title:null, city:null, country:null, bio:null, memberSince:null, lastActive:null, personId:null });
    }
    const seenTeam = new Set<string>();
    const out = contacts.filter((c) => !c.team || (!seenTeam.has(`${c.group}|${c.company}`) && !!seenTeam.add(`${c.group}|${c.company}`)));
    return { my, contacts: out, visibleTo: new Set(out.filter(c=>c.contactRole!=='advisor').map(c=>`${c.contactRole}:${c.personId||c.company}`)).size };

}
