# GoalGrid V1.9.6 deployment patch
from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('GoalGrid V1.9.5','GoalGrid V1.9.6').replace('Futbol Karar Motoru • V1.9.5','Futbol Karar Motoru • V1.9.6')

# 1) Remove women competitions/teams. Insert immediately before domestic cup check,
# where leagueName is already defined in wantedFixture().
marker='''  if(includesAny(leagueName,domesticCupWords)){\n    return false;\n  }'''
if marker in s and 'const womenWords = [' not in s:
    women_block='''  const womenWords = [\n    "women", "womens", "female", "femina", "femenina",\n    "feminina", "frauen", "dames", "vrouwen", "kadın", "kadin"\n  ];\n\n  const homeName = plain(fixture.teams?.home?.name || "");\n  const awayName = plain(fixture.teams?.away?.name || "");\n\n  if(\n    includesAny(leagueName,womenWords) ||\n    /(^| )(w|women|femina|femenina|frauen)( |$)/.test(homeName) ||\n    /(^| )(w|women|femina|femenina|frauen)( |$)/.test(awayName)\n  ){\n    return false;\n  }\n\n'''
    s=s.replace(marker,women_block+marker,1)

# 2) API-Football Free plan future dates: use football-data.org instead of trying 2026 season API-Football.
start=s.find('async function loadFixturesForDate(date){')
end=s.find('\n\n\nasync function scan(){', start)
if start!=-1 and end!=-1:
    new_helper=r'''async function loadFixturesForDate(date){

  try{
    return await apiFootball(
      `/fixtures?date=${date}&timezone=Europe/Istanbul`
    );
  }catch(error){
    const msg=String(error?.message || error || "");
    const blockedDate=msg.includes("do not have access to this date");
    if(!blockedDate) throw error;

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

# 3) Never call API-Football team history with null IDs from football-data fixtures.
fn='async function loadTeamHistory(teamId){'
pos=s.find(fn)
if pos!=-1 and 'if(teamId===null || teamId===undefined || teamId==="")' not in s[pos:pos+250]:
    insert_pos=pos+len(fn)
    guard='''\n\n  if(teamId===null || teamId===undefined || teamId===""){\n    return[];\n  }'''
    s=s[:insert_pos]+guard+s[insert_pos:]

p.write_text(s,encoding='utf-8')
print('GoalGrid V1.9.6 applied')
