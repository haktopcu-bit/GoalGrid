export async function onRequestGet(context) {
  const { request, env } = context;

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300",
    "Access-Control-Allow-Origin": "*"
  };

  try {
    // Cloudflare Secret
    const token = env.FOOTBALL_DATA_TOKEN;

    if (!token) {
      return new Response(
        JSON.stringify({
          ok: false,
          hata: "FOOTBALL_DATA_TOKEN Cloudflare Secret bulunamadı."
        }),
        { status: 500, headers }
      );
    }

    const url = new URL(request.url);

    // Örnek:
    // /football-data?competition=PD
    // /football-data?competition=PL
    // /football-data?competition=SA

    const competition =
      (url.searchParams.get("competition") || "PD").toUpperCase();

    const allowed = new Set([
      "WC",   // Dünya Kupası
      "CL",   // Şampiyonlar Ligi
      "BL1",  // Bundesliga
      "DED",  // Eredivisie
      "BSA",  // Brezilya Serie A
      "PD",   // La Liga
      "FL1",  // Ligue 1
      "ELC",  // Championship
      "PPL",  // Portekiz
      "EC",   // Avrupa Şampiyonası
      "SA",   // Serie A
      "PL"    // Premier League
    ]);

    if (!allowed.has(competition)) {
      return new Response(
        JSON.stringify({
          ok: false,
          hata: "Desteklenmeyen lig kodu.",
          ligKodu: competition,
          desteklenenLigler: [...allowed]
        }),
        { status: 400, headers }
      );
    }

    const apiUrl =
      `https://api.football-data.org/v4/competitions/${competition}/matches`;

    const response = await fetch(apiUrl, {
      headers: {
        "X-Auth-Token": token
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          hata: "football-data.org isteği başarısız.",
          durum: response.status,
          ligKodu: competition,
          detay: text
        }),
        {
          status: response.status,
          headers
        }
      );
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({
          ok: false,
          hata: "football-data.org geçersiz JSON döndürdü."
        }),
        { status: 502, headers }
      );
    }

    const maclar = (data.matches || []).map(match => ({
      id: match.id,

      lig: {
        kod: data.competition?.code || competition,
        ad: data.competition?.name || competition
      },

      sezon: {
        baslangic: data.filters?.season || null
      },

      tarih: match.utcDate,
      durum: match.status,
      hafta: match.matchday,

      evSahibi: {
        id: match.homeTeam?.id,
        ad: match.homeTeam?.name,
        kisaAd: match.homeTeam?.shortName,
        kod: match.homeTeam?.tla,
        logo: match.homeTeam?.crest
      },

      deplasman: {
        id: match.awayTeam?.id,
        ad: match.awayTeam?.name,
        kisaAd: match.awayTeam?.shortName,
        kod: match.awayTeam?.tla,
        logo: match.awayTeam?.crest
      },

      skor: {
        kazanan: match.score?.winner,
        sure: match.score?.duration,

        tamMac: {
          ev: match.score?.fullTime?.home,
          deplasman: match.score?.fullTime?.away
        },

        ilkYari: {
          ev: match.score?.halfTime?.home,
          deplasman: match.score?.halfTime?.away
        }
      }
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        kaynak: "football-data.org",
        ligKodu: competition,
        lig: data.competition?.name || competition,
        toplamMac: maclar.length,
        maclar
      }),
      { status: 200, headers }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        hata: "GoalGrid football-data fonksiyonunda beklenmeyen hata.",
        detay: error?.message || String(error)
      }),
      { status: 500, headers }
    );
  }
}
