(()=>{
'use strict';
const VERSION='V1.12.4';
const OF_CODES=['premierleague','championship','bundesliga','seriea','laliga','ligue1','eredivisie','eerstedivisie','superlig','tff1','belcika','avusturya','yunanistan','portekiz'];
const POOL_CACHE='goalgrid_uefa_pool_v1124';
const TEAM_CACHE='goalgrid_uefa_api_v1124_';

function isUefa(f){const id=Number(f?.league?.id);const n=String(f?.league?.name||'').toLowerCase();return [2,3,848].includes(id)||n.includes('champions league')||n.includes('europa league')||n.includes('conference league');}
function norm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\b(fc|cf|ac|sc|afc|fk|sk|club|calcio|football|futbol)\b/g,' ').replace(/\s+/g,' ').trim();}
const aliases={
 'inter':'internazionale milano','inter milan':'internazionale milano','internazionale':'internazionale milano','fc internazionale milano':'internazionale milano',
 'real madrid cf':'real madrid','real madrid':'real madrid',
 'lille osc':'lille','losc lille':'lille','losc':'lille','lille':'lille',
 'real betis balompie':'real betis','real betis':'real betis','betis':'real betis',
 'man city':'manchester city','manchester city':'manchester city','man utd':'manchester united','manchester united':'manchester united',
 'borussia dortmund':'dortmund','bvb dortmund':'dortmund','borussia monchengladbach':'monchengladbach','borussia m gladbach':'monchengladbach','gladbach':'monchengladbach'
};
function canon(v){const n=norm(v);return aliases[n]||n;}
function words(v){return canon(v).split(' ').filter(x=>x.length>2);}
function sameLoose(a,b){
 const x=canon(a),y=canon(b);if(!x||!y)return false;if(x===y)return true;
 const A=words(a),B=words(b);if(!A.length||!B.length)return false;
 const common=A.filter(t=>B.includes(t));
 if(common.length>=2&&common.length/Math.min(A.length,B.length)>=.66)return true;
 if(A.length===1&&B.length===1&&A[0]===B[0]&&A[0].length>=5)return true;
 return false;
}
function completedRow(m){return !!(m?.score&&Array.isArray(m.score.ft)&&m.score.ft.length>=2&&Number.isFinite(Number(m.score.ft[0]))&&Number.isFinite(Number(m.score.ft[1])));}
function stampForTeam(m,team){
 if(!m||!team?.name)return null;const id=team?.id??null;
 const h=sameLoose(team.name,m.team1),a=sameLoose(team.name,m.team2);
 if(!h&&!a)return null;
 return {...m,team1Id:h?id:(m.team1Id??null),team2Id:a?id:(m.team2Id??null)};
}
async function loadPool(){
 try{const x=JSON.parse(localStorage.getItem(POOL_CACHE)||'null');if(x&&Date.now()-x.time<12*60*60*1000&&Array.isArray(x.rows))return x.rows;}catch{}
 const sets=await Promise.all(OF_CODES.map(async code=>{try{const r=await fetch(`/data?league=${encodeURIComponent(code)}&v=1124`,{cache:'no-store'});if(!r.ok)return[];const j=await r.json();return (j.maclar||[]).map(m=>({...m,team1Id:null,team2Id:null,source:`OpenFootball ${code}`}));}catch{return[];}}));
 const rows=sets.flat();try{localStorage.setItem(POOL_CACHE,JSON.stringify({time:Date.now(),rows}));}catch{}return rows;
}
async function resolveId(team){
 if(team?.id)return team.id;
 try{const arr=await apiFootball(`/teams?search=${encodeURIComponent(team?.name||'')}`);const hit=(arr||[]).find(x=>sameLoose(team?.name,x.team?.name))||(arr||[])[0];if(hit?.team?.id){team.id=hit.team.id;return team.id;}}catch{}
 return null;
}
function readTeam(id){try{const x=JSON.parse(localStorage.getItem(TEAM_CACHE+id)||'null');if(x&&Date.now()-x.time<12*60*60*1000&&Array.isArray(x.rows))return x.rows;}catch{}return null;}
async function apiHistory(team,date){
 const id=await resolveId(team);if(!id)return[];const cached=readTeam(id);if(cached)return cached.filter(m=>String(m.date||'')<date);
 const raw=[];for(const path of [`/fixtures?team=${id}&last=30&timezone=Europe/Istanbul`,`/fixtures?team=${id}&season=2026&timezone=Europe/Istanbul`,`/fixtures?team=${id}&season=2025&timezone=Europe/Istanbul`]){try{const a=await apiFootball(path);if(Array.isArray(a))raw.push(...a);}catch{}}
 const out=[],seen=new Set();for(const r of raw){try{const m=normalizeApiFootballHistoryMatch(r);if(!m||!completedRow(m)||String(m.date||'')>=date)continue;if(Number(m.team1Id)!==Number(id)&&Number(m.team2Id)!==Number(id))continue;const k=`${m.date}|${m.team1Id}|${m.team2Id}`;if(seen.has(k))continue;seen.add(k);out.push(m);}catch{}}
 out.sort((a,b)=>String(b.date).localeCompare(String(a.date)));try{localStorage.setItem(TEAM_CACHE+id,JSON.stringify({time:Date.now(),rows:out}));}catch{}return out;
}
function count(team,all,date){try{return lastMatches(team.name,team.id,all,date).length;}catch{return 0;}}

