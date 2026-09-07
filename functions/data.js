export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const league = url.searchParams.get("league");

  const LIGLER = {
    premierleague: {
      dosya: "en.1.json",
      sezonlar: ["2026-27", "2025-26"]
    },

    championship: {
      dosya: "en.2.json",
      sezonlar: ["2026-27", "2025-26"]
    },

    bundesliga: {
      dosya: "de.1.json",
      sezonlar: ["2026-27", "2025-26"]
    },

    laliga: {
      dosya: "es.1.json",
      sezonlar: ["2026-27", "2025-26"]
    },

    ligue1: {
      dosya: "fr.1.json",
      sezonlar: ["2026-27", "2025-26"]
    },

    seriea: {
      dosya: "it.1.json",
      sezonlar: ["2026-27", "2025-26"]
    },

    eredivisie: {
      dosya: "nl.1.json",
      sezonlar: ["2026-27", "2025-26"]
    },

    superlig: {
      dosya: "tr.1.json",
      sezonlar: ["2026-27", "2025-26"]
    },

    belcika: {
      dosya: "be.1.json",
      sezonlar: ["2026-27", "2025-26"]
    }
  };

  const ayar = LIGLER[league];

  if (!ayar) {
    return json(
      {
        ok: false,
        lig: league,
        hata: "Bu lig GoalGrid veri sisteminde tanımlı değil."
      },
      400
    );
  }

  try {
    const tumMaclar = [];
    const kaynaklar = [];
    const hatalar = [];

    for (const sezon of ayar.sezonlar) {
      const kaynak =
        `https://raw.githubusercontent.com/openfootball/football.json/master/${sezon}/${ayar.dosya}`;

      try {
        const cevap = await fetch(kaynak, {
          headers: {
            "User-Agent": "GoalGrid/1.5"
          }
        });

        if (!cevap.ok) {
          hatalar.push({
            sezon,
            durum: cevap.status
          });

          continue;
        }

        const veri = await cevap.json();

        const maclar =
          Array.isArray(veri.matches)
            ? veri.matches
            : [];

        if (!maclar.length) {
          hatalar.push({
            sezon,
            durum: "Maç bulunamadı"
          });

          continue;
        }

        let eklenen = 0;

        for (const mac of maclar) {
          const temizMac = maciTemizle(mac, sezon);

          if (temizMac) {
            tumMaclar.push(temizMac);
            eklenen++;
          }
        }

        kaynaklar.push({
          sezon,
          dosya: ayar.dosya,
          macSayisi: eklenen
        });

      } catch (hata) {
        hatalar.push({
          sezon,
          durum: hata.message
        });
      }
    }

    if (!tumMaclar.length) {
      return json(
        {
          ok: false,
          lig: league,
          hata: "Bu lig için kullanılabilir geçmiş maç bulunamadı.",
          kaynaklar,
          hatalar
        },
        502
      );
    }

    /*
      Aynı karşılaşma yanlışlıkla iki kez gelirse
      tekrarları kaldırıyoruz.
    */

    const benzersiz = new Map();

    for (const mac of tumMaclar) {
      const anahtar = [
        mac.date || "",
        takimMetni(mac.team1),
        takimMetni(mac.team2)
      ].join("|");

      if (!benzersiz.has(anahtar)) {
        benzersiz.set(anahtar, mac);
      }
    }

    const maclar = [...benzersiz.values()];

    maclar.sort((a, b) => {
      const tarihA =
        `${a.date || ""} ${a.time || "00:00"}`;

      const tarihB =
        `${b.date || ""} ${b.time || "00:00"}`;

      return tarihA.localeCompare(tarihB);
    });

    return json(
      {
        ok: true,
        lig: league,
        kaynak: "OpenFootball",
        sezonlar: ayar.sezonlar,
        toplamMac: maclar.length,
        kaynaklar,
        hatalar,
        maclar
      },
      200,
      {
        "cache-control": "public, max-age=1800"
      }
    );

  } catch (hata) {
    return json(
      {
        ok: false,
        lig: league,
        hata: hata.message
      },
      500
    );
  }
}


function maciTemizle(mac, sezon) {
  if (!mac) {
    return null;
  }

  const ev =
    takimMetni(mac.team1);

  const dep =
    takimMetni(mac.team2);

  if (!ev || !dep) {
    return null;
  }

  let tamSkor = null;
  let devreSkoru = null;

  /*
    OpenFootball dosyalarında skor bazen:

    score: {
      ft: [2,1],
      ht: [1,0]
    }

    bazen de:

    score: [2,1]

    biçiminde olabilir.
  */

  if (
    mac.score &&
    !Array.isArray(mac.score) &&
    typeof mac.score === "object"
  ) {
    tamSkor =
      skorTemizle(mac.score.ft);

    devreSkoru =
      skorTemizle(mac.score.ht);

  } else if (Array.isArray(mac.score)) {
    tamSkor =
      skorTemizle(mac.score);
  }

  return {
    round:
      mac.round || "",

    date:
      mac.date || "",

    time:
      mac.time || "",

    team1:
      ev,

    team2:
      dep,

    score:
      tamSkor
        ? {
            ft: tamSkor,
            ...(devreSkoru
              ? { ht: devreSkoru }
              : {})
          }
        : null,

    sezon
  };
}


function takimMetni(takim) {
  /*
    Bazı veri sürümlerinde takım doğrudan metin,
    bazılarında nesne olabilir.
  */

  if (typeof takim === "string") {
    return takim.trim();
  }

  if (
    takim &&
    typeof takim === "object"
  ) {
    return String(
      takim.name ||
      takim.title ||
      takim.code ||
      ""
    ).trim();
  }

  return "";
}


function skorTemizle(skor) {
  if (
    !Array.isArray(skor) ||
    skor.length < 2
  ) {
    return null;
  }

  const ev =
    Number(skor[0]);

  const dep =
    Number(skor[1]);

  if (
    !Number.isFinite(ev) ||
    !Number.isFinite(dep)
  ) {
    return null;
  }

  return [ev, dep];
}


function json(
  veri,
  durum = 200,
  ekBasliklar = {}
) {
  return new Response(
    JSON.stringify(veri),
    {
      status: durum,

      headers: {
        "content-type":
          "application/json; charset=utf-8",

        "access-control-allow-origin":
          "*",

        ...ekBasliklar
      }
    }
  );
}
