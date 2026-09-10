(()=>{
'use strict';
const VERSION='V1.12.5';
const OF_CODES=['premierleague','championship','bundesliga','seriea','laliga','ligue1','eredivisie','eerstedivisie','superlig','tff1','belcika','avusturya','yunanistan','portekiz'];
const POOL_KEY='goalgrid_uefa_clean_pool_v1125';
const API_KEY='goalgrid_uefa_clean_api_v1125_';

function isUefa(f){const id=Number(f?.league?.id);const n=String(f?.league?.name||'').toLowerCase();return [2,3,848].includes(id)||n.includes('champions league')||n.includes('europa league')||n.includes('conference league');}
function norm(v){return String(v||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\b(fc|cf|ac|sc|afc|fk|sk|club|football|futbol|calcio)\b/g,' ').replace(/\s+/g,' ').trim();}
const A={
 'bayern munchen':'bayern','bayern munich':'bayern','bayern':'bayern',
 'rb leipzig':'rbleipzig','rasenballsport leipzig':'rbleipzig','leipzig':'rbleipzig',
 'como 1907':'como','como':'como',
 'manchester united':'manutd','man united':'manutd','man utd':'manutd',
 'manchester city':'mancity','man city':'mancity',
 'rc lens':'lens','lens':'lens',
 'bodo glimt':'bodoglimt','bodo/glimt':'bodoglimt','bodoe glimt':'bodoglimt',
 'sabah fa':'sabah','sabah':'sabah',
 'slavia praha':'slaviapraha','slavia prague':'slaviapraha',
 'real madrid':'realmadrid','real madrid cf':'realmadrid',
 'inter':'inter','inter milan':'inter','internazionale':'inter','internazionale milano':'inter','fc internazionale milano':'inter',
 'lille':'lille','lille osc':'lille','losc':'lille','losc lille':'lille',
 'real betis':'betis','real betis balompie':'betis','betis':'betis',
 'borussia dortmund':'dortmund','bvb dortmund':'dortmund','dortmund':'dortmund',
 'borussia monchengladbach':'gladbach','monchengladbach':'gladbach','gladbach':'gladbach'
};
function canon(v){const n=norm(v);return A[n]||n.replace(/\s+/g,'');}
function same(a,b){const x=canon(a),y=canon(b);if(!x||!y)return false;if(x===y)return true;return false;}
function done(m){return !!(m?.score&&Array.isArray(m.score.ft)&&m.score.ft.length>=2&&Number.isFinite(Number(m.score.ft[0]))&&Number.isFinite(Number(m.score.ft[1])));}
function syntheticId(name){let h=0;const s=canon(name);for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return -1000000000-Math.abs(h||1);}
function stamp(m,team,sid){const h=same(team.name,m.team1),a=same(team.name,m.team2);if(!h&&!a)return null;return {...m,team1Id:h?sid:(m.team1Id??null),team2Id:a?sid:(m.team2Id??null)};}

async function pool(){
 try{const x=JSON.parse(localStorage.getItem(POOL_KEY)||'null');if(x&&Date.now()-x.time<24*60*60*1000&&Array.isArray(x.rows))return x.rows;}catch{}
 const sets=await Promise.all(OF_CODES.map(async c=>{try{const r=await fetch(`/data?league=${encodeURIComponent(c)}&v=1125`,{cache:'no-store'});if(!r.ok)return[];const j=await r.json();return (j.maclar||[]).map(m=>({...m,team1Id:null,team2Id:null,source:`OpenFootball ${c}`}));}catch{return[];}}));
 const rows=sets.flat();try{localStorage.setItem(POOL_KEY,JSON.stringify({time:Date.now(),rows}));}catch{}return rows;
}
function readApi(id){try{const x=JSON.parse(localStorage.getItem(API_KEY+id)||'null');if(x&&Date.now()-x.time<24*60*60*1000&&Array.isArray(x.rows))return x.rows;}catch{}return null;}
async function apiRows(team,actualId,date,sid){
 if(!actualId)return[];const cached=readApi(actualId);if(cached)return cached.filter(m=>String(m.date||'')<date).map(m=>stamp(m,team,sid)).filter(Boolean);
 let raw=[];try{raw=await apiFootball(`/fixtures?team=${actualId}&last=20&timezone=Europe/Istanbul`);}catch{return[];}
 const out=[],seen=new Set();for(const r of raw||[]){try{const m=normalizeApiFootballHistoryMatch(r);if(!m||!done(m)||String(m.date||'')>=date)continue;if(Number(m.team1Id)!==Number(actualId)&&Number(m.team2Id)!==Number(actualId))continue;const k=`${m.date}|${m.team1Id}|${m.team2Id}`;if(seen.has(k))continue;seen.add(k);out.push(m);}catch{}}
 out.sort((a,b)=>String(b.date).localeCompare(String(a.date)));try{localStorage.setItem(API_KEY+actualId,JSON.stringify({time:Date.now(),rows:out}));}catch{}
 return out.map(m=>stamp(m,team,sid)).filter(Boolean);
}

window.buildFixtureHistory=async function(fixture){
 if(!isUefa(fixture)){
   /* Reconstruct the stable non-UEFA behavior from the original sources without
      invoking the older UEFA patch chain. */
   const cfg=competitionConfig(fixture),groups=[],sources=[],errors=[];
   if(cfg.fd){try{const x=await loadFootballData(cfg.fd);if(x.length){groups.push(x);sources.push(`football-data.org (${x.length})`);}}catch(e){errors.push(String(e?.message||e));}}
   if(cfg.of){try{const x=await loadOpenFootball(cfg.of);if(x.length){groups.push(x);sources.push(`OpenFootball ${cfg.name} (${x.length})`);}}catch(e){errors.push(String(e?.message||e));}}
   return {matches:mergeMatches(...groups),sources,errors};
 }
 const date=String(fixture.fixture?.date||'').slice(0,10),h=fixture.teams.home,a=fixture.teams.away;
 const hApi=Number(h.id)||null,aApi=Number(a.id)||null,hSid=syntheticId(h.name),aSid=syntheticId(a.name);
 const p=await pool();
 let hr=p.filter(m=>done(m)&&String(m.date||'')<date&&(same(h.name,m.team1)||same(h.name,m.team2))).map(m=>stamp(m,h,hSid)).filter(Boolean).sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0,20);
 let ar=p.filter(m=>done(m)&&String(m.date||'')<date&&(same(a.name,m.team1)||same(a.name,m.team2))).map(m=>stamp(m,a,aSid)).filter(Boolean).sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0,20);
 if(hr.length<5){const x=await apiRows(h,hApi,date,hSid);hr=mergeMatches(hr,x).sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0,20);}
 if(ar.length<5){const x=await apiRows(a,aApi,date,aSid);ar=mergeMatches(ar,x).sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0,20);}
 h._goalgridApiId=hApi;a._goalgridApiId=aApi;h.id=hSid;a.id=aSid;
 return {matches:mergeMatches(hr,ar),sources:[`UEFA temiz geçmiş ${h.name} (${hr.length})`,`UEFA temiz geçmiş ${a.name} (${ar.length})`],errors:(hr.length<2||ar.length<2)?[`UEFA V1.12.5: ${h.name}=${hr.length}, ${a.name}=${ar.length}`]:[]};
};

window.addEventListener('DOMContentLoaded',()=>{document.title=`GoalGrid ${VERSION}`;const s=document.querySelector('.subtitle');if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;});
})();