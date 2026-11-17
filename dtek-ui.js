const DTEK_DATA_URL =
  "https://raw.githubusercontent.com/7777127/-/main/dtek-data.json";

async function loadDtekSchedule() {
  const box = document.getElementById("dtek-schedule");
  if (!box) return;

  box.innerHTML = '<div class="dtek-loading">🔄 Оновлюємо графік...</div>';

  try {
    const response = await fetch(DTEK_DATA_URL + "?t=" + Date.now(), {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "Не вдалося отримати графік");
    }

    renderDtekSchedule(data);
  } catch (error) {
    box.innerHTML =
      '<div class="dtek-loading">⚠️ Не вдалося завантажити графік.<br><small>Спробуємо ще раз автоматично.</small></div>';
    console.error("DTEK:", error);
  }
}

function renderDtekSchedule(data) {
  const box = document.getElementById("dtek-schedule");
  if (!box) return;

  const today = normalizeSchedule(data.today);
  const tomorrow = normalizeSchedule(data.tomorrow);

  const groupText = extractGroup(data.group);

  box.innerHTML = `
    <div class="dtek-result">
      <div class="dtek-status">
        <strong>📅 Графік ДТЕК</strong>
        ${groupText ? `<span>Група: ${escapeHtml(groupText)}</span>` : ""}
      </div>

      <div class="dtek-day">
        <div class="dtek-day-title">Сьогодні</div>
        <div class="dtek-intervals">
          ${renderIntervals(today)}
        </div>
      </div>

      <div class="dtek-day">
        <div class="dtek-day-title">Завтра</div>
        <div class="dtek-intervals">
          ${renderIntervals(tomorrow)}
        </div>
      </div>

      <div class="dtek-updated">
        Оновлено: ${formatUpdated(data.fetchedAt)}
      </div>
    </div>
  `;
}

function normalizeSchedule(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return null;

        const from = item.from ?? item.start ?? item.begin ?? item.timeFrom;
        const to = item.to ?? item.end ?? item.finish ?? item.timeTo;

        if (from != null && to != null) return `${from}–${to}`;
        return item.time ?? item.interval ?? item.label ?? null;
      })
      .filter(Boolean);
  }

  if (typeof value === "object") {
    const possible = value.intervals || value.schedule || value.outages ||
      value.data || value.items;

    if (Array.isArray(possible)) return normalizeSchedule(possible);
  }

  return [];
}

function renderIntervals(intervals) {
  if (!intervals.length) {
    return '<span class="dtek-no-outage">🟢 За отриманими даними відключень немає</span>';
  }

  return intervals
    .map(time => `<span class="dtek-interval">⚡ ${escapeHtml(String(time))}</span>`)
    .join("");
}

function extractGroup(value) {
  if (!value) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object") {
    return String(
      value.group ??
      value.queue ??
      value.name ??
      value.number ??
      value.id ??
      ""
    );
  }

  return "";
}

function formatUpdated(value) {
  if (!value) return "невідомо";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "невідомо";

  return date.toLocaleString("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadDtekSchedule();

setInterval(loadDtekSchedule, 10 * 60 * 1000);
