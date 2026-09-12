(()=>{
'use strict';

const VERSION='V1.12.7';
const SOFA_CACHE='goalgrid_sofa_recovery_v1127_';

function plainText(v){
  return String(v||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}

function isUefa(f){
  const id=Number(f?.league?.id);
  const n=plainText(f?.league?.name||'');
  return [2,3,848].includes(id)||n.includes('champions league')||n.includes('europa league')||n.includes('conference league');
}

function isExcludedCompetition(f){
  const league=plainText(f?.league?.name||'');
  const country=plainText(f?.league?.country||'');
  const teams=plainText(`${f?.teams?.home?.name||''} ${f?.teams?.away?.name||''}`);
  const all=`${league} ${country} ${teams}`;

  if(/(^| )(u19|under 19)( |$)/.test(all)) return true;
  if(/(^| )(u21|under 21)( |$)/.test(all)) return true;
  if(league.includes('premier league 2')) return true;
  if(league.includes('professional development league')) return true;
  if(league.includes('rfef')||league.includes('primera federacion')||league.includes('primera federation')||league.includes('segunda federacion')||league.includes('segunda federation')) return true;
  return false;
}

function isSecondBundesliga(f){
  const id=Number(f?.league?.id);
  const n=plainText(f?.league?.name||'');
  return id===79||n==='2 bundesliga'||n.includes('2 bundesliga')||n.includes('bundesliga 2');
}

function notStarted(f){
  const d=new Date(f?.fixture?.date||'');
  return Number.isNaN(d.getTime())?true:d.getTime()>Date.now();
}

const previousWanted=window.wantedFixture;
if(typeof previousWanted==='function'){
  window.wantedFixture=function(fixture){
    if(isExcludedCompetition(fixture)) return false;
    if(isSecondBundesliga(fixture)) return notStarted(fixture);
    return previousWanted(fixture);
  };
}

async function sofaHistory(teamName,date){
  if(!teamName) return [];
  const key=SOFA_CACHE+plainText(teamName).replace(/\s+/g,'_');
  try{
    const cached=JSON.parse(localStorage.getItem(key)||'null');
    if(cached&&Date.now()-cached.time<6*60*60*1000&&Array.isArray(cached.rows)){
      return cached.rows.filter(m=>String(m.date||'')<date);
    }
  }catch{}

  try{
    const r=await fetch(`/sofa-history?team=${encodeURIComponent(teamName)}`,{cache:'no-store'});
    const j=await r.json();
    if(!r.ok||!j?.ok||!Array.isArray(j.matches)) return [];
    const rows=j.matches.filter(m=>m?.team1&&m?.team2&&m?.score?.ft&&String(m.date||'')<date)
      .map(m=>({...m,team1Id:null,team2Id:null,source:'Sofascore fallback'}));
    try{localStorage.setItem(key,JSON.stringify({time:Date.now(),rows}));}catch{}
    return rows;
  }catch{return [];}
}

async function teamApiHistory(team,date){
  if(!team?.id) return [];
  try{
    const rows=await loadTeamHistory(team.id);
    return (rows||[]).filter(m=>String(m.date||'')<date);
  }catch{return [];}
}

function countFor(team,rows,date){
  try{return lastMatches(team.name,team.id,rows,date).length;}catch{return 0;}
}

const previousBuild=window.buildFixtureHistory;
if(typeof previousBuild==='function'){
  window.buildFixtureHistory=async function(fixture){
    let base;
    try{base=await previousBuild(fixture);}catch(e){base={matches:[],sources:[],errors:[String(e?.message||e)]};}

    if(isUefa(fixture)) return base;

    const date=String(fixture?.fixture?.date||'').slice(0,10);
    const h=fixture?.teams?.home;
    const a=fixture?.teams?.away;
    if(!h||!a) return base;

    const groups=[base?.matches||[]];
    const sources=[...(base?.sources||[])];
    const errors=[...(base?.errors||[])];

    let merged=mergeMatches(...groups);
    let hc=countFor(h,merged,date);
    let ac=countFor(a,merged,date);

    /* V1.12.5 non-UEFA override had bypassed the previous fallback chain.
       Restore API-Football team history before declaring the match unusable. */
    if(hc<8||ac<8){
      const [hh,aa]=await Promise.all([
        hc<8?teamApiHistory(h,date):Promise.resolve([]),
        ac<8?teamApiHistory(a,date):Promise.resolve([])
      ]);
      if(hh.length){groups.push(hh);sources.push(`API-Football takım geçmişi ${h.name} (${hh.length})`);}
      if(aa.length){groups.push(aa);sources.push(`API-Football takım geçmişi ${a.name} (${aa.length})`);}
      merged=mergeMatches(...groups);
      hc=countFor(h,merged,date);
      ac=countFor(a,merged,date);
    }

    /* If provider IDs/names still fail to match, use independent team-name history. */
    if(hc<5||ac<5){
      const [hs,as]=await Promise.all([
        hc<5?sofaHistory(h.name,date):Promise.resolve([]),
        ac<5?sofaHistory(a.name,date):Promise.resolve([])
      ]);
      if(hs.length){groups.push(hs);sources.push(`Sofascore ${h.name} (${hs.length})`);}
      if(as.length){groups.push(as);sources.push(`Sofascore ${a.name} (${as.length})`);}
      merged=mergeMatches(...groups);
      hc=countFor(h,merged,date);
      ac=countFor(a,merged,date);
    }

    if(hc<2||ac<2){
      errors.push(`V1.12.7 geçmiş kontrolü: ${h.name}=${hc}, ${a.name}=${ac}`);
    }

    return {matches:merged,sources:[...new Set(sources)],errors};
  };
}

window.addEventListener('DOMContentLoaded',()=>{
  document.title=`GoalGrid ${VERSION}`;
  const s=document.querySelector('.subtitle');
  if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;
});
})();
