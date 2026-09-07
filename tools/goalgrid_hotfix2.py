from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('GoalGrid V1.9.0','GoalGrid V1.9.1').replace('Futbol Karar Motoru • V1.9.0','Futbol Karar Motoru • V1.9.1')

# Explicit competition IDs: make UEFA and Dutch competitions impossible to lose by name/country matching.
needle='''function wantedFixture(fixture){\n\n  const leagueName ='''
replacement='''function wantedFixture(fixture){\n\n  const leagueId = Number(fixture.league?.id);\n\n  /* GoalGrid sabit ID güvenlik ağı: UEFA + Hollanda ligleri */\n  if([2,3,848,88,89].includes(leagueId)){\n    return true;\n  }\n\n  const leagueName ='''
assert needle in s, 'wantedFixture start not found'
s=s.replace(needle,replacement,1)

# Competition config should explicitly identify all UEFA tournaments.
needle='''  const name =\n    plain(\n      fixture.league.name\n    );\n\n\n  if(\n    name.includes(\n      "champions league"\n    )\n  ){'''
replacement='''  const name =\n    plain(\n      fixture.league.name\n    );\n\n\n  if(leagueId===2 || name.includes("champions league")){'''
assert needle in s, 'competitionConfig CL block not found'
s=s.replace(needle,replacement,1)

# Add explicit configs for Europa / Conference before generic fallback.
needle='''  return{\n    name:\n      fixture.league.name,\n\n    fd:null,\n\n    of:null\n  };\n\n}\n\n\nconst TEAM_ALIASES'''
replacement='''  if(leagueId===3 || name.includes("europa league")){\n    return{ name:fixture.league.name, fd:null, of:null };\n  }\n\n  if(leagueId===848 || name.includes("conference league")){\n    return{ name:fixture.league.name, fd:null, of:null };\n  }\n\n  return{\n    name:\n      fixture.league.name,\n\n    fd:null,\n\n    of:null\n  };\n\n}\n\n\nconst TEAM_ALIASES'''
assert needle in s, 'competitionConfig fallback not found'
s=s.replace(needle,replacement,1)

# Keep an exact trace of what API returned; useful in UI without hiding anything.
needle='''    const selected =\n      fixtures.filter(\n        wantedFixture\n      );'''
replacement='''    const selected = fixtures.filter(wantedFixture);\n\n    const returnedCompetitions = [...new Set(fixtures.map(x=>`${x.league?.id}:${x.league?.name}`))];\n    console.log("GoalGrid API competitions", returnedCompetitions);'''
assert needle in s, 'selected block not found'
s=s.replace(needle,replacement,1)

p.write_text(s,encoding='utf-8')
print('GoalGrid V1.9.1 applied')
