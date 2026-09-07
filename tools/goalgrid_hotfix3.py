from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('GoalGrid V1.9.4','GoalGrid V1.9.5').replace('Futbol Karar Motoru • V1.9.4','Futbol Karar Motoru • V1.9.5')

# Add a season-cache fallback for fixture dates blocked by API-Football Free plan.
needle='''async function scan(){\n'''
helper=r'''async function loadFixturesForDate(date){

  try{
    return await apiFootball(
      `/fixtures?date=${date}&timezone=Europe/Istanbul`
    );
  }catch(error){

    const msg = String(error?.message || error || "");
    const blockedDate =
      msg.includes("Free plans do not have access to this date") ||
      msg.includes("do not have access to this date");

    if(!blockedDate){
      throw error;
    }

    /*
      API-Football Free plan bazen seçilen günü doğrudan tarih filtresiyle
      vermiyor. Bu durumda desteklediğimiz organizasyonların sezon fikstürünü
      alıp tarihi telefonda filtreliyoruz. Sonuçlar 6 saat localStorage cache'inde
      tutulduğu için aynı gün tekrar taramada yeniden 14 API çağrısı yapılmaz.
    */
    const season = Number(date.slice(0,4));
    const leagueIds = [
      39,40,78,135,140,61,88,89,203,204,144,
      2,3,848
    ];

    const all=[];
    const errors=[];

    for(const leagueId of leagueIds){
      const key=`goalgrid_fixture_season_v195_${leagueId}_${season}`;
      let fixtures=null;

      try{
        const raw=localStorage.getItem(key);
        if(raw){
          const parsed=JSON.parse(raw);
          if(Date.now()-parsed.time < 6*60*60*1000){
            fixtures=parsed.fixtures;
          }
        }
      }catch{}

      if(!fixtures){
        try{
          fixtures=await apiFootball(
            `/fixtures?league=${leagueId}&season=${season}&timezone=Europe/Istanbul`
          );
          try{
            localStorage.setItem(key,JSON.stringify({time:Date.now(),fixtures}));
          }catch{}
        }catch(e){
          errors.push(`${leagueId}: ${e.message}`);
          continue;
        }
      }

      all.push(...fixtures);
    }

    const filtered = all.filter(x=>
      String(x.fixture?.date || "").slice(0,10)===date
    );

    if(!filtered.length && errors.length===leagueIds.length){
      throw new Error(errors.join(" • "));
    }

    return filtered;
  }
}


'''
assert needle in s, 'scan function not found'
s=s.replace(needle,helper+needle,1)

old='''    const fixtures =\n      await apiFootball(\n        `/fixtures?date=${date}&timezone=Europe/Istanbul`\n      );'''
new='''    const fixtures =\n      await loadFixturesForDate(date);'''
assert old in s, 'date fixture call not found'
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
print('GoalGrid V1.9.5 applied - free plan date fallback')
