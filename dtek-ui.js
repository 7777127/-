const DTEK_DATA_URL =
  "https://raw.githubusercontent.com/7777127/-/main/dtek-data.json";

/*
  Після розгортання dtek-worker.js встав сюди адресу Worker.
  Наприклад:
  const DTEK_WORKER_URL = "https://kyiv-bezpeka-dtek.workers.dev/dtek";
*/
const DTEK_WORKER_URL = "https://kyiv-bezpeka.pincukoleksandr42.workers.dev/dtek";

const DTEK_ADDRESS_KEY = "kyiv-bezpeka-dtek-address";

const DEFAULT_DTEK_ADDRESS = {
  city: "м. Київ",
  street: "вул. Бальзака Оноре",
  house: "63/Б",
  display: "Оноре де Бальзака 63Б, Київ"
};

function getDtekAddress() {
  try {
    const saved = localStorage.getItem(DTEK_ADDRESS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.city && parsed.street && parsed.house) {
        return {
          city: parsed.city,
          street: parsed.street,
          house: parsed.house,
          display: parsed.display || `${parsed.street}, ${parsed.house}, ${parsed.city}`
        };
      }
    }
  } catch (error) {
    console.warn("DTEK address:", error);
  }

  return DEFAULT_DTEK_ADDRESS;
}

function saveDtekAddress(address) {
  localStorage.setItem(DTEK_ADDRESS_KEY, JSON.stringify(address));
}

function updateDtekAddress() {
  const element = document.getElementById("dtek-address");
  if (!element) return;

  element.textContent = getDtekAddress().display;
}

function openDtekAddressSettings() {
  const current = getDtekAddress();

  const city = window.prompt(
    "Місто для ДТЕК:",
    current.city
  );

  if (city === null) return;

  const street = window.prompt(
    "Вулиця для ДТЕК:",
    current.street
  );

  if (street === null) return;

  const house = window.prompt(
    "Номер будинку:",
    current.house
  );

  if (house === null) return;

  const cleanCity = city.trim();
  const cleanStreet = street.trim();
  const cleanHouse = house.trim();

  if (!cleanCity || !cleanStreet || !cleanHouse) {
    alert("Будь ласка, заповни місто, вулицю та номер будинку.");
    return;
  }

  const address = {
    city: cleanCity,
    street: cleanStreet,
    house: cleanHouse,
    display: `${cleanStreet.replace(/^вул\.\\s*/i, "")} ${cleanHouse}, ${cleanCity.replace(/^м\.\\s*/i, "")}`
  };

  saveDtekAddress(address);
  updateDtekAddress();

  loadDtekSchedule();
}

function setDtekLoading(text = "🔄 Оновлюємо графік...") {
  const box = document.getElementById("dtek-schedule");
  if (box) {
    box.innerHTML = `<div class="dtek-loading">${text}</div>`;
  }
}

async function loadDtekSchedule() {
  const box = document.getElementById("dtek-schedule");
  if (!box) return;

  setDtekLoading();

  try {
    const address = getDtekAddress();

    let data;

    if (DTEK_WORKER_URL) {
      const params = new URLSearchParams({
        city: address.city,
        street: address.street,
        house: address.house
      });

      const response = await fetch(
        DTEK_WORKER_URL + "?" + params.toString(),
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("DTEK Worker HTTP " + response.status);
      }

      data = await response.json();
    } else {
      const response = await fetch(
        DTEK_DATA_URL + "?t=" + Date.now(),
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      data = await response.json();
    }

    if (!data.ok) {
      throw new Error(data.error || "Не вдалося отримати графік");
    }

    renderDtekSchedule(data, address);
  } catch (error) {
    console.error("DTEK:", error);

    box.innerHTML =
      '<div class="dtek-loading">⚠️ Не вдалося завантажити графік.<br><small>Спробуємо ще раз автоматично.</small></div>';
  }
}

function renderDtekSchedule(data, address) {
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

function normalizeSchedule(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === "string") {
          return { label: item, type: "unknown" };
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
    const possible =
      value.intervals ||
      value.schedule ||
      value.outages ||
      value.data ||
      value.items;

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

  if (status === "no" || status === "off" || status === "outage") {
    return "outage";
  }

  if (status === "yes" || status === "on" || status === "normal") {
    return "normal";
  }

  if (
    status === "first" ||
    status === "mfirst" ||
    status === "first-half" ||
    status === "first_half"
  ) {
    return "partial-first";
  }

  if (
    status === "second" ||
    status === "msecond" ||
    status === "second-half" ||
    status === "second_half"
  ) {
    return "partial-second";
  }

  if (
    status === "maybe" ||
    status === "emergency" ||
    status === "emergency-outage"
  ) {
    return "emergency";
  }

  return "unknown";
}

function renderSummary(schedule) {
  if (!schedule.length) {
    return '<span class="dtek-no-outage">⚪ Даних за цей день поки немає</span>';
  }

  if (!schedule[0].hour) return "";

  const outages = schedule.filter(item =>
    item.status === "outage" ||
    item.status === "partial-first" ||
    item.status === "partial-second" ||
    item.status === "emergency"
  ).length;

  if (!outages) {
    return '<span class="dtek-no-outage">🟢 За отриманими даними відключень немає</span>';
  }

  return `<span class="dtek-outage-count">⚡ Періодів із відключенням: ${outages}</span>`;
}

function renderIntervals(schedule) {
  if (!schedule.length) {
    return '<div class="dtek-graph-empty">⚪ Даних за цей день поки немає</div>';
  }

  if (!schedule[0].hour) {
    return `
      <div class="dtek-graph-legacy">
        ${schedule.map(item =>
          `<span class="dtek-interval">⚡ ${escapeHtml(String(item.label))}</span>`
        ).join("")}
      </div>
    `;
  }

  return `
    <div class="dtek-graph">
      <div class="dtek-graph-head">
        <span>Час</span>
        <span>Графік</span>
      </div>
      <div class="dtek-graph-list">
        ${schedule.map(item => {
          const hour = Number(item.hour);
          const nextHour = hour === 24 ? 24 : hour + 1;
          const label = String(hour).padStart(2, "0") + ":00";
          const endLabel = String(nextHour).padStart(2, "0") + ":00";

          let first = "on";
          let second = "on";

          if (item.status === "outage") {
            first = second = "off";
          } else if (item.status === "partial-first") {
            first = "off";
          } else if (item.status === "partial-second") {
            second = "off";
          } else if (item.status === "emergency") {
            first = second = "emergency";
          }

          const firstText =
            first === "off" ? "Немає" :
            first === "emergency" ? "Аварія" : "Є";

          const secondText =
            second === "off" ? "Немає" :
            second === "emergency" ? "Аварія" : "Є";

          return `
            <div class="dtek-graph-row">
              <span class="dtek-graph-time">${label}–${endLabel}</span>
              <div class="dtek-graph-track">
                <span class="dtek-half dtek-half-${first}" title="${label}–${String(hour).padStart(2,"0")}:30">
                  <b>${firstText}</b>
                </span>
                <span class="dtek-half dtek-half-${second}" title="${String(hour).padStart(2,"0")}:30–${endLabel}">
                  <b>${secondText}</b>
                </span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
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

updateDtekAddress();
loadDtekSchedule();

setInterval(loadDtekSchedule, 10 * 60 * 1000);
