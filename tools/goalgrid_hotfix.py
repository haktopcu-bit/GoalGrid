from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Version label only; design remains unchanged.
s=s.replace('GoalGrid V1.8.1','GoalGrid V1.9.0').replace('Futbol Karar Motoru • V1.8.1','Futbol Karar Motoru • V1.9.0')

# 1) Domestic cups must not enter the fixture list. UEFA club competitions remain allowed.
old='''  if(\n    includesAny(\n      leagueName,\n      rule.cups\n    )\n  ){\n    return true;\n  }'''
new='''  /* Ulusal kupa maçları GoalGrid bültenine alınmaz. */\n  if(\n    includesAny(\n      leagueName,\n      rule.cups\n    )\n  ){\n    return false;\n  }'''
assert old in s, 'wantedFixture cup block not found'
s=s.replace(old,new,1)

# 2) Make API team-history cache version new and fetch enough completed matches.
s=s.replace('goalgrid_team_v181_','goalgrid_team_v190_')
s=s.replace('`/fixtures?team=${teamId}&last=25`','`/fixtures?team=${teamId}&last=40&status=FT&timezone=Europe/Istanbul`',1)

# 3) Preserve league metadata in normalized API history and exclude national cups/friendlies from team form.
old='''    source:\n      "API-Football"\n\n  };'''
new='''    source:\n      "API-Football",\n\n    leagueName:\n      match.league?.name || "",\n\n    leagueCountry:\n      match.league?.country || ""\n\n  };'''
assert old in s, 'normalize API return not found'
s=s.replace(old,new,1)

old='''  const matches =\n    fixtures\n      .map(\n        normalizeApiFootballHistoryMatch\n      )\n      .filter(\n        x =>\n          x.team1 &&\n          x.team2\n      );'''
new='''  const matches =\n    fixtures\n      .filter(match => {\n        const leagueName = plain(match.league?.name);\n        const country = plain(match.league?.country);\n\n        if(includesAny(leagueName, EUROPE_NAMES)){\n          return true;\n        }\n\n        if(leagueName.includes("friendly")){\n          return false;\n        }\n\n        const rule = COUNTRY_RULES[country];\n        if(rule && includesAny(leagueName, rule.cups)){\n          return false;\n        }\n\n        return true;\n      })\n      .map(\n        normalizeApiFootballHistoryMatch\n      )\n      .filter(\n        x =>\n          x.team1 &&\n          x.team2\n      );'''
assert old in s, 'team history map block not found'
s=s.replace(old,new,1)

# 4) Add interactive filter state.
old='''let state = {\n  analyses:[],\n  tab:"strong",\n  apiCalls:0,\n  coupon:[]\n};'''
new='''let state = {\n  analyses:[],\n  tab:"strong",\n  apiCalls:0,\n  coupon:[],\n  gradeFilter:"ALL",\n  leagueFilter:"ALL"\n};'''
assert old in s
s=s.replace(old,new,1)

# 5) Existing four summary cards -> five clickable analysis filters. API count moves into scan status (already shown there).
old='''<section class="stats">\n\n  <div class="card stat">\n    <b id="matchCount">0</b>\n    <small>MAÇ</small>\n  </div>\n\n  <div class="card stat">\n    <b id="strongCount">0</b>\n    <small>A / A+</small>\n  </div>\n\n  <div class="card stat">\n    <b id="noCount">0</b>\n    <small>OYNAMA</small>\n  </div>\n\n  <div class="card stat">\n    <b id="apiCount">0</b>\n    <small>API</small>\n  </div>\n\n</section>'''
new='''<section class="stats gradeFilters">\n  <div class="card stat filterStat active" data-grade="ALL"><b id="matchCount">0</b><small>MAÇ</small></div>\n  <div class="card stat filterStat" data-grade="A+"><b id="aplusCount">0</b><small>A+</small></div>\n  <div class="card stat filterStat" data-grade="A"><b id="aCount">0</b><small>A</small></div>\n  <div class="card stat filterStat" data-grade="B"><b id="bCount">0</b><small>B</small></div>\n  <div class="card stat filterStat" data-grade="OYNAMA"><b id="noCount">0</b><small>OYNAMA</small></div>\n</section>\n\n<div id="leagueFilters" class="tabs leagueFilters hidden"></div>'''
assert old in s, 'stats HTML not found'
s=s.replace(old,new,1)

# Keep apiCount calls harmless now that its card is gone.
s=s.replace('$("#apiCount").textContent =\n    state.apiCalls;','const apiCounter = $("#apiCount");\n  if(apiCounter) apiCounter.textContent = state.apiCalls;',1)
s=s.replace('''  $("#apiCount").textContent=\n    "0";''','''  const apiCounter = $("#apiCount");\n  if(apiCounter) apiCounter.textContent="0";''',1)

