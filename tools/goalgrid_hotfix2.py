from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')

# This script runs on top of the current deployed V1.9.1 index.
s=s.replace('GoalGrid V1.9.1','GoalGrid V1.9.2').replace('Futbol Karar Motoru • V1.9.1','Futbol Karar Motoru • V1.9.2')

# Team aliases that were still causing valid OpenFootball/football-data matches to be missed.
needle='''  sporting:"sporting"\n\n};'''
replacement='''  sporting:"sporting",\n\n  necnijmegen:"nec",\n  nec:"nec",\n  excelsiorrotterdam:"excelsior",\n  excelsior:"excelsior",\n  clubbruggekv:"clubbrugge",\n  clubbrugge:"clubbrugge",\n  aekathensfc:"aekathens",\n  aekathens:"aekathens",\n  lasklinz:"lask",\n  lask:"lask",\n  astonvillafc:"astonvilla",\n  astonvilla:"astonvilla"\n\n};'''
assert needle in s, 'alias tail not found'
s=s.replace(needle,replacement,1)

# Refresh API history cache and use a conservative request shape.
s=s.replace('goalgrid_team_v190_','goalgrid_team_v192_')
s=s.replace('`/fixtures?team=${teamId}&last=40&status=FT&timezone=Europe/Istanbul`','`/fixtures?team=${teamId}&last=20&timezone=Europe/Istanbul`',1)

# Only use API-Football history if the free/league sources do not already provide 2 usable matches.
old='''  /*\n    Avrupa ve kupa maçlarında en güvenilir takım eşleştirme:\n    API-Football takım ID.\n  */\n\n  try{\n\n    const [\n      homeHistory,\n      awayHistory\n    ] =\n      await Promise.all([\n        loadTeamHistory(\n          fixture.teams.home.id\n        ),\n        loadTeamHistory(\n          fixture.teams.away.id\n        )\n      ]);\n\n\n    if(\n      homeHistory.length\n    ){\n\n      groups.push(\n        homeHistory\n      );\n\n      sources.push(\n        `API-Football ${fixture.teams.home.name} (${homeHistory.length})`\n      );\n\n    }\n\n\n    if(\n      awayHistory.length\n    ){\n\n      groups.push(\n        awayHistory\n      );\n\n      sources.push(\n        `API-Football ${fixture.teams.away.name} (${awayHistory.length})`\n      );\n\n    }\n\n  }catch(error){\n\n    errors.push(\n      "API-Football takım geçmişi: "\n      +\n      error.message\n    );\n\n  }'''
new='''  /*\n    Önce ücretsiz/lig kaynaklarını kullan. Takım için 2 maçtan az kalırsa\n    yalnız o takım için API-Football geçmişine düş. Böylece günlük API kotası\n    onlarca gereksiz takım çağrısıyla tüketilmez.\n  */\n\n  try{\n    const localMerged = mergeMatches(...groups);\n    const targetDate = String(fixture.fixture?.date || "").slice(0,10);\n\n    const localHomeCount = lastMatches(\n      fixture.teams.home.name, fixture.teams.home.id, localMerged, targetDate\n    ).length;\n\n    const localAwayCount = lastMatches(\n      fixture.teams.away.name, fixture.teams.away.id, localMerged, targetDate\n    ).length;\n\n    const needHome = localHomeCount < 2;\n    const needAway = localAwayCount < 2;\n\n    const [homeHistory,awayHistory] = await Promise.all([\n      needHome ? loadTeamHistory(fixture.teams.home.id) : Promise.resolve([]),\n      needAway ? loadTeamHistory(fixture.teams.away.id) : Promise.resolve([])\n    ]);\n\n    if(homeHistory.length){\n      groups.push(homeHistory);\n      sources.push(`API-Football ${fixture.teams.home.name} (${homeHistory.length})`);\n    }\n\n    if(awayHistory.length){\n      groups.push(awayHistory);\n      sources.push(`API-Football ${fixture.teams.away.name} (${awayHistory.length})`);\n    }\n\n  }catch(error){\n    errors.push("API-Football takım geçmişi: " + error.message);\n  }'''
assert old in s, 'buildFixtureHistory API block not found'
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
print('GoalGrid V1.9.2 applied')
