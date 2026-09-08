(()=>{
  'use strict';

  const VERSION='V1.11.6';
  const TEAM_ID_CACHE='goalgrid_teamid_v1116_';

  async function resolveTeamIdStrong(team){
    if(team?.id) return team.id;
    const name=team?.name||'';
    if(!name) return null;
    const key=TEAM_ID_CACHE+normalizeText(name);
    try{
      const cached=JSON.parse(localStorage.getItem(key)||'null');
      if(cached?.id) return cached.id;
    }catch{}
    try{
      const arr=await apiFootball(`/teams?search=${encodeURIComponent(name)}`);
      if(!arr?.length) return null;
      const exact=arr.find(x=>sameTeamName(name,x.team?.name||''));
      const best=exact||arr[0];
      const id=best?.team?.id??null;
      if(id){
        try{localStorage.setItem(key,JSON.stringify({id,name:best.team?.name||name,time:Date.now()}));}catch{}
      }
      return id;
    }catch{return null;}
  }

  function normalizeRecentFixture(match){
    try{
      const n=normalizeApiFootballHistoryMatch(match);
      return n&&completed(n)?n:null;
    }catch{return null;}
  }

  async function recentTeamHistory(team,date){
    const id=await resolveTeamIdStrong(team);
    if(!id) return [];
    team.id=id;
    try{
      const arr=await apiFootball(`/fixtures?team=${id}&last=30&timezone=Europe/Istanbul`);
      return (arr||[])
        .map(normalizeRecentFixture)
        .filter(Boolean)
        .filter(m=>String(m.date||'')<date)
        .slice(0,30);
    }catch{return [];}
  }

  const previousBuild=window.buildFixtureHistory;
  if(typeof previousBuild==='function'){
    window.buildFixtureHistory=async function(fixture){
      const date=String(fixture.fixture?.date||'').slice(0,10);
      const h=fixture.teams.home,a=fixture.teams.away;

      if(!h.id) h.id=await resolveTeamIdStrong(h);
      if(!a.id) a.id=await resolveTeamIdStrong(a);

      let base;
      try{base=await previousBuild(fixture);}catch(e){base={matches:[],sources:[],errors:[e.message||String(e)]};}
      const groups=[base.matches||[]];
      const sources=[...(base.sources||[])];
      const errors=[...(base.errors||[])];

      let merged=mergeMatches(...groups);
      let hc=lastMatches(h.name,h.id,merged,date).length;
      let ac=lastMatches(a.name,a.id,merged,date).length;

      if(hc<8||ac<8){
        const [hh,aa]=await Promise.all([
          hc<8?recentTeamHistory(h,date):Promise.resolve([]),
          ac<8?recentTeamHistory(a,date):Promise.resolve([])
        ]);
        if(hh.length){groups.push(hh);sources.push(`API-Football doğrudan takım geçmişi ${h.name} (${hh.length})`);}
        if(aa.length){groups.push(aa);sources.push(`API-Football doğrudan takım geçmişi ${a.name} (${aa.length})`);}
        merged=mergeMatches(...groups);
        hc=lastMatches(h.name,h.id,merged,date).length;
        ac=lastMatches(a.name,a.id,merged,date).length;
      }

      if(hc<2||ac<2){
        const codes=['PL','ELC','BL1','SA','PD','FL1','DED','PPL'];
        const settled=await Promise.allSettled(codes.map(code=>loadFootballData(code)));
        let added=0;
        settled.forEach((r,i)=>{
          if(r.status==='fulfilled'&&r.value?.length){groups.push(r.value);added+=r.value.length;}
          else if(r.status==='rejected') errors.push(`football-data.org ${codes[i]}: ${r.reason?.message||r.reason}`);
        });
        if(added) sources.push(`football-data.org geniş lig havuzu (${added})`);
      }

      merged=mergeMatches(...groups);
      hc=lastMatches(h.name,h.id,merged,date).length;
      ac=lastMatches(a.name,a.id,merged,date).length;
      if(hc<2||ac<2) errors.push(`Son fallback sonrası eşleşen geçmiş: ${h.name} ${hc}, ${a.name} ${ac}`);

      return {matches:merged,sources:[...new Set(sources)],errors};
    };
  }

  function applyCss(){
    if(document.querySelector('#goalgrid-v1116-style'))return;
    const style=document.createElement('style');
    style.id='goalgrid-v1116-style';
    style.textContent=`
      .lastFiveRow.lastFiveWin{
        background:#123b32 !important;
        border:1px solid #2f8f73 !important;
        box-shadow:inset 0 0 0 1px rgba(110,231,183,.08);
      }
      .lastFiveRow.lastFiveWin strong{color:#b9ffe3 !important;font-weight:950}
      .lastFiveRow b.winner{
        color:#f4fffb !important;
        background:#1f6a56 !important;
        border:1px solid #4bbf98 !important;
        border-radius:7px;
        padding:4px 6px !important;
        font-weight:950 !important;
      }
      .lastFiveRow.lastFiveDraw{background:#162335 !important}
      .lastFiveRow.lastFiveLoss{background:#291b24 !important}
    `;
    document.head.appendChild(style);
  }

  window.addEventListener('DOMContentLoaded',()=>{
    applyCss();
    document.title=`GoalGrid ${VERSION}`;
    const sub=document.querySelector('.subtitle');
    if(sub) sub.textContent=`Futbol Karar Motoru • ${VERSION}`;
  });
})();