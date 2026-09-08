(()=>{
  'use strict';

  const VERSION='V1.11.7';

  const FULL_NAMES={
    lille:'Lille OSC',
    lilleosc:'Lille OSC',
    losc:'Lille OSC',
    betis:'Real Betis Balompié',
    realbetis:'Real Betis Balompié',
    realbetisbalompie:'Real Betis Balompié',
    realmadrid:'Real Madrid CF',
    realmadridcf:'Real Madrid CF',
    inter:'FC Internazionale Milano',
    internazionale:'FC Internazionale Milano',
    intermilano:'FC Internazionale Milano',
    fcinternazionale:'FC Internazionale Milano',
    fcinternazionalemilano:'FC Internazionale Milano',
    internazionalemilano:'FC Internazionale Milano',
    villarreal:'Villarreal CF',
    villarrealcf:'Villarreal CF',
    dortmund:'Borussia Dortmund',
    borussiadortmund:'Borussia Dortmund',
    bvbdortmund:'Borussia Dortmund'
  };

  const ALIAS={
    lille:'lille',lilleosc:'lille',losc:'lille',losclille:'lille',
    betis:'realbetis',realbetis:'realbetis',realbetisbalompie:'realbetis',
    realmadrid:'realmadrid',realmadridcf:'realmadrid',
    inter:'inter',internazionale:'inter',intermilano:'inter',fcinternazionale:'inter',fcinternazionalemilano:'inter',internazionalemilano:'inter',
    villarreal:'villarreal',villarrealcf:'villarreal',
    dortmund:'borussiadortmund',borussiadortmund:'borussiadortmund',bvbdortmund:'borussiadortmund',
    borussiamonchengladbach:'borussiamonchengladbach',borussiamgladbach:'borussiamonchengladbach',monchengladbach:'borussiamonchengladbach',gladbach:'borussiamonchengladbach',
    manchestercity:'manchestercity',manchestercityfc:'manchestercity',mancity:'manchestercity',
    manchesterunited:'manchesterunited',manchesterunitedfc:'manchesterunited',manutd:'manchesterunited'
  };

  function rawKey(name){
    return String(name||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'').replace(/^(fc|cf|ac|sc|fk|sk)/,'').replace(/(fc|cf|ac|sc|fk|sk)$/,'');
  }

  function canonical(name){
    const x=rawKey(name);
    return ALIAS[x]||x;
  }

  function exactSame(a,b){
    const x=canonical(a),y=canonical(b);
    return !!x&&!!y&&x===y;
  }

  window.sameTeamName=exactSame;
  window.sameTeam=function(targetName,targetId,matchName,matchId){
    const ti=targetId!==null&&targetId!==undefined&&targetId!=='';
    const mi=matchId!==null&&matchId!==undefined&&matchId!=='';
    if(ti&&mi) return Number(targetId)===Number(matchId);
    return exactSame(targetName,matchName);
  };

  function preferredName(name){
    const k=rawKey(name);
    return FULL_NAMES[k]||name;
  }

  async function resolveIdByFullName(team){
    if(team?.id) return team.id;
    const queries=[preferredName(team?.name||''),team?.name||''].filter((x,i,a)=>x&&a.indexOf(x)===i);
    for(const q of queries){
      try{
        const arr=await apiFootball(`/teams?search=${encodeURIComponent(q)}`);
        if(!arr?.length) continue;
        const hit=arr.find(x=>exactSame(q,x.team?.name||''))||arr.find(x=>exactSame(team?.name||'',x.team?.name||''))||arr[0];
        if(hit?.team?.id){team.id=hit.team.id;return team.id;}
      }catch{}
    }
    return null;
  }

  function normalizeFixture(m){
    try{
      const x=normalizeApiFootballHistoryMatch(m);
      return x&&completed(x)?x:null;
    }catch{return null;}
  }

  async function apiHistory(team,date){
    const id=await resolveIdByFullName(team);
    if(!id)return [];
    const groups=[];
    try{
      const arr=await apiFootball(`/fixtures?team=${id}&last=40&timezone=Europe/Istanbul`);
      groups.push(...(arr||[]));
    }catch{}
    for(const season of [2026,2025,2024]){
      try{
        const arr=await apiFootball(`/fixtures?team=${id}&season=${season}&timezone=Europe/Istanbul`);
        groups.push(...(arr||[]));
      }catch{}
    }
    const map=new Map();
    groups.map(normalizeFixture).filter(Boolean).filter(m=>String(m.date||'')<date).forEach(m=>{
      const k=[m.date,m.team1Id||canonical(m.team1),m.team2Id||canonical(m.team2)].join('|');
      if(!map.has(k))map.set(k,m);
    });
    return [...map.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,40);
  }

  const previousBuild=window.buildFixtureHistory;
  if(typeof previousBuild==='function'){
    window.buildFixtureHistory=async function(fixture){
      fixture.teams.home.name=preferredName(fixture.teams.home.name);
      fixture.teams.away.name=preferredName(fixture.teams.away.name);
      await Promise.all([resolveIdByFullName(fixture.teams.home),resolveIdByFullName(fixture.teams.away)]);

      let base;
      try{base=await previousBuild(fixture);}catch(e){base={matches:[],sources:[],errors:[e?.message||String(e)]};}
      const groups=[base.matches||[]];
      const sources=[...(base.sources||[])];
      const errors=[...(base.errors||[])];
      const date=String(fixture.fixture?.date||'').slice(0,10);
      const h=fixture.teams.home,a=fixture.teams.away;

      let merged=mergeMatches(...groups);
      let hc=lastMatches(h.name,h.id,merged,date).length;
      let ac=lastMatches(a.name,a.id,merged,date).length;

      if(hc<5||ac<5){
        const codes=['PL','ELC','BL1','SA','PD','FL1','DED','PPL'];
        const settled=await Promise.allSettled(codes.map(c=>loadFootballData(c)));
        settled.forEach((r,i)=>{
          if(r.status==='fulfilled'&&r.value?.length){groups.push(r.value);sources.push(`football-data.org ${codes[i]} (${r.value.length})`);}
        });
        merged=mergeMatches(...groups);
        hc=lastMatches(h.name,h.id,merged,date).length;
        ac=lastMatches(a.name,a.id,merged,date).length;
      }

      if(hc<5||ac<5){
        const [hh,aa]=await Promise.all([
          hc<5?apiHistory(h,date):Promise.resolve([]),
          ac<5?apiHistory(a,date):Promise.resolve([])
        ]);
        if(hh.length){groups.push(hh);sources.push(`API-Football ${h.name} (${hh.length})`);}
        if(aa.length){groups.push(aa);sources.push(`API-Football ${a.name} (${aa.length})`);}
      }

      merged=mergeMatches(...groups);
      hc=lastMatches(h.name,h.id,merged,date).length;
      ac=lastMatches(a.name,a.id,merged,date).length;
      if(hc<2||ac<2) errors.push(`V1.11.7 son eşleşme: ${h.name} ${hc}, ${a.name} ${ac}`);
      return {matches:merged,sources:[...new Set(sources)],errors};
    };
  }

  function applyCss(){
    if(document.querySelector('#goalgrid-v1117-style'))return;
    const style=document.createElement('style');
    style.id='goalgrid-v1117-style';
    style.textContent=`
      .lastFiveRow.lastFiveWin,
      .lastFiveRow.lastFiveDraw,
      .lastFiveRow.lastFiveLoss{
        background:transparent !important;
        border:0 !important;
        border-top:1px solid rgba(36,50,74,.6) !important;
        box-shadow:none !important;
      }
      .lastFiveRow:first-of-type{border-top:0 !important}
      .lastFiveRow strong{color:var(--text) !important}
      .lastFiveRow b.winner{
        color:#fff3b0 !important;
        background:rgba(252,211,77,.12) !important;
        border:1.5px solid rgba(252,211,77,.9) !important;
        box-shadow:0 0 0 1px rgba(252,211,77,.08) !important;
        border-radius:7px !important;
        padding:4px 6px !important;
        font-weight:950 !important;
      }
      .lastFiveRow b:not(.winner){background:transparent !important;border:0 !important;color:var(--text) !important;padding:0 !important}
    `;
    document.head.appendChild(style);
  }

  window.addEventListener('DOMContentLoaded',()=>{
    applyCss();
    document.title=`GoalGrid ${VERSION}`;
    const sub=document.querySelector('.subtitle');
    if(sub)sub.textContent=`Futbol Karar Motoru • ${VERSION}`;
  });
})();