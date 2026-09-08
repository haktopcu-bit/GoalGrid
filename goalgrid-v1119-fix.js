(()=>{
'use strict';
const VERSION='V1.11.9';
const IDS={
  realmadrid:541,realmadridcf:541,
  inter:505,intermilan:505,internazionale:505,internazionalemilano:505,fcinternazionale:505,fcinternazionalemilano:505,
  lille:79,lilleosc:79,losc:79,losclille:79,
  betis:543,realbetis:543,realbetisbalompie:543
};
function n(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'').replace(/^(fc|cf|ac|sc)/,'').replace(/(fc|cf|ac|sc)$/,'');}
function fixedId(name){return IDS[n(name)]||null;}

/* Critical fix: API-Football IDs are provider-specific. If a history row comes
   from OpenFootball/football-data it has no API ID, so name fallback is valid.
   If BOTH sides have API-Football IDs they must match. */
const priorSameName=window.sameTeamName;
window.sameTeam=function(targetName,targetId,matchName,matchId){
  const ti=targetId!==null&&targetId!==undefined&&targetId!=='';
  const mi=matchId!==null&&matchId!==undefined&&matchId!=='';
  if(ti&&mi) return Number(targetId)===Number(matchId);
  return typeof priorSameName==='function'?priorSameName(targetName,matchName):n(targetName)===n(matchName);
};

async function guaranteedHistory(team,date){
  const id=fixedId(team?.name)||team?.id;
  if(!id)return [];
  team.id=id;
  const raw=[];
  const paths=[
    `/fixtures?team=${id}&last=50&timezone=Europe/Istanbul`,
    `/fixtures?team=${id}&season=2025&timezone=Europe/Istanbul`,
    `/fixtures?team=${id}&season=2024&timezone=Europe/Istanbul`
  ];
  for(const p of paths){try{const a=await apiFootball(p);if(Array.isArray(a))raw.push(...a);}catch{}}
  const out=[],seen=new Set();
  for(const r of raw){
    try{
      const m=normalizeApiFootballHistoryMatch(r);
      if(!m||!completed(m)||String(m.date||'')>=date)continue;
      const contains=Number(m.team1Id)===Number(id)||Number(m.team2Id)===Number(id);
      if(!contains)continue;
      const k=`${m.date}|${m.team1Id}|${m.team2Id}`;
      if(seen.has(k))continue;seen.add(k);out.push(m);
    }catch{}
  }
  return out.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,30);
}

const oldBuild=window.buildFixtureHistory;
window.buildFixtureHistory=async function(fixture){
  const date=String(fixture.fixture?.date||'').slice(0,10);
  const h=fixture.teams.home,a=fixture.teams.away;
  const hid=fixedId(h.name),aid=fixedId(a.name);
  if(hid)h.id=hid;if(aid)a.id=aid;
  let base;
  try{base=await oldBuild(fixture);}catch(e){base={matches:[],sources:[],errors:[String(e?.message||e)]};}
  const groups=[base.matches||[]],sources=[...(base.sources||[])],errors=[...(base.errors||[])];
  let merged=mergeMatches(...groups);
  let hc=lastMatches(h.name,h.id,merged,date).length,ac=lastMatches(a.name,a.id,merged,date).length;
  if(hc<5||ac<5){
    const [hh,aa]=await Promise.all([hc<5?guaranteedHistory(h,date):[],ac<5?guaranteedHistory(a,date):[]]);
    if(hh.length){groups.push(hh);sources.push(`API-Football ID ${h.id} ${h.name} (${hh.length})`);}
    if(aa.length){groups.push(aa);sources.push(`API-Football ID ${a.id} ${a.name} (${aa.length})`);}
  }
  merged=mergeMatches(...groups);
  hc=lastMatches(h.name,h.id,merged,date).length;ac=lastMatches(a.name,a.id,merged,date).length;
  if(hc<2||ac<2)errors.push(`V1.11.9 DEBUG ${h.name}[${h.id}]=${hc}; ${a.name}[${a.id}]=${ac}`);
  return {matches:merged,sources:[...new Set(sources)],errors};
};

window.addEventListener('DOMContentLoaded',()=>{
 document.title=`GoalGrid ${VERSION}`;
 const s=document.querySelector('.subtitle');if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;
});
})();