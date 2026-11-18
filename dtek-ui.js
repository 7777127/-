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
        <div class="dtek-summary">
          ${renderSummary(today)}
        </div>
        <div class="dtek-intervals">
          ${renderIntervals(today)}
        </div>
      </div>

      <div class="dtek-day">
        <div class="dtek-day-title">Завтра</div>
        <div class="dtek-summary">
          ${renderSummary(tomorrow)}
        </div>
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

/*
  DTEK повертає погодинну карту:
  1..24 -> yes / no / first / second / ...
  Важливо: "no" = гарантоване відключення,
  "yes" = електроенергія гарантовано є,
  "first"/"second" = часткове відключення в межах години.
*/
function normalizeSchedule(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === "string") {
          return {
            label: item,
            type: "unknown"
          };
        }

        if (!item || typeof item !== "object") return null;

        const from = item.from ?? item.start ?? item.begin ?? item.timeFrom;
        const to = item.to ?? item.end ?? item.finish ?? item.timeTo;

        if (from != null && to != null) {
          return {
            label: `${from}–${to}`,
            type: normalizeStatus(item.status ?? item.state ?? item.type)
          };
        }

        return {
          label: item.time ?? item.interval ?? item.label ?? "",
          type: normalizeStatus(item.status ?? item.state ?? item.type)
        };
      })
      .filter(item => item && item.label);
  }

  if (typeof value === "object") {
    const possible = value.intervals || value.schedule || value.outages ||
      value.data || value.items;

    if (Array.isArray(possible)) {
      return normalizeSchedule(possible);
    }

    const numericKeys = Object.keys(value)
      .filter(key => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b));

    if (numericKeys.length) {
      return numericKeys.map(key => ({
        hour: Number(key),
        status: normalizeStatus(value[key])
      }));
    }
  }

  return [];
}

function normalizeStatus(value) {
  const status = String(value ?? "").toLowerCase();

  if (status === "no") return "outage";
  if (status === "yes") return "normal";
  if (status === "first") return "partial-first";
  if (status === "second") return "partial-second";
  if (status === "mfirst") return "partial-first";
  if (status === "msecond") return "partial-second";
  if (status === "maybe") return "maybe";

  return "unknown";
}

function renderSummary(schedule) {
  if (!schedule.length) {
    return '<span class="dtek-no-outage">ℹ️ Даних за цей день поки немає</span>';
  }

  if (!schedule[0].hour) {
    return "";
  }

  const outages = schedule.filter(item =>
    item.status === "outage" ||
    item.status === "partial-first" ||
    item.status === "partial-second"
  ).length;

  if (!outages) {
    return '<span class="dtek-no-outage">🟢 За отриманими даними відключень немає</span>';
  }

  return `<span class="dtek-outage-count">⚡ Періодів із відключенням: ${outages}</span>`;
}

function renderIntervals(schedule) {
  if (!schedule.length) {
    return '<span class="dtek-no-outage">ℹ️ Даних за цей день поки немає</span>';
  }

  if (!schedule[0].hour) {
    return schedule
      .map(item => `<span class="dtek-interval">⚡ ${escapeHtml(String(item.label))}</span>`)
      .join("");
  }

  return schedule
    .map(item => {
      const hour = String(item.hour).padStart(2, "0");
      const nextHour = String(item.hour === 24 ? 24 : item.hour + 1).padStart(2, "0");

      if (item.status === "outage") {
        return `
          <div class="dtek-hour dtek-hour-outage">
            <span class="dtek-hour-time">${hour}:00–${nextHour}:00</span>
            <span class="dtek-hour-status">🔴 Відключення</span>
          </div>
        `;
      }

      if (item.status === "partial-first") {
        return `
          <div class="dtek-hour dtek-hour-partial">
            <span class="dtek-hour-time">${hour}:00–${nextHour}:00</span>
            <span class="dtek-hour-status">🟡 Часткове відключення — перша частина</span>
          </div>
        `;
      }

      if (item.status === "partial-second") {
        return `
          <div class="dtek-hour dtek-hour-partial">
            <span class="dtek-hour-time">${hour}:00–${nextHour}:00</span>
            <span class="dtek-hour-status">🟡 Часткове відключення — друга частина</span>
          </div>
        `;
      }

      if (item.status === "maybe") {
        return `
          <div class="dtek-hour dtek-hour-maybe">
            <span class="dtek-hour-time">${hour}:00–${nextHour}:00</span>
            <span class="dtek-hour-status">🟠 Можливе відключення</span>
          </div>
        `;
      }

      return `
        <div class="dtek-hour dtek-hour-normal">
          <span class="dtek-hour-time">${hour}:00–${nextHour}:00</span>
          <span class="dtek-hour-status">🟢 Світло є</span>
        </div>
      `;
    })
    .join("");
}

function extractGroup(value) {
  if (!value) return "";

  if (typeof value === "string" || typeof value === "number") {
    const match = String(value).match(/Черга\s+[^,]+/i);
    return match ? match[0] : String(value);
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadDtekSchedule();

setInterval(loadDtekSchedule, 10 * 60 * 1000);
