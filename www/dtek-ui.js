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
            ? '<span>Черга: ' +
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


  let hour =
    Number(hourText);


  if (hour === 0) {

    hour = 24;

  }


  return hour;

}


function renderTable(schedule) {

  if (
    !schedule ||
    schedule.length === 0
  ) {

    return (
      '<div class="dtek-empty-day">' +
      '⚪ Даних за цей день поки немає' +
      '</div>'
    );

  }


  const hours = {};


  schedule.forEach(
    item => {

      const hour =
        Number(item.hour);


      if (
        hour >= 1 &&
        hour <= 24
      ) {

        hours[hour] =
          item.status;

      }

    }
  );


  const currentHour =
    getCurrentKyivHour();


  let cells = "";


  for (
    let hour = 1;
    hour <= 24;
    hour++
  ) {

    const status =
      hours[hour] ||
      "unknown";


    let statusClass =
      "dtek-cell-empty";


    let title =
      "Немає даних";


    if (
      status === "normal"
    ) {

      statusClass =
        "dtek-cell-green";

      title =
        "Світло є";

    }


    else if (
      status === "outage"
    ) {

      statusClass =
        "dtek-cell-dark";

      title =
        "Світла немає";

    }


    else if (
      status === "first-half"
    ) {

      statusClass =
        "dtek-cell-first-half";

      title =
        "Перші 30 хв. — світла немає";

    }


    else if (
      status === "second-half"
    ) {

      statusClass =
        "dtek-cell-second-half";

      title =
        "Другі 30 хв. — світла немає";

    }


    else if (
      status === "emergency"
    ) {

      statusClass =
        "dtek-cell-yellow";

      title =
        "Аварійне відключення";

    }


    if (
      hour === currentHour
    ) {

      statusClass +=
        " dtek-current-hour";

      title +=
        " • Зараз";

    }


    const hourText =
      String(hour)
        .padStart(2, "0");


    cells +=

      '<div class="dtek-hour-cell ' +
      statusClass +
      '" title="' +
      escapeHtml(title) +
      '">' +

        '<div class="dtek-hour-number">' +
          hourText +
        '</div>' +

        '<div class="dtek-hour-block">' +
        '</div>' +

      '</div>';

  }


  return (

    '<div class="dtek-table-wrapper">' +

      '<div class="dtek-table">' +

        cells +

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
  10 * 60 * 1000
);