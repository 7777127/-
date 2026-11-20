/* =================================
   📰 KYIV БЕЗПЕКА — НОВИНИ
================================= */

(function () {
  "use strict";

  const NEWS_URL = "./news-data.json";
  const REFRESH_MS = 5 * 60 * 1000;

  const regionNames = {
    kyiv: "Київ",
    "kyiv-region": "Київська область"
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "Час не вказано";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Час не вказано";
    }

    return date.toLocaleString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function importanceMeta(level) {
    if (level === "red") {
      return {
        icon: "🔴",
        label: "Важливо"
      };
    }

    if (level === "orange") {
      return {
        icon: "🟠",
        label: "Увага"
      };
    }

    return {
      icon: "⚪",
      label: "Інформація"
    };
  }

  function renderNews(items) {
    const card = document.getElementById("news-section");
    if (!card) return;

    const currentCity =
      localStorage.getItem("kyiv-bezpeka-city") || "kyiv";

    const relevant = items
      .filter(item =>
        item.region === currentCity ||
        (currentCity === "kyiv" && item.region === "kyiv-region")
      )
      .slice(0, 8);

    const visible =
      relevant.length ? relevant : items.slice(0, 8);

    if (!visible.length) {
      card.innerHTML = `
        <div class="card-topline">
          <div class="card-title">📰 Останні події</div>
          <span class="section-chip">ОЧІКУЄМО</span>
        </div>
        <div class="news-empty">
          Поки що нових офіційних повідомлень немає.
        </div>
      `;
      return;
    }

    card.innerHTML = `
      <div class="card-topline">
        <div class="card-title">📰 Останні події</div>
        <span class="section-chip">ОФІЦІЙНІ</span>
      </div>

      <div class="news-feed">
        ${visible.map(item => {
          const meta = importanceMeta(item.importance);

          return `
            <a class="news-feed-item news-level-${escapeHtml(item.importance)}"
               href="${escapeHtml(item.url)}"
               target="_blank"
               rel="noopener noreferrer">
              <div class="news-feed-icon">${meta.icon}</div>
              <div class="news-feed-main">
                <div class="news-feed-top">
                  <span class="news-feed-badge">${meta.label}</span>
                  <span class="news-feed-time">${formatDate(item.publishedAt)}</span>
                </div>
                <div class="news-feed-title">
                  ${escapeHtml(item.title)}
                </div>
                <div class="news-feed-source">
                  ${escapeHtml(item.source)} · Читати повністю →
                </div>
              </div>
            </a>
          `;
        }).join("")}
      </div>

      <div class="news-footer">
        Оновлюється автоматично · тільки офіційні джерела
      </div>
    `;
  }

  async function loadNews() {
    try {
      const response = await fetch(
        NEWS_URL + "?t=" + Date.now(),
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("News request failed");
      }

      const data = await response.json();
      renderNews(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.warn("Не вдалося завантажити новини:", error);
    }
  }

  function startNews() {
    loadNews();
    setInterval(loadNews, REFRESH_MS);

    const citySelect = document.getElementById("city-select");

    if (citySelect) {
      citySelect.addEventListener("change", function () {
        setTimeout(loadNews, 50);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startNews);
  } else {
    startNews();
  }
})();
