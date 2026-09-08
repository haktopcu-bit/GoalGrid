(()=>{
  'use strict';

  const VERSION='V1.11.8';

  const CLUBS={
    realmadrid:{display:'Real Madrid CF',apiId:541,league:'laliga',aliases:['realmadrid','realmadridcf','real madrid','real madrid cf']},
    inter:{display:'FC Internazionale Milano',apiId:505,league:'seriea',aliases:['inter','intermilan','inter milan','internazionale','internazionalemilano','internazionale milano','fcinternazionale','fcinternazionalemilano','fc internazionale milano']},
    lille:{display:'Lille OSC',apiId:79,league:'ligue1',aliases:['lille','lilleosc','losc','losclille','lille osc','losc lille']},
    realbetis:{display:'Real Betis Balompié',apiId:543,league:'laliga',aliases:['betis','realbetis','realbetisbalompie','real betis','real betis balompie','real betis balompié']},
    borussiadortmund:{display:'Borussia Dortmund',apiId:165,league:'bundesliga',aliases:['dortmund','borussiadortmund','bvbdortmund','borussia dortmund','bvb dortmund']},
    villarreal:{display:'Villarreal CF',apiId:533,league:'laliga',aliases:['villarreal','villarrealcf','villarreal cf']},
    manchestercity:{display:'Manchester City',apiId:50,league:'premierleague',aliases:['manchestercity','manchestercityfc','mancity','manchester city','manchester city fc']},
    manchesterunited:{display:'Manchester United',apiId:33,league:'premierleague',aliases:['manchesterunited','manchesterunitedfc','manutd','manchester united','manchester united fc']}
  };

  function norm(v){return String(v||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'').replace(/^(fc|cf|ac|sc|fk|sk)/,'').replace(/(fc|cf|ac|sc|fk|sk)$/,'');}
  const aliasMap=new Map();
  Object.entries(CLUBS).forEach(([key,c])=>{[key,c.display,...c.aliases].forEach(a=>aliasMap.set(norm(a),key));});
  function clubKey(name){const n=norm(name);return aliasMap.get(n)||n;}
  function club(name){return CLUBS[clubKey(name)]||null;}
  function exactSame(a,b){const x=clubKey(a),y=clubKey(b);return !!x&&!!y&&x===y;}

  window.sameTeamName=exactSame;
  window.sameTeam=function(targetName,targetId,matchName,matchId){
    const ti=targetId!==null&&targetId!==undefined&&targetId!=='';
    const mi=matchId!==null&&matchId!==undefined&&matchId!=='';
    if(ti&&mi) return Number(targetId)===Number(matchId);
    return exactSame(targetName,matchName);
  };

  function fixTeam(team){
    if(!team)return;
    const c=club(team.name);
    if(!c)return;
    team.name=c.display;
    team.id=c.apiId;
  }

  function usableForTeam(m,team,date){
    return completed(m)&&String(m.date||'')<date&&(window.sameTeam(team.name,team.id,m.team1,m.team1Id)||window.sameTeam(team.name,team.id,m.team2,m.team2Id));
  }

  async function domesticHistory(team,date){
    const c=club(team?.name);
    if(!c?.league)return [];
    try{
      const arr=await loadOpenFootball(c.league);
      return (arr||[]).filter(m=>usableForTeam(m,team,date)).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,30);
    }catch{return [];}
  }

  async function directApiHistory(team,date){
    if(!team?.id)return [];
    const raw=[];
    try{raw.push(...await apiFootball(`/fixtures?team=${team.id}&last=40&timezone=Europe/Istanbul`));}catch{}
    for(const season of [2026,2025,2024]){
      try{raw.push(...await apiFootball(`/fixtures?team=${team.id}&season=${season}&timezone=Europe/Istanbul`));}catch{}
    }
    const out=[];const seen=new Set();
    for(const r of raw){
      try{
        const m=normalizeApiFootballHistoryMatch(r);
        if(!m||!usableForTeam(m,team,date))continue;
        const k=[m.date,m.team1Id||clubKey(m.team1),m.team2Id||clubKey(m.team2)].join('|');
        if(seen.has(k))continue;seen.add(k);out.push(m);
      }catch{}
    }
    return out.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,40);
  }

  const oldBuild=window.buildFixtureHistory;
  if(typeof oldBuild==='function'){
    window.buildFixtureHistory=async function(fixture){
      fixTeam(fixture.teams?.home);fixTeam(fixture.teams?.away);
      const date=String(fixture.fixture?.date||'').slice(0,10);
      let base;
      try{base=await oldBuild(fixture);}catch(e){base={matches:[],sources:[],errors:[e?.message||String(e)]};}
      const groups=[base.matches||[]],sources=[...(base.sources||[])],errors=[...(base.errors||[])];
      const h=fixture.teams.home,a=fixture.teams.away;
      let merged=mergeMatches(...groups);
      let hc=lastMatches(h.name,h.id,merged,date).length,ac=lastMatches(a.name,a.id,merged,date).length;

      const [hd,ad]=await Promise.all([hc<8?domesticHistory(h,date):[],ac<8?domesticHistory(a,date):[]]);
      if(hd.length){groups.push(hd);sources.push(`OpenFootball ${h.name} yerel lig (${hd.length})`);}
      if(ad.length){groups.push(ad);sources.push(`OpenFootball ${a.name} yerel lig (${ad.length})`);}
      merged=mergeMatches(...groups);
      hc=lastMatches(h.name,h.id,merged,date).length;ac=lastMatches(a.name,a.id,merged,date).length;

      const [ha,aa]=await Promise.all([hc<5?directApiHistory(h,date):[],ac<5?directApiHistory(a,date):[]]);
      if(ha.length){groups.push(ha);sources.push(`API-Football ${h.name} doğrudan (${ha.length})`);}
      if(aa.length){groups.push(aa);sources.push(`API-Football ${a.name} doğrudan (${aa.length})`);}
      merged=mergeMatches(...groups);
      hc=lastMatches(h.name,h.id,merged,date).length;ac=lastMatches(a.name,a.id,merged,date).length;
      if(hc<2||ac<2)errors.push(`V1.11.8 eşleşme: ${h.name}=${hc}, ${a.name}=${ac}`);
      return{matches:merged,sources:[...new Set(sources)],errors};
    };
  }

  window.addEventListener('DOMContentLoaded',()=>{
    document.title=`GoalGrid ${VERSION}`;
    const sub=document.querySelector('.subtitle');if(sub)sub.textContent=`Futbol Karar Motoru • ${VERSION}`;
  });
})();