const previousBuild=window.buildFixtureHistory;
window.buildFixtureHistory=async function(fixture){
 if(!isUefa(fixture))return previousBuild(fixture);
 const date=String(fixture.fixture?.date||'').slice(0,10),h=fixture.teams.home,a=fixture.teams.away;
 await Promise.all([resolveId(h),resolveId(a)]);
 let base={matches:[],sources:[],errors:[]};try{base=await previousBuild(fixture);}catch(e){base.errors=[`Önceki katman: ${e?.message||e}`];}
 const groups=[base.matches||[]],sources=[...(base.sources||[])],errors=[...(base.errors||[])];
 let merged=mergeMatches(...groups),hc=count(h,merged,date),ac=count(a,merged,date);

 /* First, use the no-quota domestic pool and stamp the UEFA fixture team ID onto
    matching rows. This makes the existing strict lastMatches() accept them. */
 const pool=await loadPool();
 if(hc<5){const rows=pool.filter(m=>completedRow(m)&&String(m.date||'')<date).map(m=>stampForTeam(m,h)).filter(Boolean).sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0,20);if(rows.length){groups.push(rows);sources.push(`UEFA yerel havuz ${h.name} (${rows.length})`);}}
 if(ac<5){const rows=pool.filter(m=>completedRow(m)&&String(m.date||'')<date).map(m=>stampForTeam(m,a)).filter(Boolean).sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0,20);if(rows.length){groups.push(rows);sources.push(`UEFA yerel havuz ${a.name} (${rows.length})`);}}
 merged=mergeMatches(...groups);hc=count(h,merged,date);ac=count(a,merged,date);

 /* Teams from unsupported domestic leagues still get direct API-ID history. */
 if(hc<5||ac<5){const [hh,aa]=await Promise.all([hc<5?apiHistory(h,date):[],ac<5?apiHistory(a,date):[]]);if(hh.length){groups.push(hh);sources.push(`UEFA API-ID ${h.name} (${hh.length})`);}if(aa.length){groups.push(aa);sources.push(`UEFA API-ID ${a.name} (${aa.length})`);}}
 merged=mergeMatches(...groups);hc=count(h,merged,date);ac=count(a,merged,date);
 if(hc<2||ac<2)errors.push(`UEFA V1.12.4 eşleşme: ${h.name}=${hc}, ${a.name}=${ac}`);
 return {matches:merged,sources:[...new Set(sources)],errors};
};

window.addEventListener('DOMContentLoaded',()=>{document.title=`GoalGrid ${VERSION}`;const s=document.querySelector('.subtitle');if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;});
})();