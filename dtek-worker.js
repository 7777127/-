const DTEK_URL = "https://www.dtek-kem.com.ua/ua/shutdowns";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "KYIV безпека — DTEK proxy"
      });
    }

    if (url.pathname !== "/dtek") {
      return json({ ok: false, error: "Not found" }, 404);
    }

    const address = (url.searchParams.get("address") || "").trim();

    if (!address) {
      return json({
        ok: false,
        error: "Потрібна адреса"
      }, 400);
    }

    try {
      const response = await fetch(DTEK_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KYIV-bezpeka/1.0)",
          "Accept": "text/html,application/xhtml+xml"
        }
      });

      if (!response.ok) {
        return json({
          ok: false,
          error: "ДТЕК тимчасово недоступний",
          status: response.status
        }, 502);
      }

      const html = await response.text();

      return json({
        ok: true,
        address,
        source: DTEK_URL,
        fetchedAt: new Date().toISOString(),
        dtekPageAvailable: html.length > 1000,
        message: "Сторінка ДТЕК отримана. Наступним кроком підключаємо адресний AJAX-запит."
      });
    } catch (error) {
      return json({
        ok: false,
        error: "Не вдалося отримати дані ДТЕК"
      }, 502);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