# 6) Styles for five small filters + league chips.
s=s.replace('grid-template-columns:repeat(4,1fr);','grid-template-columns:repeat(5,1fr);',1)
css='''\n.filterStat{cursor:pointer;user-select:none;transition:.15s}\n.filterStat.active{outline:2px solid var(--green);border-color:transparent}\n.leagueFilters{margin-top:4px;margin-bottom:12px}\n.leagueFilters .tab{font-size:11px;padding:8px 10px}\n@media(max-width:520px){.gradeFilters{gap:5px}.gradeFilters .card{padding:10px 4px}.gradeFilters .stat b{font-size:18px}.gradeFilters .stat small{font-size:9px}}\n'''
s=s.replace('</style>',css+'\n</style>',1)

# 7) Add filter helpers before render().
needle='''function render(){\n'''
helpers='''function setGradeFilter(value){\n  state.gradeFilter=value;\n  state.tab="all";\n  document.querySelectorAll(".tab[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab==="all"));\n  render();\n}\n\nfunction setLeagueFilter(value){\n  state.leagueFilter=value;\n  state.tab="all";\n  document.querySelectorAll(".tab[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab==="all"));\n  render();\n}\n\nfunction renderLeagueFilters(){\n  const host=$("#leagueFilters");\n  if(!host) return;\n  const base=state.analyses.filter(x=>state.gradeFilter==="ALL" || x.grade===state.gradeFilter);\n  const counts=new Map();\n  base.forEach(x=>{const n=x.fixture?.league?.name||"Diğer";counts.set(n,(counts.get(n)||0)+1)});\n  if(!base.length){host.classList.add("hidden");host.innerHTML="";return}\n  if(state.leagueFilter!=="ALL" && !counts.has(state.leagueFilter)) state.leagueFilter="ALL";\n  host.classList.remove("hidden");\n  const buttons=[`<button class="tab ${state.leagueFilter==="ALL"?"active":""}" data-league-filter="ALL">Tümü (${base.length})</button>`];\n  [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0],"tr")).forEach(([name,count])=>buttons.push(`<button class="tab ${state.leagueFilter===name?"active":""}" data-league-filter="${name.replace(/&/g,"&amp;").replace(/\"/g,"&quot;")}">${name} (${count})</button>`));\n  host.innerHTML=buttons.join("");\n  host.querySelectorAll("[data-league-filter]").forEach(btn=>btn.onclick=()=>setLeagueFilter(btn.dataset.leagueFilter));\n}\n\n'''
assert needle in s
s=s.replace(needle,helpers+needle,1)

# 8) Replace beginning of render counters and add filters to list.
old='''  $("#matchCount").textContent=\n    state.analyses.length;\n\n\n  $("#strongCount").textContent=\n    state.analyses.filter(\n      x=>\n        x.grade==="A"\n        ||\n        x.grade==="A+"\n    ).length;\n\n\n  $("#noCount").textContent=\n    state.analyses.filter(\n      x=>\n        x.grade==="OYNAMA"\n    ).length;'''
new='''  $("#matchCount").textContent=state.analyses.length;\n  $("#aplusCount").textContent=state.analyses.filter(x=>x.grade==="A+").length;\n  $("#aCount").textContent=state.analyses.filter(x=>x.grade==="A").length;\n  $("#bCount").textContent=state.analyses.filter(x=>x.grade==="B").length;\n  $("#noCount").textContent=state.analyses.filter(x=>x.grade==="OYNAMA").length;\n\n  document.querySelectorAll(".filterStat").forEach(x=>x.classList.toggle("active",x.dataset.grade===state.gradeFilter));\n  renderLeagueFilters();'''
assert old in s, 'render counters not found'
s=s.replace(old,new,1)

old='''  let list=[\n    ...state.analyses\n  ];'''
new='''  let list=[...state.analyses];\n\n  if(state.gradeFilter!=="ALL") list=list.filter(x=>x.grade===state.gradeFilter);\n  if(state.leagueFilter!=="ALL") list=list.filter(x=>(x.fixture?.league?.name||"")===state.leagueFilter);'''
assert old in s
s=s.replace(old,new,1)

# Strong tab should only force strong when no explicit grade filter.
old='''  if(\n    state.tab==="strong"\n  ){\n\n    list=\n      list.filter(\n        x=>\n          x.grade==="A"\n          ||\n          x.grade==="A+"\n      );\n\n  }'''
new='''  if(\n    state.tab==="strong" &&\n    state.gradeFilter==="ALL"\n  ){\n    list=list.filter(x=>x.grade==="A" || x.grade==="A+");\n  }'''
assert old in s
s=s.replace(old,new,1)

# 9) Bind summary filters once.
needle='''document\n.querySelectorAll(\n  ".tab"\n)'''
bind='''document.querySelectorAll(".filterStat").forEach(button=>{\n  button.onclick=()=>setGradeFilter(button.dataset.grade);\n});\n\n\n'''
assert needle in s
s=s.replace(needle,bind+needle,1)

# 10) New scans reset visual filters.
needle='''  state.apiCalls=0;'''
s=s.replace(needle,'''  state.apiCalls=0;\n  state.gradeFilter="ALL";\n  state.leagueFilter="ALL";''',1)

p.write_text(s,encoding='utf-8')
print('GoalGrid hotfix applied:', len(s), 'chars')
