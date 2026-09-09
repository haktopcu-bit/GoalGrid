(()=>{
'use strict';
const VERSION='V1.12.3';
const TEAM_CACHE='goalgrid_uefa_teamhist_v1123_';

function isUefa(f){
  const id=Number(f?.league?.id);
  const n=String(f?.league?.name||'').toLowerCase();
  return [2,3,848].includes(id)||n.includes('champions league')||n.includes('europa league')||n.includes('conference league');
}

function readTeamCache(id){
  try{
    const x=JSON.parse(localStorage.getItem(TEAM_CACHE+id)||'null');
    if(x&&Date.now()-Number(x.time||0)<12*60*60*1000&&Array.isArray(x.matches))return x.matches;
  }catch{}
  return null;
}
function writeTeamCache(id,matches){
  try{localStorage.setItem(TEAM_CACHE+id,JSON.stringify({time:Date.now(),matches}));}catch{}
}

async function directHistory(team,date){
  const id=Number(team?.id);
  if(!id)return [];
  const cached=readTeamCache(id);
  if(cached)return cached.filter(m=>String(m.date||'')<date).slice(0,20);

  let raw=[];
  try{raw=await apiFootball(`/fixtures?team=${id}&last=20&timezone=Europe/Istanbul`);}catch(e){return [];}
  const out=[],seen=new Set();
  for(const r of (raw||[])){
    try{
      const m=normalizeApiFootballHistoryMatch(r);
      if(!m||!completed(m)||String(m.date||'')>=date)continue;
      if(Number(m.team1Id)!==id&&Number(m.team2Id)!==id)continue;
      const k=`${m.date}|${m.team1Id}|${m.team2Id}`;
      if(seen.has(k))continue;
      seen.add(k);
      out.push(m);
    }catch{}
  }
  out.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  writeTeamCache(id,out);
  return out.slice(0,20);
}

const previousBuild=window.buildFixtureHistory;
window.buildFixtureHistory=async function(fixture){
  if(!isUefa(fixture))return previousBuild(fixture);

  const date=String(fixture.fixture?.date||'').slice(0,10);
  const h=fixture.teams?.home||{},a=fixture.teams?.away||{};
  let base={matches:[],sources:[],errors:[]};
  try{base=await previousBuild(fixture);}catch(e){base.errors.push(`Önceki geçmiş katmanı: ${e?.message||e}`);}

  const groups=[base.matches||[]];
  const sources=[...(base.sources||[])];
  const errors=[...(base.errors||[])];
  let merged=mergeMatches(...groups);
  let hc=lastMatches(h.name,h.id,merged,date).length;
  let ac=lastMatches(a.name,a.id,merged,date).length;

  /* UEFA maçlarında fikstür zaten API-Football takım ID'lerini taşıyor.
     İsim eşleştirmesine güvenmeden takım ID'siyle doğrudan son 20 maçı al. */
  if(hc<5||ac<5){
    const [hh,aa]=await Promise.all([
      hc<5?directHistory(h,date):Promise.resolve([]),
      ac<5?directHistory(a,date):Promise.resolve([])
    ]);
    if(hh.length){groups.push(hh);sources.push(`UEFA doğrudan ID geçmişi ${h.name} (${hh.length})`);}
    if(aa.length){groups.push(aa);sources.push(`UEFA doğrudan ID geçmişi ${a.name} (${aa.length})`);}
  }

  merged=mergeMatches(...groups);
  hc=lastMatches(h.name,h.id,merged,date).length;
  ac=lastMatches(a.name,a.id,merged,date).length;
  if(hc<2||ac<2)errors.push(`UEFA V1.12.3: ${h.name} ${hc} maç, ${a.name} ${ac} maç`);
  return {matches:merged,sources:[...new Set(sources)],errors};
};

window.addEventListener('DOMContentLoaded',()=>{
  document.title=`GoalGrid ${VERSION}`;
  const s=document.querySelector('.subtitle');if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;
});
})();