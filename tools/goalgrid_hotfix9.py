from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('GoalGrid V1.10.0','GoalGrid V1.10.1').replace('Futbol Karar Motoru • V1.10.0','Futbol Karar Motoru • V1.10.1')

s=s.replace('      <span class="source">Sofascore • Takım geçmişi fallback</span>\n','')

marker='  // Universal fallback for leagues/teams missing in the free historical datasets.\n'
start=s.find(marker)
if start!=-1:
    end=s.find('  // API-Football historical seasons (2024/2023) are the final fallback on the Free plan.', start)
    if end==-1:
        end=s.find('  // API-Football is only a final fallback.', start)
    if end==-1:
        end=s.find('  if(homeCount<2 || awayCount<2){', start)
    assert end!=-1, 'Could not find end of stale Sofascore fallback block'
    s=s[:start]+s[end:]

while 'loadSofaHistory(' in s:
    pos=s.find('loadSofaHistory(')
    block_start=s.rfind('  if(homeCount<2 || awayCount<2){',0,pos)
    block_end=s.find('\n  }',pos)
    if block_start!=-1 and block_end!=-1:
        s=s[:block_start]+s[block_end+4:]
    else:
        raise AssertionError('Unremovable loadSofaHistory reference remains')

assert 'loadSofaHistory(' not in s
assert 'Sofascore HTTP' not in s

p.write_text(s,encoding='utf-8')
print('GoalGrid V1.10.1: removed stale Sofascore calls; API-Football fallback remains active')
# trigger
