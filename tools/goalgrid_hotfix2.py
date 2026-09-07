from pathlib import Path

index_path=Path('index.html')
data_path=Path('functions/data.js')
s=index_path.read_text(encoding='utf-8')
d=data_path.read_text(encoding='utf-8')

# V1.9.4: stop depending on API-Football team-history for UEFA when free sources exist.
s=s.replace('GoalGrid V1.9.3','GoalGrid V1.9.4').replace('Futbol Karar Motoru • V1.9.3','Futbol Karar Motoru • V1.9.4')

# Add domestic OpenFootball sources used by UEFA teams.
marker='''    belcika: {\n      dosya: "be.1.json",\n      sezonlar: ["2026-27", "2025-26"]\n    }\n  };'''
replacement='''    belcika: {\n      dosya: "be.1.json",\n      sezonlar: ["2026-27", "2025-26"]\n    },\n\n    avusturya: {\n      dosya: "at.1.json",\n      sezonlar: ["2026-27", "2025-26"]\n    },\n\n    yunanistan: {\n      dosya: "gr.1.json",\n      sezonlar: ["2026-27", "2025-26"]\n    },\n\n    portekiz: {\n      dosya: "pt.1.json",\n      sezonlar: ["2026-27", "2025-26"]\n    }\n  };'''
if marker in d:
    d=d.replace(marker,replacement,1)

# Extra common alias that was visible as a failure in Championship.
s=s.replace('''  astonvillafc:"astonvilla",\n  astonvilla:"astonvilla"''','''  astonvillafc:"astonvilla",\n  astonvilla:"astonvilla",\n  sheffieldutd:"sheffieldunited",\n  sheffieldunited:"sheffieldunited",\n  fcporto:"porto",\n  porto:"porto",\n  aekathen:"aekathens"''',1)

# Global domestic history sources. They are cached by loadOpenFootball, so after first UEFA game this is cheap.
insert_after='''const EUROPE_NAMES = [\n  "champions league",\n  "uefa champions league",\n  "europa league",\n  "uefa europa league",\n  "conference league",\n  "uefa conference league",\n  "europa conference league"\n];'''
addition='''const EUROPE_NAMES = [\n  "champions league",\n  "uefa champions league",\n  "europa league",\n  "uefa europa league",\n  "conference league",\n  "uefa conference league",\n  "europa conference league"\n];\n\nconst UEFA_HISTORY_OPENFOOTBALL = [\n  "premierleague","championship","bundesliga","seriea","laliga","ligue1",\n  "eredivisie","superlig","belcika","avusturya","yunanistan","portekiz"\n];'''
if 'const UEFA_HISTORY_OPENFOOTBALL' not in s:
    assert insert_after in s, 'EUROPE_NAMES block not found'
    s=s.replace(insert_after,addition,1)

# Hard reject every domestic cup before any league-ID/name acceptance, while keeping UEFA club competitions.
start=s.index('function wantedFixture(fixture){')
end=s.index('\n\nfunction competitionConfig',start)
old=s[start:end]
new='''function wantedFixture(fixture){\n\n  const leagueId = Number(fixture.league?.id);\n  const leagueName = plain(fixture.league?.name);\n  const country = plain(fixture.league?.country);\n\n  // UEFA club competitions are explicitly allowed.\n  if([2,3,848].includes(leagueId) || includesAny(leagueName,EUROPE_NAMES)){\n    return true;\n  }\n\n  // Everything that is a domestic/national cup is rejected before league matching.\n  const cupWords=[\n    "cup","copa","coppa","coupe","pokal","beker","trophy","shield",\n    "supercup","super cup","supercopa","supercoppa","trophee","schaal"\n  ];\n  if(includesAny(leagueName,cupWords)){\n    return false;\n  }\n\n  if([88,89].includes(leagueId)){\n    return true;\n  }\n\n  if(BASE_LEAGUES[fixture.league?.id]){\n    return true;\n  }\n\n  const rule=COUNTRY_RULES[country];\n  if(!rule) return false;\n  if(includesAny(leagueName,rule.cups)) return false;\n  return includesAny(leagueName,rule.leagues);\n}'''
s=s[:start]+new+s[end:]

