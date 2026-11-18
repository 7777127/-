import json
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "KYIV-bezpeka-news-bot/1.0"
}

SOURCES = [
    {
        "name": "Київська ОВА",
        "region": "kyiv-region",
        "url": "https://koda.gov.ua/",
        "host": "koda.gov.ua",
    },
    {
        "name": "Київська міська рада",
        "region": "kyiv",
        "url": "https://kmr.gov.ua/",
        "host": "kmr.gov.ua",
    },
]

DATE_RE = re.compile(
    r"(\d{1,2})\s+"
    r"(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)"
    r"(?:,)?\s+(\d{4})"
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
    "нормативна база", "проєкти рішень",
}


def clean_text(value):
    return re.sub(r"\s+", " ", value or "").strip()


def parse_date(text):
    match = DATE_RE.search(text or "")
    if not match:
        return None

    return datetime(
        int(match.group(3)),
        MONTHS[match.group(2)],
        int(match.group(1)),
        tzinfo=timezone.utc,
    )


def is_candidate(anchor, source):
    title = clean_text(anchor.get_text(" ", strip=True))
    href = anchor.get("href", "")

    if len(title) < 20 or len(title) > 240:
        return False

    lowered = title.lower()
    if lowered in SKIP_WORDS:
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


def classify(title):
    text = title.lower()

    important = (
        "безпек", "надзвичай", "рятув", "захист",
        "пошкоджен", "відновлен", "знеструм", "опален"
    )

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

        if (title.lower(), url) in seen:
            continue

        seen.add((title.lower(), url))

        parent = anchor.parent
        parent_text = clean_text(
            parent.get_text(" ", strip=True) if parent else ""
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

        if len(items) >= 15:
            break

    return items


def main():
    all_items = []

    for source in SOURCES:
        try:
            all_items.extend(fetch_source(source))
        except Exception as error:
            print(f"News source failed: {source['name']}: {error}")

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
        "items": items[:30],
    }

    with open("news-data.json", "w", encoding="utf-8") as file:
        json.dump(result, file, ensure_ascii=False, indent=2)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
