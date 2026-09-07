from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('GoalGrid V1.9.9','GoalGrid V1.10.0').replace('Futbol Karar Motoru • V1.9.9','Futbol Karar Motoru • V1.10.0')

start=s.find('async function loadSofaHistory(teamName){')
end=s.find('\n\nfunction mergeMatches(...groups){',start)
if start!=-1 and end!=-1:
    s=s[:start]+s[end+2:]

start=s.find('function sameTeamName(a,b){')
end=s.find('\n\nfunction sameTeam(',start)
assert start!=-1 and end!=-1
new=r'''function sameTeamName(a,b){
  const x=teamKey(a);
  const y=teamKey(b);
  if(!x || !y) return false;
  if(x===y) return true;
  if((x.length>=5 && y.includes(x)) || (y.length>=5 && x.includes(y))) return true;
  const stop=new Set(["fc","cf","ac","sc","fk","sk","club","de","del","the","city","united","utd"]);
  const tokens=v=>plain(v).replace(/[^a-z0-9 ]+/g," ").split(/\s+/).filter(t=>t.length>=3 && !stop.has(t));
  const tx=tokens(a), ty=tokens(b);
  if(!tx.length || !ty.length) return false;
  let common=0;
  tx.forEach(t=>{if(ty.includes(t)) common++;});
  if(common>=1 && common/Math.min(tx.length,ty.length)>=0.5) return true;
  return tx[0]===ty[0] && tx[0].length>=5;
}'''
s=s[:start]+new+s[end:]

start=s.find('async function loadTeamHistory(teamId){')
end=s.find('\n\nfunction normalizeFootballDataMatch',start)
assert start!=-1 and end!=-1
new=r'''async function loadTeamHistory(teamId){
  if(teamId===null || teamId===undefined || teamId==="") return [];
  const key="goalgrid_team_v110_"+teamId;
  try{
    const cached=localStorage.getItem(key);
    if(cached){
      const p=JSON.parse(cached);
      if(Date.now()-p.time < 60*60*1000) return p.matches || [];
    }
  }catch{}
  const fixtures=[];
  const errors=[];
  for(const season of [2024,2023]){
    try{
      const arr=await apiFootball(`/fixtures?team=${teamId}&season=${season}&timezone=Europe/Istanbul`);
      fixtures.push(...arr);
      if(fixtures.length>=20) break;
    }catch(e){ errors.push(`${season}: ${e.message}`); }
  }
  const matches=fixtures
    .filter(match=>{
      const ln=plain(match.league?.name);
      if(includesAny(ln,EUROPE_NAMES)) return true;
      if(ln.includes("friendly")) return false;
      const country=plain(match.league?.country);
      const rule=COUNTRY_RULES[country];
      if(rule && includesAny(ln,rule.cups)) return false;
      return true;
    })
    .map(normalizeApiFootballHistoryMatch)
    .filter(x=>x.team1 && x.team2 && completed(x))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)))
    .slice(0,30);
  try{localStorage.setItem(key,JSON.stringify({time:Date.now(),matches}));}catch{}
  if(!matches.length && errors.length) throw new Error(errors.join(" • "));
  return matches;
}'''
s=s[:start]+new+s[end:]

s=s.replace('goalgrid_fd_v181_','goalgrid_fd_v110_')
s=s.replace('goalgrid_of_v181_','goalgrid_of_v110_')
start=s.find('  // Universal fallback: resolve the team by name and fetch its recent completed matches.')
end=s.find('  // API-Football is only a final fallback.',start)
if start!=-1 and end!=-1:
    s=s[:start]+s[end:]
s=s.replace('// API-Football is only a final fallback. On Free plan this currently returns [].','// API-Football historical seasons (2024/2023) are the final fallback on the Free plan.')
s=s.replace('''\n\n          if(source.startsWith("Sofascore")){\n            return "Sofascore";\n          }''','')
p.write_text(s,encoding='utf-8')
print('GoalGrid V1.10.0: accessible API history fallback + robust name matching, Sofascore 403 removed')
# trigger-2
