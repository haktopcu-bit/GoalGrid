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
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Desteklenmeyen lig"
      }),
      {
        status: 400,
        headers: {
          "content-type": "application/json; charset=utf-8"
        }
      }
    );
  }

  const source =
    `https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/${file}`;

  try {
    const response = await fetch(source);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Kaynak hatası ${response.status}`
        }),
        {
          status: 502,
          headers: {
            "content-type": "application/json; charset=utf-8"
          }
        }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        ok: true,
        league,
        source: "OpenFootball",
        data
      }),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=1800",
          "access-control-allow-origin": "*"
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8"
        }
      }
    );
  }
}