# Replace UEFA history building completely: use domestic league pools first, then API only if still short.
start=s.index('async function buildFixtureHistory(')
end=s.index('\n\nfunction analyseFixture(',start)
new_func='''async function buildFixtureHistory(\n  fixture\n){\n  const config=competitionConfig(fixture);\n  const groups=[];\n  const sources=[];\n  const errors=[];\n  const leagueId=Number(fixture.league?.id);\n  const leagueName=plain(fixture.league?.name);\n  const isUefa=[2,3,848].includes(leagueId) || includesAny(leagueName,EUROPE_NAMES);\n\n  if(config.fd){\n    try{\n      const fd=await loadFootballData(config.fd);\n      if(fd.length){groups.push(fd);sources.push(`football-data.org (${fd.length})`);}\n    }catch(error){errors.push("football-data.org: "+error.message);}\n  }\n\n  if(config.of){\n    try{\n      const of=await loadOpenFootball(config.of);\n      if(of.length){groups.push(of);sources.push(`OpenFootball ${config.name} (${of.length})`);}\n    }catch(error){errors.push("OpenFootball: "+error.message);}\n  }\n\n  // UEFA fixtures need each club's DOMESTIC form, not only previous UEFA games.\n  // Load all supported domestic leagues; loadOpenFootball caches every dataset locally.\n  if(isUefa){\n    const settled=await Promise.allSettled(UEFA_HISTORY_OPENFOOTBALL.map(code=>loadOpenFootball(code)));\n    let added=0;\n    settled.forEach((result,i)=>{\n      if(result.status==="fulfilled" && result.value.length){\n        groups.push(result.value);\n        added+=result.value.length;\n      }else if(result.status==="rejected"){\n        errors.push(`OpenFootball ${UEFA_HISTORY_OPENFOOTBALL[i]}: ${result.reason?.message||result.reason}`);\n      }\n    });\n    if(added) sources.push(`OpenFootball Avrupa lig havuzu (${added})`);\n  }\n\n  // Check actual usable team matches after the domestic pool has been merged.\n  const targetDate=String(fixture.fixture?.date||"").slice(0,10);\n  let merged=mergeMatches(...groups);\n  let homeCount=lastMatches(fixture.teams.home.name,fixture.teams.home.id,merged,targetDate).length;\n  let awayCount=lastMatches(fixture.teams.away.name,fixture.teams.away.id,merged,targetDate).length;\n\n  // API-Football is only a final fallback. Free-plan errors never erase the free-source history.\n  if(homeCount<2 || awayCount<2){\n    try{\n      const [homeHistory,awayHistory]=await Promise.all([\n        homeCount<2 ? loadTeamHistory(fixture.teams.home.id) : Promise.resolve([]),\n        awayCount<2 ? loadTeamHistory(fixture.teams.away.id) : Promise.resolve([])\n      ]);\n      if(homeHistory.length){groups.push(homeHistory);sources.push(`API-Football ${fixture.teams.home.name} (${homeHistory.length})`);}\n      if(awayHistory.length){groups.push(awayHistory);sources.push(`API-Football ${fixture.teams.away.name} (${awayHistory.length})`);}\n    }catch(error){\n      errors.push("API-Football takım geçmişi: "+error.message);\n    }\n  }\n\n  return{matches:mergeMatches(...groups),sources,errors};\n}'''
s=s[:start]+new_func+s[end:]

index_path.write_text(s,encoding='utf-8')
data_path.write_text(d,encoding='utf-8')
print('GoalGrid V1.9.4 applied: UEFA domestic history pool + hard domestic cup exclusion')
