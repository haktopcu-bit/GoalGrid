from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('GoalGrid V1.9.8','GoalGrid V1.9.9').replace('Futbol Karar Motoru • V1.9.8','Futbol Karar Motoru • V1.9.9')

s=s.replace('89:{name:"Eerste Divisie",fd:null,of:"eerstedivisie"}', '89:{name:"Eerste Divisie",fd:null,of:null}')
s=s.replace('204:{name:"Türkiye 1. Lig",fd:null,of:"tff1"}', '204:{name:"Türkiye 1. Lig",fd:null,of:null}')

needle='''  fcporto:"porto",\n  porto:"porto",\n  aekathen:"aekathens"'''
repl='''  fcporto:"porto",\n  porto:"porto",\n  aekathen:"aekathens",\n  celtavigo:"celtadevigo",\n  rcceltadevigo:"celtadevigo",\n  celtadevigo:"celtadevigo",\n  getafecf:"getafe",\n  getafe:"getafe"'''
assert needle in s
s=s.replace(needle,repl,1)

needle='<span class="source">OpenFootball</span>'
if needle in s and 'Sofascore • Takım geçmişi fallback' not in s:
    s=s.replace(needle,needle+'\n      <span class="source">Sofascore • Takım geçmişi fallback</span>',1)

needle='''function mergeMatches(...groups){'''
helper=r'''async function loadSofaHistory(teamName){
  if(!teamName) return [];
  const key="goalgrid_sofa_v199_"+teamKey(teamName);
  try{
    const cached=localStorage.getItem(key);
    if(cached){
      const p=JSON.parse(cached);
      if(Date.now()-p.time < 30*60*1000) return p.matches || [];
    }
  }catch{}
  const response=await fetch(`/sofa-history?team=${encodeURIComponent(teamName)}`,{cache:"no-store"});
  const json=await response.json();
  if(!response.ok || !json.ok) throw new Error(json.error || `Sofascore ${response.status}`);
  const matches=Array.isArray(json.matches)?json.matches:[];
  try{localStorage.setItem(key,JSON.stringify({time:Date.now(),matches}));}catch{}
  return matches;
}


'''
assert needle in s
s=s.replace(needle,helper+needle,1)

needle='''  // API-Football is only a final fallback. Free-plan errors never erase the free-source history.\n  if(homeCount<2 || awayCount<2){'''
repl='''  // Universal fallback for leagues/teams missing in the free historical datasets.\n  if(homeCount<2 || awayCount<2){\n    const sofa=await Promise.allSettled([\n      homeCount<2 ? loadSofaHistory(fixture.teams.home.name) : Promise.resolve([]),\n      awayCount<2 ? loadSofaHistory(fixture.teams.away.name) : Promise.resolve([])\n    ]);\n    if(sofa[0].status==="fulfilled" && sofa[0].value.length){groups.push(sofa[0].value);sources.push(`Sofascore ${fixture.teams.home.name} (${sofa[0].value.length})`);}\n    else if(sofa[0].status==="rejected") errors.push(`Sofascore ${fixture.teams.home.name}: ${sofa[0].reason?.message||sofa[0].reason}`);\n    if(sofa[1].status==="fulfilled" && sofa[1].value.length){groups.push(sofa[1].value);sources.push(`Sofascore ${fixture.teams.away.name} (${sofa[1].value.length})`);}\n    else if(sofa[1].status==="rejected") errors.push(`Sofascore ${fixture.teams.away.name}: ${sofa[1].reason?.message||sofa[1].reason}`);\n    merged=mergeMatches(...groups);\n    homeCount=lastMatches(fixture.teams.home.name,fixture.teams.home.id,merged,targetDate).length;\n    awayCount=lastMatches(fixture.teams.away.name,fixture.teams.away.id,merged,targetDate).length;\n  }\n\n  // API-Football is only a final fallback. On Free plan this currently returns [].\n  if(homeCount<2 || awayCount<2){'''
assert needle in s
s=s.replace(needle,repl,1)

needle='''          if(\n            source.startsWith(\n              "OpenFootball"\n            )\n          ){\n            return(\n              "OpenFootball"\n            );\n          }'''
repl=needle+'''\n\n          if(source.startsWith("Sofascore")){\n            return "Sofascore";\n          }'''
assert needle in s
s=s.replace(needle,repl,1)

p.write_text(s,encoding='utf-8')
print('GoalGrid V1.9.9 applied: universal recent-history fallback + La Liga name repair')
# trigger 2
