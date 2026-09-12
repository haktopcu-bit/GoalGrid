(()=>{
'use strict';

const VERSION='V1.12.9';
const CACHE='goalgrid_direct_history_v1129_';

function norm(v){return String(v||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function isUefa(f){const id=Number(f?.league?.id),n=norm(f?.league?.name||'');return [2,3,848].includes(id)||n.includes('champions league')||n.includes('europa league')||n.includes('conference league');}
function excluded(f){const n=norm(`${f?.league?.name||''} ${f?.league?.country||''}`);return n.includes('caf')||n.includes('africa champions league')||n.includes('african champions league')||n.includes('confederation cup')||/(^| )(u19|under 19|u21|under 21)( |$)/.test(n)||n.includes('premier league 2')||n.includes('professional development league')||n.includes('rfef')||n.includes('primera federacion')||n.includes('segunda federacion');}

const oldWanted=window.wantedFixture;
if(typeof oldWanted==='function') window.wantedFixture=function(f){return !excluded(f)&&oldWanted(f);};

async function ensureId(team){
  if(Number(team?.id)>0)return Number(team.id);
  try{
    const arr=await apiFootball(`/teams?search=${encodeURIComponent(team?.name||'')}`);
    if(!Array.isArray(arr)||!arr.length)return null;
    const q=norm(team.name);
    const exact=arr.find(x=>norm(x?.team?.name)===q)||arr[0];
    const id=Number(exact?.team?.id)||null;
    if(id)team.id=id;
    return id;
  }catch{return null;}
}

function completed(m){return !!(m?.score&&Array.isArray(m.score.ft)&&m.score.ft.length>=2&&Number.isFinite(Number(m.score.ft[0]))&&Number.isFinite(Number(m.score.ft[1])));}

async function apiHistory(team,date){
  const id=await ensureId(team); if(!id)return[];
  const key=CACHE+'api_'+id;
  try{
    const c=JSON.parse(localStorage.getItem(key)||'null');
    if(c&&Date.now()-c.time<6*60*60*1000&&Array.isArray(c.rows))return c.rows.filter(m=>String(m.date||'')<date);
  }catch{}
  try{
    const raw=await apiFootball(`/fixtures?team=${id}&last=25&timezone=Europe/Istanbul`);
    const rows=[];
    for(const r of raw||[]){
      try{
        const m=normalizeApiFootballHistoryMatch(r);
        if(!m||!completed(m)||String(m.date||'')>=date)continue;
        if(Number(m.team1Id)!==id&&Number(m.team2Id)!==id)continue;
        rows.push(m);
      }catch{}
    }
    rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    try{localStorage.setItem(key,JSON.stringify({time:Date.now(),rows}));}catch{}
    return rows;
  }catch{return[];}
}

async function sofaHistory(team,date){
  const id=await ensureId(team); if(!id)return[];
  const key=CACHE+'sofa_'+norm(team.name).replace(/\s+/g,'_');
  let payload=null;
  try{
    const c=JSON.parse(localStorage.getItem(key)||'null');
    if(c&&Date.now()-c.time<6*60*60*1000)payload=c.payload;
  }catch{}
  if(!payload){
    try{
      const r=await fetch(`/sofa-history?team=${encodeURIComponent(team.name)}&v=1129`,{cache:'no-store'});
      payload=await r.json();
      if(!r.ok||!payload?.ok||!Array.isArray(payload.matches))return[];
      try{localStorage.setItem(key,JSON.stringify({time:Date.now(),payload}));}catch{}
    }catch{return[];}
  }
  const out=[];
  for(const m of payload.matches||[]){
    if(!completed(m)||String(m.date||'')>=date)continue;
    if(m.subjectSide==='home')out.push({...m,team1Id:id,team2Id:null,source:'Sofascore doğrudan takım geçmişi'});
    else if(m.subjectSide==='away')out.push({...m,team1Id:null,team2Id:id,source:'Sofascore doğrudan takım geçmişi'});
  }
  return out;
}

function count(team,rows,date){try{return lastMatches(team.name,team.id,rows,date).length;}catch{return 0;}}

const oldBuild=window.buildFixtureHistory;
window.buildFixtureHistory=async function(fixture){
  if(isUefa(fixture))return oldBuild(fixture);
  const date=String(fixture?.fixture?.date||'').slice(0,10);
  const h=fixture?.teams?.home,a=fixture?.teams?.away;
  if(!h||!a)return oldBuild(fixture);

  await Promise.all([ensureId(h),ensureId(a)]);
  let base={matches:[],sources:[],errors:[]};
  try{base=await oldBuild(fixture);}catch(e){base.errors=[String(e?.message||e)];}
  let merged=mergeMatches(base.matches||[]);
  const sources=[...(base.sources||[])],errors=[...(base.errors||[])];

  let hc=count(h,merged,date),ac=count(a,merged,date);
  if(hc<8||ac<8){
    const [hh,aa]=await Promise.all([hc<8?apiHistory(h,date):[],ac<8?apiHistory(a,date):[]]);
    if(hh.length){merged=mergeMatches(merged,hh);sources.push(`API-Football doğrudan ${h.name} (${hh.length})`);}
    if(aa.length){merged=mergeMatches(merged,aa);sources.push(`API-Football doğrudan ${a.name} (${aa.length})`);}
    hc=count(h,merged,date);ac=count(a,merged,date);
  }

  if(hc<5||ac<5){
    const [hs,as]=await Promise.all([hc<5?sofaHistory(h,date):[],ac<5?sofaHistory(a,date):[]]);
    if(hs.length){merged=mergeMatches(merged,hs);sources.push(`Sofascore doğrudan ${h.name} (${hs.length})`);}
    if(as.length){merged=mergeMatches(merged,as);sources.push(`Sofascore doğrudan ${a.name} (${as.length})`);}
    hc=count(h,merged,date);ac=count(a,merged,date);
  }

  if(hc<2||ac<2)errors.push(`V1.12.9 doğrudan geçmiş: ${h.name}=${hc}, ${a.name}=${ac}`);
  return {matches:merged,sources:[...new Set(sources)],errors};
};

window.addEventListener('DOMContentLoaded',()=>{
  document.title=`GoalGrid ${VERSION}`;
  const s=document.querySelector('.subtitle');if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;
});
})();