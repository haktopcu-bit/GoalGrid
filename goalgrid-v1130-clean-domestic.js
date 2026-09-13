(()=>{
'use strict';

const VERSION='V1.13.0';
const CACHE='goalgrid_clean_domestic_v1130_';

function norm(v){return String(v||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function isUefa(f){const id=Number(f?.league?.id),n=norm(f?.league?.name);return [2,3,848].includes(id)||/champions league|europa league|conference league/.test(n);}
function excluded(f){const n=norm(`${f?.league?.name||''} ${f?.league?.country||''}`);return n.includes('caf')||n.includes('africa champions')||n.includes('confederation cup')||/(^| )(u19|under 19|u21|under 21)( |$)/.test(n)||n.includes('premier league 2')||n.includes('professional development league')||n.includes('rfef')||n.includes('primera federacion')||n.includes('segunda federacion');}
function is2Bundesliga(f){const id=Number(f?.league?.id),n=norm(f?.league?.name);return id===79||n.includes('2 bundesliga')||n.includes('bundesliga 2');}
function finished(m){return !!(m?.score?.ft&&Array.isArray(m.score.ft)&&m.score.ft.length>=2&&Number.isFinite(Number(m.score.ft[0]))&&Number.isFinite(Number(m.score.ft[1])));}
function count(team,rows,date){try{return lastMatches(team.name,team.id,rows,date).length;}catch{return 0;}}

const oldWanted=window.wantedFixture;
if(typeof oldWanted==='function')window.wantedFixture=function(f){if(excluded(f))return false;if(is2Bundesliga(f))return new Date(f?.fixture?.date||'').getTime()>Date.now();return oldWanted(f);};

async function directApi(team,date){
  if(!team?.id)return[];
  const key=CACHE+'api_'+team.id;
  try{const c=JSON.parse(localStorage.getItem(key)||'null');if(c&&Date.now()-c.time<3*60*60*1000&&Array.isArray(c.rows))return c.rows.filter(x=>String(x.date||'')<date);}catch{}
  try{
    const raw=await apiFootball(`/fixtures?team=${encodeURIComponent(team.id)}&last=25&timezone=Europe/Istanbul`);
    const rows=(raw||[]).map(normalizeApiFootballHistoryMatch).filter(m=>finished(m)&&String(m.date||'')<date&&((Number(m.team1Id)===Number(team.id))||(Number(m.team2Id)===Number(team.id))));
    rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    try{localStorage.setItem(key,JSON.stringify({time:Date.now(),rows}));}catch{}
    return rows;
  }catch{return[];}
}

async function directSofa(team,date){
  if(!team?.name)return[];
  const key=CACHE+'sofa_'+norm(team.name).replace(/\s+/g,'_');
  let payload=null;
  try{const c=JSON.parse(localStorage.getItem(key)||'null');if(c&&Date.now()-c.time<2*60*60*1000)payload=c.payload;}catch{}
  if(!payload){
    try{
      const r=await fetch(`/sofa-history?team=${encodeURIComponent(team.name)}&id=${encodeURIComponent(team.id||'')}&v=1130`,{cache:'no-store'});
      payload=await r.json();
      if(!r.ok||!payload?.ok||!Array.isArray(payload.matches))return[];
      try{localStorage.setItem(key,JSON.stringify({time:Date.now(),payload}));}catch{}
    }catch{return[];}
  }
  return (payload.matches||[]).filter(m=>finished(m)&&String(m.date||'')<date).map(m=>m.subjectSide==='home'?{...m,team1Id:Number(team.id),team2Id:m.sofaAwayId??null,source:'Sofascore'}:m.subjectSide==='away'?{...m,team1Id:m.sofaHomeId??null,team2Id:Number(team.id),source:'Sofascore'}:m);
}

async function domesticBuild(fixture){
  const date=String(fixture?.fixture?.date||'').slice(0,10),h=fixture?.teams?.home,a=fixture?.teams?.away;
  if(!h||!a)return null;
  const cfg=competitionConfig(fixture),groups=[],sources=[],errors=[];
  if(cfg?.of){try{const rows=await loadOpenFootball(cfg.of);if(rows.length){groups.push(rows);sources.push(`OpenFootball ${cfg.name} (${rows.length})`);}}catch(e){errors.push(`OpenFootball: ${e.message}`);}}
  if(cfg?.fd){try{const rows=await loadFootballData(cfg.fd);if(rows.length){groups.push(rows);sources.push(`football-data.org (${rows.length})`);}}catch(e){errors.push(`football-data.org: ${e.message}`);}}
  let merged=mergeMatches(...groups),hc=count(h,merged,date),ac=count(a,merged,date);

  const [ha,aa]=await Promise.all([directApi(h,date),directApi(a,date)]);
  if(ha.length){groups.push(ha);sources.push(`API-Football ${h.name} (${ha.length})`);}
  if(aa.length){groups.push(aa);sources.push(`API-Football ${a.name} (${aa.length})`);}
  merged=mergeMatches(...groups);hc=count(h,merged,date);ac=count(a,merged,date);

  const [hs,as]=await Promise.all([directSofa(h,date),directSofa(a,date)]);
  if(hs.length){groups.push(hs);sources.push(`Sofascore ${h.name} (${hs.length})`);}
  if(as.length){groups.push(as);sources.push(`Sofascore ${a.name} (${as.length})`);}
  merged=mergeMatches(...groups);hc=count(h,merged,date);ac=count(a,merged,date);

  return {matches:merged,sources:[...new Set(sources)],errors,counts:{home:hc,away:ac}};
}

const oldBuild=window.buildFixtureHistory;
window.buildFixtureHistory=async function(fixture){
  if(isUefa(fixture))return oldBuild(fixture);
  const clean=await domesticBuild(fixture);
  if(clean&&clean.counts.home>=1&&clean.counts.away>=1)return clean;
  try{
    const old=await oldBuild(fixture);
    const merged=mergeMatches(clean?.matches||[],old?.matches||[]);
    const date=String(fixture?.fixture?.date||'').slice(0,10);
    const hc=count(fixture.teams.home,merged,date),ac=count(fixture.teams.away,merged,date);
    return {matches:merged,sources:[...new Set([...(clean?.sources||[]),...(old?.sources||[]),`Temiz veri doğrulama ${hc}/${ac}`])],errors:[...(clean?.errors||[]),...(old?.errors||[])]};
  }catch{return clean||{matches:[],sources:[],errors:['Geçmiş veri kaynakları yanıt vermedi.']};}
};

window.addEventListener('DOMContentLoaded',()=>{document.title=`GoalGrid ${VERSION}`;const s=document.querySelector('.subtitle');if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;});
})();