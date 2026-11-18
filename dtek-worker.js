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
        error: "Потрібні city, street та house"
      }, 400);
    }

    try {
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

      const html = await page.text();
      const cookie = page.headers.get("set-cookie") || "";

      const csrfToken = extractCsrfToken(html);

      const homeResponse = await dtekAjax(
        [
          ["city", city],
          ["street", street],
          ["updateFact", String(Date.now())]
        ],
        cookie,
        "getHomeNum",
        csrfToken
      );

      if (!homeResponse.ok) {
        return json({
          ok: false,
          error: "ДТЕК не повернув графік",
          status: homeResponse.status,
          csrf: !!csrfToken
        }, 502);
      }

      const raw = homeResponse.data;

      const houses = raw?.data;
      const houseData = findHouse(houses, house);

      if (!houseData) {
        return json({
          ok: false,
          error: "Будинок не знайдено у відповіді ДТЕК",
          city,
          street,
          house,
          availableHouses: houses && typeof houses === "object"
            ? Object.keys(houses).slice(0, 100)
            : []
        }, 404);
      }

      const groups = Array.isArray(houseData.sub_type_reason)
        ? houseData.sub_type_reason
        : [];

      const primaryGroup = groups[0] || "";

      const today = getScheduleForGroup(
        raw?.fact,
        primaryGroup,
        true
      );

      const tomorrow = getScheduleForGroup(
        raw?.fact,
        primaryGroup,
        false
      );

      const groupName =
        raw?.preset?.sch_names?.[primaryGroup] ||
        (primaryGroup ? "Черга " + primaryGroup.replace(/^GPV/i, "") : "");

      return json({
        ok: true,
        site: "kem",
        address: {
          city,
          street,
          house
        },
        fetchedAt: new Date().toISOString(),
        group: groupName || primaryGroup,
        today,
        tomorrow
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

async function dtekAjax(fields, cookie, method, csrfToken) {
  const body = new URLSearchParams();

  body.set("method", method);

  fields.forEach(([name, value], index) => {
    body.set(`data[${index}][name]`, name);
    body.set(`data[${index}][value]`, value);
  });

  const headers = {
    ...browserHeaders(),
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Origin": DTEK_BASE,
    "Referer": DTEK_PAGE
  };

  if (cookie) {
    headers.Cookie = cookie;
  }

  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(DTEK_AJAX, {
    method: "POST",
    headers,
    body
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    ok: response.ok && !!data && data.result !== false,
    status: response.status,
    data
  };
}

function extractCsrfToken(html) {
  const patterns = [
    /<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']csrf-token["']/i,
    /<meta[^>]+name=["']csrf-param["'][^>]+content=["']([^"']+)["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return decodeHtml(match[1]);
    }
  }

  return "";
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function findHouse(houses, wanted) {
  if (!houses || typeof houses !== "object") {
    return null;
  }

  if (houses[wanted]) {
    return houses[wanted];
  }

  const target = normalizeHouse(wanted);

  for (const [key, value] of Object.entries(houses)) {
    if (normalizeHouse(key) === target) {
      return value;
    }
  }

  return null;
}

function normalizeHouse(value) {
  return String(value || "")
    .toUpperCase()
    .replaceAll(" ", "")
    .replaceAll("-", "")
    .replaceAll("/", "")
    .replaceAll("Б", "B");
}

function getScheduleForGroup(fact, groupId, isToday) {
  if (!fact || !groupId || !fact.data || typeof fact.data !== "object") {
    return null;
  }

  const timestamps = Object.keys(fact.data)
    .filter(key => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b));

  if (!timestamps.length) {
    return null;
  }

  const todayTs = Number(fact.today || timestamps[0]);

  let targetTs = todayTs;

  if (!isToday) {
    const next = timestamps.find(ts => Number(ts) > todayTs);
    targetTs = next ? Number(next) : null;
  }

  if (!targetTs) {
    return null;
  }

  const day = fact.data[String(targetTs)];

  if (!day || typeof day !== "object") {
    return null;
  }

  const slots = day[groupId];

  if (!slots || typeof slots !== "object") {
    return null;
  }

  return slots;
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
