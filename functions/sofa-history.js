const BASE = "https://www.sofascore.com/api/v1";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const teamName = (url.searchParams.get("team") || "").trim();
  if (!teamName) return out({ok:false,error:"team gerekli"},400);

  try {
    const search = await getJson(`${BASE}/search/all?q=${encodeURIComponent(teamName)}`);
    const results = Array.isArray(search.results) ? search.results : [];

    const candidates = results
      .map(r => r.entity || r)
      .filter(e => e && e.id && e.name && isFootballTeam(e))
      .map(e => ({...e, score:nameScore(teamName,e.name,e.shortName,e.slug)}))
      .sort((a,b)=>b.score-a.score);

    if (!candidates.length || candidates[0].score < 0.45) {
      return out({ok:false,error:`Sofascore takım eşleşmesi bulunamadı: ${teamName}`},404);
    }

    const team = candidates[0];
    const matches = [];

    for (let page=0; page<4 && matches.length<20; page++) {
      const data = await getJson(`${BASE}/team/${team.id}/events/last/${page}`);
      const events = Array.isArray(data.events) ? data.events : [];
      for (const e of events) {
        if (!e || e.status?.type !== "finished") continue;
        if (isWomenEvent(e) || isDomesticCup(e)) continue;
        const h = num(e.homeScore?.current ?? e.homeScore?.normaltime ?? e.homeScore?.display);
        const a = num(e.awayScore?.current ?? e.awayScore?.normaltime ?? e.awayScore?.display);
        if (h === null || a === null) continue;
        const homeId = Number(e.homeTeam?.id) || null;
        const awayId = Number(e.awayTeam?.id) || null;
        const subjectSide = Number(team.id) === homeId ? "home" : Number(team.id) === awayId ? "away" : null;
        if (!subjectSide) continue;
        matches.push({
          date: isoDate(e.startTimestamp),
          time: isoTime(e.startTimestamp),
          team1: e.homeTeam?.name || "",
          team2: e.awayTeam?.name || "",
          team1Id: null,
          team2Id: null,
          sofaHomeId: homeId,
          sofaAwayId: awayId,
          subjectSide,
          score: {ft:[h,a]},
          source: "Sofascore",
          leagueName: e.tournament?.uniqueTournament?.name || e.tournament?.name || "",
          leagueCountry: e.tournament?.category?.name || ""
        });
      }
      if (!data.hasNextPage) break;
    }

    const unique = new Map();
    for (const m of matches) {
      const key = `${m.date}|${norm(m.team1)}|${norm(m.team2)}`;
      if (!unique.has(key)) unique.set(key,m);
    }

    const finalMatches = [...unique.values()]
      .sort((a,b)=>String(b.date).localeCompare(String(a.date)))
      .slice(0,16);

    return out({
      ok:true,
      team:{id:team.id,name:team.name},
      matches:finalMatches
    },200,{"cache-control":"public, max-age=900"});
  } catch (e) {
    return out({ok:false,error:e.message || String(e)},502);
  }
}

async function getJson(url){
  const r = await fetch(url,{
    headers:{
      "User-Agent":"Mozilla/5.0 (compatible; GoalGrid/1.12.9)",
      "Accept":"application/json,text/plain,*/*",
      "Referer":"https://www.sofascore.com/"
    }
  });
  if(!r.ok) throw new Error(`Sofascore HTTP ${r.status}`);
  return r.json();
}

function isFootballTeam(e){
  const gender = String(e.gender || "M").toUpperCase();
  const sport = String(e.sport?.slug || e.sport?.name || "football").toLowerCase();
  return gender !== "F" && sport.includes("football");
}

function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(fc|cf|ac|fk|sk|sc)\b/g," ").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim()}
function compact(v){return norm(v).replace(/\s+/g,"")}
function nameScore(target,...vals){
  const t=compact(target); let best=0;
  for(const v of vals){
    const x=compact(v); if(!x) continue;
    if(x===t) best=Math.max(best,1);
    else if(x.includes(t)||t.includes(x)) best=Math.max(best,0.82);
    else {
      const a=new Set(norm(target).split(" ").filter(z=>z.length>2));
      const b=new Set(norm(v).split(" ").filter(z=>z.length>2));
      let c=0; for(const z of a) if(b.has(z)) c++;
      if(a.size&&b.size) best=Math.max(best,c/Math.max(a.size,b.size));
    }
  }
  return best;
}

function isWomenEvent(e){
  const txt=norm(`${e.tournament?.name||""} ${e.tournament?.uniqueTournament?.name||""} ${e.homeTeam?.name||""} ${e.awayTeam?.name||""}`);
  return /(women|female|femina|femenina|feminina|frauen|dames|vrouwen|kadin)/.test(txt) || e.homeTeam?.gender==="F" || e.awayTeam?.gender==="F";
}
function isDomesticCup(e){
  const n=norm(e.tournament?.uniqueTournament?.name || e.tournament?.name || "");
  if(/champions league|europa league|conference league/.test(n)) return false;
  return /(^| )(cup|copa|coppa|coupe|pokal|beker|trophy|shield|supercup|super cup|turkiye kupasi)( |$)/.test(n);
}
function num(v){const n=Number(v); return Number.isFinite(n)?n:null}
function isoDate(ts){if(!ts)return"";return new Date(ts*1000).toISOString().slice(0,10)}
function isoTime(ts){if(!ts)return"";return new Date(ts*1000).toISOString().slice(11,16)}
function out(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*",...extra}})}