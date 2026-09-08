(()=>{
'use strict';
const VERSION='V1.11.3';
const CODES=['premierleague','championship','bundesliga','laliga','seriea','ligue1','eredivisie','eerstedivisie','superlig','tff1','belcika','avusturya','yunanistan','portekiz'];
const cache=new Map();
function ascii(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\b(fc|cf|ac|sc|fk|sk|club)\b/g,' ').replace(/\s+/g,' ').trim()}
function key(v){return ascii(v).replace(/\s+/g,'')}
function same(a,b){const x=key(a),y=key(b);if(!x||!y)return false;if(x===y)return true;if(x.length>=5&&y.includes(x))return true;if(y.length>=5&&x.includes(y))return true;const A=ascii(a).split(' ').filter(x=>x.length>2),B=ascii(b).split(' ').filter(x=>x.length>2);const c=A.filter(x=>B.includes(x)).length;return c>=1&&c/Math.min(A.length||1,B.length||1)>=.5}
async function league(code){if(cache.has(code))return cache.get(code);const p=fetch('/data?league='+encodeURIComponent(code),{cache:'no-store'}).then(async r=>{if(!r.ok)return[];const j=await r.json();return(j.maclar||[]).map(m=>({...m,team1Id:null,team2Id:null,source:'OpenFootball'}));}).catch(()=>[]);cache.set(code,p);return p}
async function domestic(team){const sets=await Promise.all(CODES.map(league));return sets.flat().filter(m=>m?.score?.ft&&m.date&&(same(team,m.team1)||same(team,m.team2))).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,30)}
const previous=window.buildFixtureHistory;
window.buildFixtureHistory=async function(f){
 const base=await previous(f);const date=String(f.fixture?.date||'').slice(0,10);let all=mergeMatches(base.matches||[]);let hc=lastMatches(f.teams.home.name,f.teams.home.id,all,date).length,ac=lastMatches(f.teams.away.name,f.teams.away.id,all,date).length;const sources=[...(base.sources||[])],errors=[...(base.errors||[])];
 if(hc<8||ac<8){const [h,a]=await Promise.all([hc<8?domestic(f.teams.home.name):[],ac<8?domestic(f.teams.away.name):[]]);if(h.length){all=mergeMatches(all,h);sources.push('Yerel lig geçmişi '+f.teams.home.name+' ('+h.length+')')}if(a.length){all=mergeMatches(all,a);sources.push('Yerel lig geçmişi '+f.teams.away.name+' ('+a.length+')')}}
 hc=lastMatches(f.teams.home.name,f.teams.home.id,all,date).length;ac=lastMatches(f.teams.away.name,f.teams.away.id,all,date).length;if(hc<2||ac<2)errors.push('Yerel lig fallback: '+f.teams.home.name+' '+hc+', '+f.teams.away.name+' '+ac);return{matches:all,sources:[...new Set(sources)],errors};
};
window.addEventListener('DOMContentLoaded',()=>{document.title='GoalGrid '+VERSION;const s=document.querySelector('.subtitle');if(s)s.textContent='Futbol Karar Motoru • '+VERSION;});
})();
