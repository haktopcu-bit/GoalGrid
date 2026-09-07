from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('GoalGrid V1.9.7','GoalGrid V1.9.8').replace('Futbol Karar Motoru • V1.9.7','Futbol Karar Motoru • V1.9.8')

# Fix syntax error accidentally introduced in sameTeam(): one extra closing brace stopped ALL JS execution.
bad='''  ){\n    return true;\n  }\n\n  }\n\n\n  /*\n    Kaynakta ID yoksa isim fallback.\n  */'''
good='''  ){\n    return true;\n  }\n\n  /*\n    Kaynakta ID yoksa isim fallback.\n  */'''
assert bad in s, 'sameTeam syntax bug block not found'
s=s.replace(bad,good,1)

# Exclude women competitions and women teams before any allow-list return.
needle='''function wantedFixture(fixture){\n\n  const leagueId = Number(fixture.league?.id);\n  const leagueName = plain(fixture.league?.name);\n  const country = plain(fixture.league?.country);'''
replacement='''function wantedFixture(fixture){\n\n  const leagueId = Number(fixture.league?.id);\n  const leagueName = plain(fixture.league?.name);\n  const country = plain(fixture.league?.country);\n  const homeName = plain(fixture.teams?.home?.name || "");\n  const awayName = plain(fixture.teams?.away?.name || "");\n\n  const womenWords=[\n    "women","womens","female","femina","femenina","feminina",\n    "frauen","dames","vrouwen","kadin","kadın"\n  ];\n\n  if(includesAny(leagueName,womenWords)) return false;\n  if(/(^| )(w|women|femina|femenina|frauen)( |$)/.test(homeName)) return false;\n  if(/(^| )(w|women|femina|femenina|frauen)( |$)/.test(awayName)) return false;'''
assert needle in s, 'wantedFixture function header not found'
s=s.replace(needle,replacement,1)

# Ensure date initializes on load and UI is refreshed.
# Existing init should work once syntax is fixed, but add a defensive DOMContentLoaded initializer once.
if 'goalgrid-v198-init' not in s:
    insert='''\n<script id="goalgrid-v198-init">\nwindow.addEventListener("DOMContentLoaded",()=>{\n  try{\n    const el=document.querySelector("#selectedDate");\n    if(el && !el.value){ el.value=todayISO(); }\n    if(typeof updateSelectedDateText==="function") updateSelectedDateText();\n    if(typeof showApiState==="function") showApiState();\n    if(typeof render==="function") render();\n  }catch(e){ console.error("GoalGrid init",e); }\n});\n</script>\n'''
    s=s.replace('</body>',insert+'\n</body>',1)

p.write_text(s,encoding='utf-8')
print('GoalGrid V1.9.8 applied: JS syntax fixed, date init restored, women excluded')
