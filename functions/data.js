export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  const league = url.searchParams.get("league");

  const files = {
    premierleague: "en.1.json",
    championship: "en.2.json",
    bundesliga: "de.1.json",
    laliga: "es.1.json",
    ligue1: "fr.1.json",
    seriea: "it.1.json",
    eredivisie: "nl.1.json"
  };

  const file = files[league];

  if (!file) {
    return json(
      {
        ok: false,
        hata: "Bu lig henüz desteklenmiyor."
      },
      400
    );
  }

  try {
    const sezonlar = [
      "2026-27",
      "2025-26"
    ];

    const tumMaclar = [];

    for (const sezon of sezonlar) {
      const source =
        `https://raw.githubusercontent.com/openfootball/football.json/master/${sezon}/${file}`;

      const response = await fetch(source, {
        headers: {
          "User-Agent": "GoalGrid/1.4"
        }
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();

      const matches = Array.isArray(data.matches)
        ? data.matches
        : [];

      matches.forEach(match => {
        tumMaclar.push({
          ...match,
          sezon
        });
      });
    }

    if (!tumMaclar.length) {
      return json(
        {
          ok: false,
          hata: "Geçmiş maç verisi bulunamadı."
        },
        502
      );
    }

    tumMaclar.sort((a, b) => {
      const aa = `${a.date || ""} ${a.time || "00:00"}`;
      const bb = `${b.date || ""} ${b.time || "00:00"}`;
      return aa.localeCompare(bb);
    });

    return json(
      {
        ok: true,
        lig: league,
        kaynak: "OpenFootball",
        sezonlar,
        maclar: tumMaclar
      },
      200,
      {
        "cache-control": "public, max-age=1800"
      }
    );

  } catch (error) {
    return json(
      {
        ok: false,
        hata: error.message
      },
      500
    );
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        ...extraHeaders
      }
    }
  );
}
