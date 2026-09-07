# GoalGrid V1.9.6 deployment patch
from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('GoalGrid V1.9.5','GoalGrid V1.9.6').replace('Futbol Karar Motoru • V1.9.5','Futbol Karar Motoru • V1.9.6')

# 1) Women competitions are out of GoalGrid scope.
needle='''  const country =\n    plain(\n      fixture.league?.country\n    );'''
replacement='''  const country =\n    plain(\n      fixture.league?.country\n    );\n\n  const womenWords = [\n    "women", "womens", "women's", "female", "femina", "femenina",\n    "feminina", "frauen", "dames", "vrouwen", "kadın", "kadin"\n  ];\n\n  if(includesAny(leagueName,womenWords)){\n    return false;\n  }'''
assert needle in s, 'wantedFixture country block not found'
s=s.replace(needle,replacement,1)

# Also reject obvious women team suffixes/names even if league metadata is vague.
needle='''  if(includesAny(leagueName,domesticCupWords)){\n    return false;\n  }'''
replacement='''  if(includesAny(leagueName,domesticCupWords)){\n    return false;\n  }\n\n  const homeName = plain(fixture.teams?.home?.name || "");\n  const awayName = plain(fixture.teams?.away?.name || "");\n  if(\n    /(^| )(w|women|femina|femenina|frauen)( |$)/.test(homeName) ||\n    /(^| )(w|women|femina|femenina|frauen)( |$)/.test(awayName)\n  ){\n    return false;\n  }'''
assert needle in s, 'domestic cup block not found'
s=s.replace(needle,replacement,1)

# 2) API-Football free plan cannot query current 2026 season. Future-date fallback now uses football-data.org,
# which already exists in GoalGrid and supports CL + major leagues without exposing the key client-side.
start=s.find('async function loadFixturesForDate(date){')
end=s.find('\n\n\nasync function scan(){', start)
assert start!=-1 and end!=-1, 'loadFixturesForDate block not found'
new_helper=r'''async function loadFixturesForDate(date){

  try{
    return await apiFootball(
      `/fixtures?date=${date}&timezone=Europe/Istanbul`
    );
  }catch(error){
    const msg=String(error?.message || error || "");
    const blockedDate=msg.includes("do not have access to this date");
    if(!blockedDate) throw error;

    /*
      API-Football Free plan future-date/2026-season engelinde ikinci fikstür kaynağı.
      football-data.org kodları: CL, PL, ELC, BL1, SA, PD, FL1, DED, PPL.
      Ulusal kupalar ve kadın ligleri bu listede yoktur.
    */
    const competitionMap = {
      CL:{id:2,country:"World",name:"UEFA Champions League"},
      PL:{id:39,country:"England",name:"Premier League"},
      ELC:{id:40,country:"England",name:"Championship"},
      BL1:{id:78,country:"Germany",name:"Bundesliga"},
      SA:{id:135,country:"Italy",name:"Serie A"},
      PD:{id:140,country:"Spain",name:"La Liga"},
      FL1:{id:61,country:"France",name:"Ligue 1"},
      DED:{id:88,country:"Netherlands",name:"Eredivisie"},
      PPL:{id:94,country:"Portugal",name:"Primeira Liga"}
    };

    const all=[];
    const errors=[];

    for(const [code,meta] of Object.entries(competitionMap)){
      try{
        const response=await fetch(`/football-data?competition=${encodeURIComponent(code)}`,{cache:"no-store"});
        const json=await response.json();
        if(!response.ok || !json.ok){
          errors.push(`${code}: ${json.hata || response.status}`);
          continue;
        }

        for(const m of (json.maclar || [])){
          const d=new Date(m.tarih);
          if(Number.isNaN(d.getTime())) continue;
          const parts=new Intl.DateTimeFormat("en-CA",{
            timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"
          }).formatToParts(d);
          const o={}; parts.forEach(x=>o[x.type]=x.value);
          const localDate=`${o.year}-${o.month}-${o.day}`;
          if(localDate!==date) continue;

          all.push({
            fixture:{
              id:m.id || `fd-${code}-${m.evSahibi?.ad}-${m.deplasman?.ad}-${date}`,
              date:m.tarih,
              timestamp:Math.floor(d.getTime()/1000),
              status:{short:m.durum || "NS"}
            },
            league:{id:meta.id,name:m.lig?.ad || meta.name,country:meta.country},
            teams:{
              home:{id:null,name:m.evSahibi?.ad || m.evSahibi?.kisaAd || ""},
              away:{id:null,name:m.deplasman?.ad || m.deplasman?.kisaAd || ""}
            },
            _fixtureSource:"football-data.org"
          });
        }
      }catch(e){
        errors.push(`${code}: ${e.message}`);
      }
    }

    if(all.length) return all;
    throw new Error(
      "Seçilen tarih API-Football Free plan dışında ve football-data.org üzerinde de desteklenen erkek liglerinde maç bulunamadı." +
      (errors.length ? " • "+errors.join(" • ") : "")
    );
  }
}'''
s=s[:start]+new_helper+s[end:]

# 3) Never send null / foreign IDs to API-Football team-history endpoint.
needle='''async function loadTeamHistory(teamId){\n\n  const key ='''
replacement='''async function loadTeamHistory(teamId){\n\n  if(teamId===null || teamId===undefined || teamId===""){\n    return[];\n  }\n\n  const key ='''
assert needle in s, 'loadTeamHistory start not found'
s=s.replace(needle,replacement,1)

p.write_text(s,encoding='utf-8')
print('GoalGrid V1.9.6 applied - women removed, future fixtures via football-data.org')
