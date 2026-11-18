import json
import re
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": "KYIV-bezpeka-news-bot/1.0 (+https://github.com/7777127/-)"
}

SOURCES = [
    {
        "name": "Київська ОВА",
        "region": "kyiv-region",
        "url": "https://koda.gov.ua/news/",
        "host": "koda.gov.ua",
    },
    {
        "name": "Департамент муніципальної безпеки КМДА",
        "region": "kyiv",
        "url": "https://dmbk.kyivcity.gov.ua/",
        "host": "dmbk.kyivcity.gov.ua",
    },
]

DATE_RE = re.compile(
    r"(\d{1,2})\s+"
    r"(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)"
    r"(?:,)?\s+(\d{4})"
    r"|"
    r"(\d{1,2}):(\d{2}),?\s+(\d{1,2})\s+"
    r"(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)"
    r"\s+(\d{4})"
)

MONTHS = {
    "січня": 1, "лютого": 2, "березня": 3, "квітня": 4,
    "травня": 5, "червня": 6, "липня": 7, "серпня": 8,
    "вересня": 9, "жовтня": 10, "листопада": 11, "грудня": 12,
}

SKIP_WORDS = {
    "детальніше", "показати", "меню", "контакти", "пошук",
    "діяльність", "установи", "громадськості", "про департамент",
    "усі новини", "архів", "головна", "мапа порталу",
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(value or "")).strip()


def parse_date(text: str):
    match = DATE_RE.search(text)
    if not match:
        return None

    if match.group(1):
        day = int(match.group(1))
        month = MONTHS[match.group(2)]
        year = int(match.group(3))
        return datetime(year, month, day, tzinfo=timezone.utc)

    hour = int(match.group(4))
    minute = int(match.group(5))
    day = int(match.group(6))
    month = MONTHS[match.group(7)]
    year = int(match.group(8))
    return datetime(
        year, month, day, hour, minute, tzinfo=timezone.utc
    )


def is_candidate(anchor, source):
    title = clean_text(anchor.get_text(" ", strip=True))
    href = anchor.get("href", "")
    if len(title) < 20 or len(title) > 220:
        return False

    lowered = title.lower()
    if lowered in SKIP_WORDS:
        return False

    if any(word in lowered for word in SKIP_WORDS):
        if lowered.startswith(tuple(SKIP_WORDS)):
            return False

    absolute = urljoin(source["url"], href)
    parsed = urlparse(absolute)

    if parsed.netloc != source["host"]:
        return False

    path = parsed.path.rstrip("/")
    if not path or path in {"/news", "/search", "/contact"}:
        return False

    blocked = (
        "/category/", "/tag/", "/author/", "/page/",
        "/wp-admin", "/wp-json", "/feed",
    )
    if any(part in path for part in blocked):
        return False

    return True


def classify(title: str) -> str:
    text = title.lower()

    critical = (
        "ата", "обстріл", "дрон", "бпла", "рак", "вибух",
        "пожеж", "постраж", "загин", "руйнув", "укрит",
        "тривог", "небезпек"
    )
    important = (
        "безпек", "світломаскування", "надзвичай", "рятув",
        "захист", "пошкоджен", "відновлен"
    )

    if any(word in text for word in critical):
        return "red"
    if any(word in text for word in important):
        return "orange"
    return "normal"


def fetch_source(source):
    response = requests.get(
        source["url"],
        headers=HEADERS,
        timeout=25,
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    items = []
    seen = set()

    for anchor in soup.select("a[href]"):
        if not is_candidate(anchor, source):
            continue

        title = clean_text(anchor.get_text(" ", strip=True))
        url = urljoin(source["url"], anchor["href"])
        key = (title.lower(), url)

        if key in seen:
            continue

        seen.add(key)

        parent_text = clean_text(
            anchor.parent.get_text(" ", strip=True)
            if anchor.parent else ""
        )
        published = parse_date(parent_text)

        items.append({
            "id": f"{source['region']}:{url}",
            "title": title,
            "source": source["name"],
            "region": source["region"],
            "url": url,
            "publishedAt": published.isoformat() if published else None,
            "importance": classify(title),
        })

        if len(items) >= 12:
            break

    return items


def main():
    all_items = []

    for source in SOURCES:
        try:
            all_items.extend(fetch_source(source))
        except Exception as error:
            print(f"News source failed: {source['name']}: {error}")

    # Безпечна дедуплікація та стабільне сортування.
    unique = {}
    for item in all_items:
        unique[item["id"]] = item

    items = list(unique.values())
    items.sort(
        key=lambda item: item["publishedAt"] or "",
        reverse=True,
    )

    result = {
        "ok": bool(items),
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "items": items[:20],
    }

    with open("news-data.json", "w", encoding="utf-8") as file:
        json.dump(
            result,
            file,
            ensure_ascii=False,
            indent=2,
        )

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
