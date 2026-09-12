(()=>{
'use strict';

const VERSION='V1.12.8';
const SOFA_CACHE='goalgrid_sofa_identity_v1128_';

function norm(v){
  return String(v||'').toLocaleLowerCase('tr').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/\b(football club|futbol club|fc|cf|afc|ac|sc|sv|vfb|rc|ssc|as|fk|sk|1)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function compact(v){return norm(v).replace(/\s+/g,'');}
function tokens(v){return norm(v).split(' ').filter(x=>x.length>2);}
function fuzzySame(a,b){
  const x=compact(a),y=compact(b);
  if(!x||!y)return false;
  if(x===y)return true;
  if(x.length>=5&&y.includes(x))return true;
  if(y.length>=5&&x.includes(y))return true;
  const A=tokens(a),B=tokens(b);
  if(!A.length||!B.length)return false;
  let hit=0;for(const t of A)if(B.includes(t))hit++;
  return hit/Math.min(A.length,B.length)>=0.67;
}

function isUefa(f){
  const id=Number(f?.league?.id),n=norm(f?.league?.name||'');
  return [2,3,848].includes(id)||n.includes('champions league')||n.includes('europa league')||n.includes('conference league');
}
function excluded(f){
  const league=norm(f?.league?.name||''),country=norm(f?.league?.country||'');
  const all=`${league} ${country}`;
  if(all.includes('caf')) return true;
  if(league.includes('africa champions league')||league.includes('african champions league')||league.includes('confederation cup')) return true;
  return false;
}
const oldWanted=window.wantedFixture;
if(typeof oldWanted==='function'){
  window.wantedFixture=function(f){
    if(excluded(f))return false;
    return oldWanted(f);
  };
}

function stampRows(rows,team,date,source){
  const id=team?.id??null;
  const out=[];
  for(const m of rows||[]){
    if(!m?.team1||!m?.team2||!m?.score?.ft||String(m.date||'')>=date)continue;
    const h=fuzzySame(team.name,m.team1),a=fuzzySame(team.name,m.team2);
    if(!h&&!a)continue;
    out.push({...m,team1Id:h?id:(m.team1Id??null),team2Id:a?id:(m.team2Id??null),source:source||m.source});
  }
  return out;
}

async function sofa(team,date){
  const key=SOFA_CACHE+compact(team?.name||'');
  try{
    const c=JSON.parse(localStorage.getItem(key)||'null');
    if(c&&Date.now()-c.time<6*60*60*1000&&Array.isArray(c.rows))return stampRows(c.rows,team,date,'Sofascore kimlikli geçmiş');
  }catch{}
  try{
    const r=await fetch(`/sofa-history?team=${encodeURIComponent(team.name)}`,{cache:'no-store'});
    const j=await r.json();
    if(!r.ok||!j?.ok||!Array.isArray(j.matches))return[];
    try{localStorage.setItem(key,JSON.stringify({time:Date.now(),rows:j.matches}));}catch{}
    return stampRows(j.matches,team,date,'Sofascore kimlikli geçmiş');
  }catch{return[];}
}

function count(team,rows,date){
  try{return lastMatches(team.name,team.id,rows,date).length;}catch{return 0;}
}

const oldBuild=window.buildFixtureHistory;
if(typeof oldBuild==='function'){
  window.buildFixtureHistory=async function(fixture){
    let base;
    try{base=await oldBuild(fixture);}catch(e){base={matches:[],sources:[],errors:[String(e?.message||e)]};}
    if(isUefa(fixture))return base;

    const date=String(fixture?.fixture?.date||'').slice(0,10);
    const h=fixture?.teams?.home,a=fixture?.teams?.away;
    if(!h||!a)return base;
    let merged=mergeMatches(base.matches||[]);
    const sources=[...(base.sources||[])],errors=[...(base.errors||[])];
    let hc=count(h,merged,date),ac=count(a,merged,date);

    if(hc<5||ac<5){
      const [hs,as]=await Promise.all([hc<5?sofa(h,date):[],ac<5?sofa(a,date):[]]);
      if(hs.length){merged=mergeMatches(merged,hs);sources.push(`Sofascore kimlikli ${h.name} (${hs.length})`);}
      if(as.length){merged=mergeMatches(merged,as);sources.push(`Sofascore kimlikli ${a.name} (${as.length})`);}
      hc=count(h,merged,date);ac=count(a,merged,date);
    }

    if(hc<2||ac<2)errors.push(`V1.12.8 kimlik kontrolü: ${h.name}=${hc}, ${a.name}=${ac}`);
    return {matches:merged,sources:[...new Set(sources)],errors};
  };
}

/* V1.12.6 market change sonrası sınıfı da final pazara göre yeniden hesapla. */
const oldAnalyse=window.analyseFixture;
if(typeof oldAnalyse==='function'){
  window.analyseFixture=function(...args){
    const a=oldAnalyse.apply(this,args);
    if(a?.homeForm&&a?.mainProbability!=null&&typeof grade==='function'){
      const g=grade(a.score,a.quality,a.mainProbability);
      if(Array.isArray(g)){a.grade=g[0];a.gradeClass=g[1];}
      if(a.grade==='OYNAMA'&&typeof noReason==='function')a.noReason=noReason(a.mainProbability,a.score,a.quality);
      else a.noReason='';
    }
    return a;
  };
}

window.addEventListener('DOMContentLoaded',()=>{
  document.title=`GoalGrid ${VERSION}`;
  const s=document.querySelector('.subtitle');if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;
});
})();
