(()=>{
  'use strict';
  const normalizeCurrent=window.normalizeApiFootballHistoryMatch;
  window.loadTeamHistory=async function(teamId){
    if(teamId===null||teamId===undefined||teamId==='') return [];
    const key='goalgrid_team_v111_'+teamId;
    try{
      const cached=JSON.parse(localStorage.getItem(key)||'null');
      if(cached && Date.now()-cached.time<6*60*60*1000) return cached.matches||[];
    }catch{}
    const fixtures=[];
    for(const season of [2026,2025,2024,2023]){
      try{
        const arr=await apiFootball(`/fixtures?team=${teamId}&season=${season}&timezone=Europe/Istanbul`);
        fixtures.push(...arr);
        if(fixtures.length>=30) break;
      }catch{}
    }
    const cupWords=['cup','copa','coppa','coupe','pokal','beker','trophy','shield','supercup','super cup','supercopa','supercoppa','trophee','schaal'];
    const matches=fixtures
      .filter(match=>{
        const ln=plain(match.league?.name||'');
        if(includesAny(ln,EUROPE_NAMES)) return true;
        if(ln.includes('friendly')) return false;
        if(includesAny(ln,cupWords)) return false;
        return true;
      })
      .map(normalizeCurrent)
      .filter(x=>x?.team1&&x?.team2&&completed(x))
      .sort((a,b)=>String(b.date).localeCompare(String(a.date)))
      .slice(0,40);
    try{localStorage.setItem(key,JSON.stringify({time:Date.now(),matches}));}catch{}
    return matches;
  };
})();
