export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");

  const allowed = new Set([
    "E0", "E1", "D1", "I1", "SP1", "F1", "N1", "B1", "T1"
  ]);

  if (!allowed.has(code)) {
    return new Response("Unsupported league", { status: 400 });
  }

  const season = "2627";

  const target =
    `https://www.football-data.co.uk/mmz4281/${season}/${code}.csv`;

  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent": "GoalGrid/1.2"
      }
    });

    if (!res.ok) {
      return new Response(
        `Source error ${res.status}`,
        { status: 502 }
      );
    }

    const text = await res.text();

    return new Response(text, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "cache-control": "public, max-age=1800",
        "access-control-allow-origin": "*"
      }
    });

  } catch (e) {
    return new Response(
      "Proxy error: " + e.message,
      { status: 500 }
    );
  }
}
