const DTEK_BASE = "https://www.dtek-kem.com.ua";
const DTEK_AJAX = DTEK_BASE + "/ua/ajax";
const DTEK_PAGE = DTEK_BASE + "/ua/shutdowns";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json(null, 204);
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "KYIV безпека — DTEK proxy",
        endpoint: "/dtek"
      });
    }

    if (url.pathname !== "/dtek") {
      return json({ ok: false, error: "Not found" }, 404);
    }

    const city = (url.searchParams.get("city") || "м. Київ").trim();
    const street = (url.searchParams.get("street") || "").trim();
    const house = (url.searchParams.get("house") || "").trim();

    if (!street || !house) {
      return json({
        ok: false,
        error: "Потрібні city, street та house",
        example: "/dtek?city=м.%20Київ&street=вул.%20Оноре%20де%20Бальзака&house=63Б"
      }, 400);
    }

    try {
      // DTEK uses a WordPress AJAX endpoint rather than a public REST API.
      // First request the page to obtain a current session/cookies.
      const page = await fetch(DTEK_PAGE, {
        method: "GET",
        headers: browserHeaders()
      });

      if (!page.ok) {
        return json({
          ok: false,
          error: "ДТЕК не прийняв запит сторінки",
          status: page.status
        }, 502);
      }

      const cookie = page.headers.get("set-cookie") || "";

      // Ask DTEK for all houses on the selected street.
      const homeResponse = await dtekAjax(
        [
          ["city", city],
          ["street", street],
          ["updateFact", String(Date.now())]
        ],
        cookie,
        "getHomeNum"
      );

      if (!homeResponse.ok) {
        return json({
          ok: false,
          error: "ДТЕК не повернув дані по вулиці",
          status: homeResponse.status
        }, 502);
      }

      const data = homeResponse.data;

      const houseData = data?.data?.[house] ?? null;

      if (!houseData) {
        return json({
          ok: false,
          error: "Будинок не знайдено у відповіді ДТЕК",
          city,
          street,
          house,
          availableHouses: data?.data ? Object.keys(data.data) : []
        }, 404);
      }

      return json({
        ok: true,
        city,
        street,
        house,
        address: [street, house, city].join(", "),
        source: DTEK_PAGE,
        fetchedAt: new Date().toISOString(),
        house: houseData,
        preset: data?.preset ?? null,
        fact: data?.fact ?? null
      });
    } catch (error) {
      return json({
        ok: false,
        error: "Помилка під час звернення до ДТЕК",
        details: String(error?.message || error)
      }, 502);
    }
  }
};

async function dtekAjax(fields, cookie, method) {
  const body = new URLSearchParams();
  body.set("method", method);

  fields.forEach(([name, value], index) => {
    body.set(`data[${index}][name]`, name);
    body.set(`data[${index}][value]`, value);
  });

  const response = await fetch(DTEK_AJAX, {
    method: "POST",
    headers: {
      ...browserHeaders(),
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": DTEK_PAGE,
      ...(cookie ? { "Cookie": cookie } : {})
    },
    body
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    ok: response.ok && !!data,
    status: response.status,
    data
  };
}

function browserHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8"
  };
}

function json(data, status = 200) {
  return new Response(
    data === null ? null : JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    }
  );
}
