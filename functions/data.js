export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const league = url.searchParams.get("league");

  const leagueFiles = {
    premierleague: {
      files: ["en.1.json"],
      seasons: ["2026-27", "2025-26"]
    },

    championship: {
      files: ["en.2.json"],
      seasons: ["2026-27", "2025-26"]
    },

    bundesliga: {
      files: ["de.1.json"],
      seasons: ["2026-27", "2025-26"]
    },

    laliga: {
      files: ["es.1.json"],
      seasons: ["2026-27", "2025-26"]
    },

    ligue1: {
      files: ["fr.1.json"],
      seasons: ["2026-27", "2025-26"]
    },

    seriea: {
      files: ["it.1.json"],
      seasons: ["2026-27", "2025-26"]
    },

    eredivisie: {
      files: ["nl.1.json"],
      seasons: ["2026-27", "2025-26"]
    },

    superlig: {
      files: ["tr.1.json"],
      seasons: ["2026-27", "2025-26"]
    },

    belcika: {
      files: ["be.1.json"],
      seasons: ["2026-27", "2025-26"]
    }
  };

  const config = leagueFiles[league];

  if (!config) {
    return json({
      ok: false,
      hata: "Bu lig GoalGrid veri katmanında desteklenmiyor.",
      lig: league
    }, 400);
  }

  try {
    const tumMaclar = [];
    const kaynaklar = [];
    const hatalar = [];

    for (const season of config.seasons) {
      let seasonLoaded = false;

      for (const file of config.files) {
        const source =
          `https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${file}`;

        try {
          const response = await fetch(source, {
            headers: {
              "User-Agent": "GoalGrid/1.5"
            }
          });

          if (!response.ok) {
            hatalar.push({
              sezon: season,
              dosya: file,
              durum: response.status
            });

            continue;
          }

          const data = await response.json();

          const matches =
            Array.isArray(data.matches)
              ? data.matches
              : [];

          if (!matches.length) {
            hatalar.push({
              sezon: season,
              dosya: file,
              durum: "boş"
            });

            continue;
          }

          for (const match of matches) {
            const normalized =
              normalizeMatch(match, season);

            if (normalized) {
              tumMaclar.push(normalized);
            }
          }

          kaynaklar.push({
            sezon: season,
            dosya: file,
            macSayisi: matches.length
          });

          seasonLoaded = true;
          break;

        } catch (error) {
          hatalar.push({
            sezon: season,
            dosya: file,
            durum: error.message
          });
        }
      }

      // Bir sezon bulunamadıysa diğer sezona devam et.
      if (!seasonLoaded) {
        continue;
      }
    }

    if (!tumMaclar.length) {
      return json({
        ok: false,
        hata: "Bu lig için kullanılabilir geçmiş maç verisi bulunamadı.",
        lig: league,
        hatalar
      }, 502);
    }

    // Aynı maçın iki kez gelmesini engelle.
    const unique = new Map();

    for (const match of tumMaclar) {
      const key = [
        match.date || "",
        match.team1 || "",
        match.team2 || ""
      ].join("|");

      if (!unique.has(key)) {
        unique.set(key, match);
      }
    }

    const maclar =
      [...unique.values()]
        .sort((a, b) => {
          const aa =
            `${a.date || ""} ${a.time || "00:00"}`;

          const bb =
            `${b.date || ""} ${b.time || "00:00"}`;

          return aa.localeCompare(bb);
        });

    return json({
      ok: true,
      lig: league,
      kaynak: "OpenFootball",
      kaynaklar,
      toplamMac: maclar.length,
      maclar,
      hatalar
    }, 200, {
      "cache-control": "public, max-age=1800"
    });

  } catch (error) {
    return json({
      ok: false,
      hata: error.message,
      lig: league
    }, 500);
  }
}


function normalizeMatch(match, season) {
  if (!match || !match.team1 || !match.team2) {
    return null;
  }

  let ft = null;
  let ht = null;

  /*
    OpenFootball'da iki farklı skor biçimi görülebiliyor:

    score: {
      ft: [2,1],
      ht: [1,0]
    }

    veya

    score: [2,1]
  */

  if (
    match.score &&
    !Array.isArray(match.score) &&
    Array.isArray(match.score.ft)
  ) {
    ft = normalizeScoreArray(match.score.ft);

    if (Array.isArray(match.score.ht)) {
      ht = normalizeScoreArray(match.score.ht);
    }

  } else if (Array.isArray(match.score)) {
    ft = normalizeScoreArray(match.score);
  }

  return {
    round: match.round || "",
    date: match.date || "",
    time: match.time || "",
    team1: String(match.team1),
    team2: String(match.team2),

    score: ft
      ? {
          ft,
          ...(ht ? { ht } : {})
        }
      : null,

    sezon: season
  };
}


function normalizeScoreArray(value) {
  if (
    !Array.isArray(value) ||
    value.length < 2
  ) {
    return null;
  }

  const home = Number(value[0]);
  const away = Number(value[1]);

  if (
    !Number.isFinite(home) ||
    !Number.isFinite(away)
  ) {
    return null;
  }

  return [home, away];
}


function json(
  data,
  status = 200,
  extraHeaders = {}
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "content-type":
          "application/json; charset=utf-8",

        "access-control-allow-origin":
          "*",

        ...extraHeaders
      }
    }
  );
}
