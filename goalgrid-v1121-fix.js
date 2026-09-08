(()=>{
'use strict';
const VERSION='V1.12.1';

/* This patch is deliberately surgical. It does NOT replace the global league
   loader or global team matcher. The stable V1.11.8 pipeline remains intact.
   Only Real Madrid / Inter history gets an extra deterministic domestic source. */

function clean(v){return String(v||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
function isReal(v){return ['realmadrid','realmadridcf'].includes(clean(v));}
function isInter(v){return ['inter','intermilan','internazionale','internazionalemilano','fcinternazionale','fcinternazionalemilano'].includes(clean(v));}
function target(v){if(isReal(v))return {id:541,code:'laliga',label:'Real Madrid CF'};if(isInter(v))return {id:505,code:'seriea',label:'FC Internazionale Milano'};return null;}
function looseTargetMatch(targetId,name){return targetId===541?isReal(name):targetId===505?isInter(name):false;}

async function deterministicDomestic(team,date){
  const t=target(team?.name);if(!t)return [];
  team.id=t.id;
  const rows=[];
  try{
    const r=await fetch(`/data?league=${encodeURIComponent(t.code)}&v=1121`,{cache:'no-store'});
    const j=await r.json();
    for(const m of (j.maclar||[])){
      if(!m?.score?.ft||String(m.date||'')>=date)continue;
      const home=looseTargetMatch(t.id,m.team1),away=looseTargetMatch(t.id,m.team2);
      if(!home&&!away)continue;
      rows.push({...m,team1Id:home?t.id:null,team2Id:away?t.id:null,source:'OpenFootball deterministic'});
    }
  }catch{}
  return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,30);
}

async function deterministicApi(team,date){
  const t=target(team?.name);if(!t)return [];
  team.id=t.id;
  const raw=[];
  for(const path of [`/fixtures?team=${t.id}&last=40&timezone=Europe/Istanbul`,`/fixtures?team=${t.id}&season=2025&timezone=Europe/Istanbul`,`/fixtures?team=${t.id}&season=2024&timezone=Europe/Istanbul`]){
    try{const a=await apiFootball(path);if(Array.isArray(a))raw.push(...a);}catch{}
  }
  const out=[],seen=new Set();
  for(const r of raw){
    try{
      const m=normalizeApiFootballHistoryMatch(r);
      if(!m||!completed(m)||String(m.date||'')>=date)continue;
      if(Number(m.team1Id)!==t.id&&Number(m.team2Id)!==t.id)continue;
      const k=`${m.date}|${m.team1Id}|${m.team2Id}`;if(seen.has(k))continue;seen.add(k);out.push(m);
    }catch{}
  }
  return out.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,30);
}

const stableBuild=window.buildFixtureHistory;
window.buildFixtureHistory=async function(fixture){
  let base;
  try{base=await stableBuild(fixture);}catch(e){base={matches:[],sources:[],errors:[String(e?.message||e)]};}
  const date=String(fixture.fixture?.date||'').slice(0,10);
  const h=fixture.teams.home,a=fixture.teams.away;
  const ht=target(h.name),at=target(a.name);
  if(!ht&&!at)return base;
  if(ht)h.id=ht.id;if(at)a.id=at.id;
  const groups=[base.matches||[]],sources=[...(base.sources||[])],errors=[...(base.errors||[])];
  let merged=mergeMatches(...groups);
  let hc=lastMatches(h.name,h.id,merged,date).length,ac=lastMatches(a.name,a.id,merged,date).length;
  const [hd,ad]=await Promise.all([ht&&hc<5?deterministicDomestic(h,date):[],at&&ac<5?deterministicDomestic(a,date):[]]);
  if(hd.length){groups.push(hd);sources.push(`Doğrudan La Liga geçmişi ${h.name} (${hd.length})`);}
  if(ad.length){groups.push(ad);sources.push(`Doğrudan Serie A geçmişi ${a.name} (${ad.length})`);}
  merged=mergeMatches(...groups);
  hc=lastMatches(h.name,h.id,merged,date).length;ac=lastMatches(a.name,a.id,merged,date).length;
  const [ha,aa]=await Promise.all([ht&&hc<2?deterministicApi(h,date):[],at&&ac<2?deterministicApi(a,date):[]]);
  if(ha.length){groups.push(ha);sources.push(`API-Football ID ${h.id} (${ha.length})`);}
  if(aa.length){groups.push(aa);sources.push(`API-Football ID ${a.id} (${aa.length})`);}
  merged=mergeMatches(...groups);
  return {matches:merged,sources:[...new Set(sources)],errors};
};

window.addEventListener('DOMContentLoaded',()=>{
  document.title=`GoalGrid ${VERSION}`;
  const s=document.querySelector('.subtitle');if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;
});
})();