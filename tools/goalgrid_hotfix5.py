from pathlib import Path

# --- index.html ---
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('GoalGrid V1.9.6','GoalGrid V1.9.7').replace('Futbol Karar Motoru • V1.9.6','Futbol Karar Motoru • V1.9.7')

# Enable OpenFootball history for Eerste Divisie and Türkiye 1. Lig.
s=s.replace('89:{name:"Eerste Divisie",fd:null,of:null}', '89:{name:"Eerste Divisie",fd:null,of:"eerstedivisie"}')
s=s.replace('204:{name:"Türkiye 1. Lig",fd:null,of:null}', '204:{name:"Türkiye 1. Lig",fd:null,of:"tff1"}')

# Cross-provider IDs are NOT comparable (API-Football id != football-data id).
# If IDs are equal we accept; if not, fall through to robust name matching.
old='''  if(\n    targetId !== null &&\n    targetId !== undefined &&\n    matchId !== null &&\n    matchId !== undefined\n  ){\n\n    return(\n      Number(targetId)\n      ===\n      Number(matchId)\n    );\n'''
new='''  if(\n    targetId !== null &&\n    targetId !== undefined &&\n    matchId !== null &&\n    matchId !== undefined &&\n    Number(targetId) === Number(matchId)\n  ){\n    return true;\n  }\n'''
if old in s:
    s=s.replace(old,new,1)
else:
    # Flexible fallback for current formatting.
    import re
    s,n=re.subn(r'''  if\(\s*targetId !== null &&\s*targetId !== undefined &&\s*matchId !== null &&\s*matchId !== undefined\s*\)\{\s*return\(\s*Number\(targetId\)\s*===\s*Number\(matchId\)\s*\);\s*''', new, s, count=1)
    assert n==1, 'sameTeam ID block not found'

# API-Football Free plan cannot access 2025/2026 team seasons. Do not waste calls / show plan errors.
# Local multi-source history is now the primary history engine.
start=s.find('async function loadTeamHistory(teamId){')
assert start!=-1, 'loadTeamHistory not found'
body=s.find('{',start)
# Inject immediately after function opening unless already present.
inject='''\n  /* V1.9.7: Free planda güncel sezon takım geçmişi kapalı; yerel çoklu kaynak kullan. */\n  return [];\n'''
if 'V1.9.7: Free planda' not in s[start:start+220]:
    s=s[:body+1]+inject+s[body+1:]

p.write_text(s,encoding='utf-8')

# --- functions/data.js ---
d=Path('functions/data.js')
t=d.read_text(encoding='utf-8')

# Add missing OpenFootball leagues used by the UI.
if 'eerstedivisie:' not in t:
    marker='''    eredivisie: {\n      dosya: "nl.1.json",\n      sezonlar: ["2026-27", "2025-26"]\n    },'''
    add=marker+'''\n\n    eerstedivisie: {\n      dosya: "nl.2.json",\n      sezonlar: ["2026-27", "2025-26"]\n    },'''
    assert marker in t, 'eredivisie data config not found'
    t=t.replace(marker,add,1)

if 'tff1:' not in t:
    marker='''    superlig: {\n      dosya: "tr.1.json",\n      sezonlar: ["2026-27", "2025-26"]\n    },'''
    add=marker+'''\n\n    tff1: {\n      dosya: "tr.2.json",\n      sezonlar: ["2026-27", "2025-26"]\n    },'''
    assert marker in t, 'superlig data config not found'
    t=t.replace(marker,add,1)

d.write_text(t,encoding='utf-8')
print('GoalGrid V1.9.7: cross-provider team matching fixed; Eerste Divisie/TFF1 history enabled; blocked API history disabled')
