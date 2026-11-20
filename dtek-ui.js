const DTEK_DATA_URL =
  "https://raw.githubusercontent.com/7777127/-/main/dtek-data.json";


function getDtekAddress() {

  try {

    const saved =
      localStorage.getItem(DTEK_ADDRESS_KEY);

    if (saved) {

      const parsed =
        JSON.parse(saved);

      if (
        parsed &&
        typeof parsed === "object"
      ) {

        return {
          city:
            parsed.city ||
            DEFAULT_DTEK_ADDRESS.city,

          street:
            parsed.street ||
            DEFAULT_DTEK_ADDRESS.street,

          house:
            parsed.house ||
            DEFAULT_DTEK_ADDRESS.house,

          display:
            parsed.display ||
            DEFAULT_DTEK_ADDRESS.display
        };

      }

    }

  } catch (error) {

    console.warn(
      "DTEK address:",
      error
    );

  }

  return DEFAULT_DTEK_ADDRESS;

}


async function loadDtekSchedule() {

  const box =
    document.getElementById(
      "dtek-schedule"
    );

  if (!box) return;


  box.innerHTML =
    '<div class="dtek-loading">' +
    '🔄 Оновлюємо графік...' +
    '</div>';


  try {

    const response =
      await fetch(
        DTEK_DATA_URL +
        "?t=" +
        Date.now(),
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    const data =
      await response.json();


    if (!data.ok) {

      throw new Error(
        data.error ||
        "Не вдалося отримати графік"
      );

    }


    renderDtekSchedule(data);

  } catch (error) {

    console.error(
      "DTEK:",
      error
    );


    box.innerHTML =
      '<div class="dtek-loading">' +
      '⚠️ Не вдалося завантажити графік.' +
      '<br>' +
      '<small>' +
      'Спробуємо ще раз автоматично.' +
      '</small>' +
      '</div>';

  }

}


function renderDtekSchedule(data) {

  const box =
    document.getElementById(
      "dtek-schedule"
    );

  if (!box) return;


  const today =
    normalizeSchedule(
      data.today
    );


  const tomorrow =
    normalizeSchedule(
      data.tomorrow
    );


  const groupText =
    extractGroup(
      data.group
    );


  box.innerHTML =

    '<div class="dtek-result">' +

      '<div class="dtek-status">' +

        '<strong>💡 Графік ДТЕК</strong>' +

        (
          groupText
            ? '<span>Адреса: ' +
              escapeHtml(groupText) +
              '</span>'
            : ''
        ) +

      '</div>' +


      '<div class="dtek-day">' +

        '<div class="dtek-day-title">' +
          'Сьогодні' +
        '</div>' +

        renderTable(today) +

      '</div>' +


      '<div class="dtek-day">' +

        '<div class="dtek-day-title">' +
          'Завтра' +
        '</div>' +

        renderTable(tomorrow) +

      '</div>' +


      '<div class="dtek-legend">' +

        '<span>' +
          '<i class="dtek-legend-green"></i>' +
          'Світло є' +
        '</span>' +

        '<span>' +
          '<i class="dtek-legend-dark"></i>' +
          'Світла немає' +
        '</span>' +

        '<span>' +
          '<i class="dtek-legend-first"></i>' +
          'Перші 30 хв.' +
        '</span>' +

        '<span>' +
          '<i class="dtek-legend-second"></i>' +
          'Другі 30 хв.' +
        '</span>' +

        '<span>' +
          '<i class="dtek-legend-yellow"></i>' +
          'Аварійне' +
        '</span>' +

        '<span>' +
          '<i class="dtek-legend-empty"></i>' +
          'Немає даних' +
        '</span>' +

      '</div>' +


      '<div class="dtek-updated">' +
        'Оновлено: ' +
        formatUpdated(data.fetchedAt) +
      '</div>' +

    '</div>';

}


function normalizeSchedule(value) {

  const result = [];


  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {

    return result;

  }


  for (
    let hour = 1;
    hour <= 24;
    hour++
  ) {

    let status = "unknown";


    const raw =
      value[String(hour)];


    if (
      raw !== undefined &&
      raw !== null &&
      raw !== ""
    ) {

      status =
        normalizeStatus(raw);

    }


    result.push({
      hour,
      status
    });

  }


  return result;

}


function normalizeStatus(value) {

  const status =
    String(value || "")
      .trim()
      .toLowerCase();


  if (
    [
      "yes",
      "on",
      "normal",
      "light"
    ].includes(status)
  ) {

    return "normal";

  }


  if (
    [
      "no",
      "off",
      "outage"
    ].includes(status)
  ) {

    return "outage";

  }


  if (
    [
      "first",
      "mfirst",
      "first-half",
      "first_half"
    ].includes(status)
  ) {

    return "first-half";

  }


  if (
    [
      "second",
      "msecond",
      "second-half",
      "second_half"
    ].includes(status)
  ) {

    return "second-half";

  }


  if (
    [
      "maybe",
      "emergency",
      "emergency-outage"
    ].includes(status)
  ) {

    return "emergency";

  }


  return "unknown";

}


function getCurrentKyivHour() {

  const hourText =
    new Intl.DateTimeFormat(
      "uk-UA",
      {
        timeZone: "Europe/Kyiv",
        hour: "2-digit",
        hour12: false
      }
    ).format(new Date());

  const hour = Number(hourText);

  return hour >= 24 ? 0 : hour;
}


function renderTable(schedule) {

  if (!schedule || schedule.length === 0) {
    return (
      '<div class="dtek-empty-day">' +
      '⚪ Даних за цей день поки немає' +
      '</div>'
    );
  }

  const hours = {};

  schedule.forEach(item => {
    const hour = Number(item.hour);

    if (hour >= 1 && hour <= 24) {
      hours[hour] = item.status;
    }
  });

  const now = new Date();
  const kyivParts = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);

  const nowHour = Number(kyivParts.find(p => p.type === "hour")?.value || 0);
  const nowMinute = Number(kyivParts.find(p => p.type === "minute")?.value || 0);
  const currentMinutes = nowHour * 60 + nowMinute;

  // DTEK uses hour keys 1..24 for the intervals 00:00–01:00 ... 23:00–24:00.
  // "first-half" means the first 30 minutes are without power.
  // "second-half" means the second 30 minutes are without power.
  const slots = [];

  for (let hour = 1; hour <= 24; hour++) {

    const status = hours[hour] || "unknown";

    if (status === "first-half") {
      slots.push({ hour: hour - 1, minute: 0, status: "outage" });
      slots.push({ hour: hour - 1, minute: 30, status: "normal" });
    } else if (status === "second-half") {
      slots.push({ hour: hour - 1, minute: 0, status: "normal" });
      slots.push({ hour: hour - 1, minute: 30, status: "outage" });
    } else {
      slots.push({ hour: hour - 1, minute: 0, status });
      slots.push({ hour: hour - 1, minute: 30, status });
    }
  }

  const statusLabel = status => {
    if (status === "normal") return "Світло є";
    if (status === "outage") return "Світла немає";
    if (status === "emergency") return "Аварійне відключення";
    return "Немає даних";
  };

  const classForStatus = status => {
    if (status === "normal") return "dtek-cell-green";
    if (status === "outage") return "dtek-cell-dark";
    if (status === "emergency") return "dtek-cell-yellow";
    return "dtek-cell-empty";
  };

  // Build exact contiguous time intervals, just like the DTEK schedule:
  // 00:00–01:00, 01:00–07:00, 07:00–08:00, etc.
  const intervals = [];

  slots.forEach(slot => {
    const current = slot.hour * 60 + slot.minute;

    if (
      intervals.length > 0 &&
      intervals[intervals.length - 1].status === slot.status &&
      intervals[intervals.length - 1].end === current
    ) {
      intervals[intervals.length - 1].end += 30;
    } else {
      intervals.push({
        start: current,
        end: current + 30,
        status: slot.status
      });
    }
  });

  const formatTime = minutes => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;

    return (
      String(h).padStart(2, "0") +
      ":" +
      String(m).padStart(2, "0")
    );
  };

  let intervalRows = "";

  intervals.forEach(interval => {
    const isCurrent =
      currentMinutes >= interval.start &&
      currentMinutes < interval.end;

    let rowClass =
      classForStatus(interval.status);

    if (isCurrent) {
      rowClass += " dtek-current-hour";
    }

    let title =
      formatTime(interval.start) +
      "–" +
      formatTime(interval.end) +
      " • " +
      statusLabel(interval.status);

    if (isCurrent) {
      title += " • Зараз";
    }

    intervalRows +=
      '<div class="dtek-interval-row ' +
      rowClass +
      '" title="' +
      escapeHtml(title) +
      '">' +
        '<span class="dtek-interval-time">' +
          formatTime(interval.start) +
          '–' +
          formatTime(interval.end) +
        '</span>' +
        '<span class="dtek-interval-status">' +
          statusLabel(interval.status) +
        '</span>' +
      '</div>';
  });

  // Compact 24-hour timeline, visually similar to the DTEK schedule.
  let timeline = "";

  slots.forEach(slot => {
    const slotStart = slot.hour * 60 + slot.minute;
    const isCurrent =
      currentMinutes >= slotStart &&
      currentMinutes < slotStart + 30;

    let slotClass =
      classForStatus(slot.status);

    if (isCurrent) {
      slotClass += " dtek-current-hour";
    }

    timeline +=
      '<div class="dtek-half-hour ' +
      slotClass +
      '" title="' +
      escapeHtml(
        formatTime(slot.hour * 60 + slot.minute) +
        "–" +
        formatTime(slot.hour * 60 + slot.minute + 30) +
        " • " +
        statusLabel(slot.status)
      ) +
      '"></div>';
  });

  let hourLabels = "";

  for (let hour = 0; hour < 24; hour++) {
    hourLabels +=
      '<span>' +
      String(hour).padStart(2, "0") +
      ':00' +
      '</span>';
  }

  return (
    '<div class="dtek-table-wrapper">' +

      '<div class="dtek-intervals">' +
        '<div class="dtek-interval-title">Часові проміжки</div>' +
        intervalRows +
      '</div>' +

      '<div class="dtek-timeline-title">Графік на добу</div>' +

      '<div class="dtek-timeline-labels">' +
        hourLabels +
      '</div>' +

      '<div class="dtek-timeline">' +
        timeline +
      '</div>' +

    '</div>'
  );
}



function extractGroup(value) {

  if (!value) return "";


  const text =
    String(value);


  const match =
    text.match(
      /Черга\s+\d+(?:\.\d+)?/i
    );


  return match
    ? match[0]
    : text;

}


function formatUpdated(value) {

  if (!value) {

    return "невідомо";

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "невідомо";

  }


  return date.toLocaleString(
    "uk-UA",
    {
      timeZone: "Europe/Kyiv",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


function escapeHtml(value) {

  return String(value)

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


loadDtekSchedule();


setInterval(
  loadDtekSchedule,
  45 * 60 * 1000
);