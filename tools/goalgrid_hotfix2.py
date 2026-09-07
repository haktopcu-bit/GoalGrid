from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Apply on top of V1.9.2.
s=s.replace('GoalGrid V1.9.2','GoalGrid V1.9.3').replace('Futbol Karar Motoru • V1.9.2','Futbol Karar Motoru • V1.9.3')

# 1) Domestic/national cups must be rejected BEFORE substring league matching.
old='''  if(\n    BASE_LEAGUES[\n      fixture.league?.id\n    ]\n  ){\n    return true;\n  }\n\n\n  const rule =\n    COUNTRY_RULES[\n      country\n    ];\n\n\n  if(!rule){\n    return false;\n  }\n\n\n  if(\n    includesAny(\n      leagueName,\n      rule.leagues\n    )\n  ){\n    return true;\n  }\n\n\n  /* Ulusal kupa maçları GoalGrid bültenine alınmaz. */\n  if(\n    includesAny(\n      leagueName,\n      rule.cups\n    )\n  ){\n    return false;\n  }'''
new='''  /*\n    Ulusal kupa / genç kupa adlarını lig adı eşleşmesinden ÖNCE ele.\n    Örn. \"Premier League Cup\" içinde \"premier league\" geçtiği için\n    eski sırada yanlışlıkla lig sanılıyordu.\n  */\n  const domesticCupWords = [\n    "fa cup", "league cup", "premier league cup", "efl cup",\n    "community shield", "copa del rey", "supercopa",\n    "coppa italia", "supercoppa", "dfb pokal", "dfb-pokal",\n    "coupe de france", "trophee des champions",\n    "knvb beker", "johan cruijff schaal",\n    "turkiye kupasi", "türkiye kupası",\n    "belgian cup", "croky cup", "cup", "beker", "pokal", "copa", "coppa", "coupe"\n  ];\n\n  if(includesAny(leagueName, domesticCupWords)){\n    return false;\n  }\n\n  if(\n    BASE_LEAGUES[\n      fixture.league?.id\n    ]\n  ){\n    return true;\n  }\n\n\n  const rule =\n    COUNTRY_RULES[\n      country\n    ];\n\n\n  if(!rule){\n    return false;\n  }\n\n\n  if(\n    includesAny(\n      leagueName,\n      rule.cups\n    )\n  ){\n    return false;\n  }\n\n\n  if(\n    includesAny(\n      leagueName,\n      rule.leagues\n    )\n  ){\n    return true;\n  }'''
assert old in s, 'wantedFixture block not found'
s=s.replace(old,new,1)

# 2) API-Football FREE plan does not allow `last`. Use season-based team history instead.
s=s.replace('goalgrid_team_v192_','goalgrid_team_v193_')
old='''  const fixtures =\n    await apiFootball(\n      `/fixtures?team=${teamId}&last=20&timezone=Europe/Istanbul`\n    );\n\n\n  const matches =\n    fixtures'''
new='''  const seasonCandidates = [2026, 2025];\n  const fixtures = [];\n  const seasonErrors = [];\n\n  for(const season of seasonCandidates){\n    try{\n      const seasonFixtures = await apiFootball(\n        `/fixtures?team=${teamId}&season=${season}&timezone=Europe/Istanbul`\n      );\n      fixtures.push(...seasonFixtures);\n    }catch(error){\n      seasonErrors.push(`${season}: ${error.message}`);\n    }\n  }\n\n  if(!fixtures.length && seasonErrors.length){\n    throw new Error(seasonErrors.join(" • "));\n  }\n\n  const matches =\n    fixtures'''
assert old in s, 'last parameter history block not found'
s=s.replace(old,new,1)

# Sort returned history newest first, then keep a sane amount in cache.
old='''      .filter(\n        x =>\n          x.team1 &&\n          x.team2\n      );'''
new='''      .filter(\n        x =>\n          x.team1 &&\n          x.team2\n      )\n      .sort((a,b)=>String(b.date).localeCompare(String(a.date)))\n      .slice(0,40);'''
# replace only first occurrence after loadTeamHistory area; there may be other similar blocks.
pos=s.find('async function loadTeamHistory')
idx=s.find(old,pos)
assert idx!=-1, 'loadTeamHistory match filter not found'
s=s[:idx]+s[idx:].replace(old,new,1)

p.write_text(s,encoding='utf-8')
print('GoalGrid V1.9.3 applied - no Last parameter, domestic cups removed')
