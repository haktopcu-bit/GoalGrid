(()=>{
'use strict';
const VERSION='V1.12.0';

const CLUBS={
  realmadrid:{display:'Real Madrid CF',apiId:541,aliases:['real madrid','real madrid cf','realmadrid','realmadridcf']},
  inter:{display:'FC Internazionale Milano',apiId:505,aliases:['inter','inter milan','internazionale','internazionale milano','fc internazionale','fc internazionale milano','fcinternazionale','fcinternazionalemilano']},
  lille:{display:'Lille OSC',apiId:79,aliases:['lille','lille osc','losc','losc lille']},
  realbetis:{display:'Real Betis Balompié',apiId:543,aliases:['betis','real betis','real betis balompie','real betis balompié']},
  cardiff:{aliases:['cardiff','cardiff city','cardiff city fc']},
  stoke:{aliases:['stoke','stoke city','stoke city fc']},
  southampton:{aliases:['southampton','southampton fc']},
  swansea:{aliases:['swansea','swansea city','swansea city afc']},
  watford:{aliases:['watford','watford fc']},
  preston:{aliases:['preston','preston north end','preston north end fc']},
  wrexham:{aliases:['wrexham','wrexham afc']},
  burnley:{aliases:['burnley','burnley fc']},
  bolton:{aliases:['bolton','bolton wanderers','bolton wanderers fc']},
  westham:{aliases:['west ham','west ham united','west ham united fc']},
  dortmund:{aliases:['dortmund','borussia dortmund','bvb dortmund']},
  gladbach:{aliases:['borussia monchengladbach','borussia mönchengladbach','borussia gladbach','monchengladbach','mönchengladbach','gladbach']},
  mancity:{aliases:['manchester city','man city','manchester city fc']},
  manutd:{aliases:['manchester united','man utd','manchester united fc']}
};
function raw(v){return String(v||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'').replace(/^(fc|afc|cf|ac|sc|fk|sk)/,'').replace(/(fc|afc|cf|ac|sc|fk|sk)$/,'');}
const amap=new Map();
Object.entries(CLUBS).forEach(([k,c])=>{[k,c.display,...(c.aliases||[])].filter(Boolean).forEach(a=>amap.set(raw(a),k));});
function key(name){const r=raw(name);return amap.get(r)||r;}
function sameName(a,b){const x=key(a),y=key(b);return !!x&&!!y&&x===y;}
window.sameTeamName=sameName;
window.sameTeam=function(targetName,targetId,matchName,matchId){
  const ti=targetId!==null&&targetId!==undefined&&targetId!=='';
  const mi=matchId!==null&&matchId!==undefined&&matchId!=='';
  if(ti&&mi)return Number(targetId)===Number(matchId);
  return sameName(targetName,matchName);
};

function club(name){return CLUBS[key(name)]||null;}
function normalizeDisplay(team){const c=club(team?.name);if(c?.display)team.name=c.display;if(c?.apiId)team.id=c.apiId;}
function isUefa(f){const id=Number(f?.league?.id);const n=plain(f?.league?.name||'');return [2,3,848].includes(id)||n.includes('champions league')||n.includes('europa league')||n.includes('conference league');}
function configs(f){
  const id=Number(f?.league?.id);
  if(isUefa(f)) return {of:['premierleague','championship','bundesliga','seriea','laliga','ligue1','eredivisie','superlig','belcika','avusturya','yunanistan','portekiz'],fd:['PL','ELC','BL1','SA','PD','FL1','DED','PPL']};
  const map={39:{of:['premierleague'],fd:['PL']},40:{of:['championship'],fd:['ELC']},78:{of:['bundesliga'],fd:['BL1']},135:{of:['seriea'],fd:['SA']},140:{of:['laliga'],fd:['PD']},61:{of:['ligue1'],fd:['FL1']},88:{of:['eredivisie'],fd:['DED']},89:{of:['eerstedivisie'],fd:[]},203:{of:['superlig'],fd:[]},204:{of:['tff1'],fd:[]},144:{of:['belcika'],fd:[]},94:{of:['portekiz'],fd:['PPL']}};
  return map[id]||{of:[],fd:[]};
}
async function resolveId(team){
  if(team?.id)return team.id;
  const c=club(team?.name);if(c?.apiId){team.id=c.apiId;return team.id;}
  const qs=[team?.name].filter(Boolean);
  for(const q of qs){try{const arr=await apiFootball(`/teams?search=${encodeURIComponent(q)}`);const hit=(arr||[]).find(x=>sameName(q,x.team?.name||''))||(arr||[])[0];if(hit?.team?.id){team.id=hit.team.id;return team.id;}}catch{}}
  return null;
}
async function apiHist(team,date){
  const id=await resolveId(team);if(!id)return [];
  const rawRows=[];
  for(const p of [`/fixtures?team=${id}&last=40&timezone=Europe/Istanbul`,`/fixtures?team=${id}&season=2025&timezone=Europe/Istanbul`,`/fixtures?team=${id}&season=2024&timezone=Europe/Istanbul`,`/fixtures?team=${id}&season=2023&timezone=Europe/Istanbul`]){
    try{const a=await apiFootball(p);if(Array.isArray(a))rawRows.push(...a);}catch{}
  }
  const seen=new Set(),out=[];
  for(const r of rawRows){try{const m=normalizeApiFootballHistoryMatch(r);if(!m||!completed(m)||String(m.date||'')>=date)continue;if(Number(m.team1Id)!==Number(id)&&Number(m.team2Id)!==Number(id))continue;const k=`${m.date}|${m.team1Id}|${m.team2Id}`;if(seen.has(k))continue;seen.add(k);out.push(m);}catch{}}
  return out.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,40);
}

window.buildFixtureHistory=async function(fixture){
  normalizeDisplay(fixture.teams.home);normalizeDisplay(fixture.teams.away);
  const date=String(fixture.fixture?.date||'').slice(0,10);
  const cfg=configs(fixture),groups=[],sources=[],errors=[];
  const settledOF=await Promise.allSettled(cfg.of.map(c=>loadOpenFootball(c)));
  settledOF.forEach((r,i)=>{if(r.status==='fulfilled'&&r.value?.length){groups.push(r.value);sources.push(`OpenFootball ${cfg.of[i]} (${r.value.length})`);}else if(r.status==='rejected')errors.push(`OpenFootball ${cfg.of[i]}: ${r.reason?.message||r.reason}`);});
  const settledFD=await Promise.allSettled(cfg.fd.map(c=>loadFootballData(c)));
  settledFD.forEach((r,i)=>{if(r.status==='fulfilled'&&r.value?.length){groups.push(r.value);sources.push(`football-data.org ${cfg.fd[i]} (${r.value.length})`);}else if(r.status==='rejected')errors.push(`football-data.org ${cfg.fd[i]}: ${r.reason?.message||r.reason}`);});
  let merged=mergeMatches(...groups);
  const h=fixture.teams.home,a=fixture.teams.away;
  let hc=lastMatches(h.name,h.id,merged,date).length,ac=lastMatches(a.name,a.id,merged,date).length;
  if(hc<5||ac<5){
    const [hh,aa]=await Promise.all([hc<5?apiHist(h,date):[],ac<5?apiHist(a,date):[]]);
    if(hh.length){groups.push(hh);sources.push(`API-Football ${h.name} (${hh.length})`);}
    if(aa.length){groups.push(aa);sources.push(`API-Football ${a.name} (${aa.length})`);}
  }
  merged=mergeMatches(...groups);
  hc=lastMatches(h.name,h.id,merged,date).length;ac=lastMatches(a.name,a.id,merged,date).length;
  if(hc<2||ac<2)errors.push(`V1.12.0 eşleşme sayısı: ${h.name}=${hc}, ${a.name}=${ac}`);
  return {matches:merged,sources:[...new Set(sources)],errors};
};

/* Correct the generic no-data wording too; Championship is not a European cup. */
const oldNoData=window.noDataAnalysis;
window.noDataAnalysis=function(fixture,reason,sources=[]){
  const a=oldNoData(fixture,reason,sources);
  if(a)a.reason=reason||'Bu iki takım için yeterli geçmiş maç verisi bulunamadı.';
  return a;
};
const oldCard=window.matchCard;
window.matchCard=function(a,index){
  const html=oldCard(a,index);
  if(a?.homeForm)return html;
  const box=document.createElement('div');box.innerHTML=html;
  const reason=box.querySelector('.reasonNo');
  if(reason){const h=a?.historyCounts?.home??0,d=a?.historyCounts?.away??0;reason.textContent=`Yeterli geçmiş maç eşleşmedi. Eşleşen geçmiş: ev sahibi ${h}, deplasman ${d}.`}
  return box.innerHTML;
};
window.addEventListener('DOMContentLoaded',()=>{document.title=`GoalGrid ${VERSION}`;const s=document.querySelector('.subtitle');if(s)s.textContent=`Futbol Karar Motoru • ${VERSION}`;});
})();