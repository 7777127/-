import json
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (KYIV-bezpeka/1.0)"
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

MONTHS = {
    "січня": 1, "лютого": 2, "березня": 3, "квітня": 4,
    "травня": 5, "червня": 6, "липня": 7, "серпня": 8,
    "вересня": 9, "жовтня": 10, "листопада": 11, "грудня": 12,
}

DATE_RE = re.compile(
    r"(\d{1,2})\s+"
    r"(січня|лютого|березня|квітня|травня|червня|липня|серпня|"
    r"вересня|жовтня|листопада|грудня)"
    r"(?:,)?\s+(\d{4})"
)

BAD_PATHS = (
    "/category/", "/tag/", "/author/", "/page/", "/search",
    "/wp-admin", "/wp-json", "/feed", "/contact", "/about",
)

SKIP_TITLES = {
    "детальніше", "показати", "меню", "контакти", "пошук",
    "діяльність", "установи", "громадськості", "усі новини",
    "архів", "головна", "мапа порталу", "нормативна база",
    "проєкти рішень", "читати далі",
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


def importance(title):
    text = title.lower()

    urgent = (
        "ракет", "шахед", "дрон", "бпла", "обстріл",
        "удар", "вибух", "атака", "тривог"
    )
    important = (
        "безпек", "надзвичай", "рятув", "захист",
        "пошкоджен", "відновлен", "знеструм", "опален",
        "укрит", "цивільн"
    )

    if any(word in text for word in urgent):
        return "red"
    if any(word in text for word in important):
        return "orange"
    return "normal"


def valid_link(anchor, source):
    title = clean_text(anchor.get_text(" ", strip=True))
    href = anchor.get("href", "")

    if not 20 <= len(title) <= 240:
        return None

    if title.lower() in SKIP_TITLES:
        return None

    url = urljoin(source["url"], href)
    parsed = urlparse(url)

    if parsed.netloc.lower() != source["host"]:
        return None

    path = parsed.path.rstrip("/")
    if not path or any(path.startswith(p) for p in BAD_PATHS):
        return None

    return title, url


def fetch_source(source):
    response = requests.get(
        source["url"],
        headers=HEADERS,
        timeout=30,
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    items = []
    seen_urls = set()

    # Prefer semantic article/news containers; fall back to all links.
    anchors = soup.select(
        "article a[href], .news a[href], .news-item a[href], "
        ".post a[href], .article a[href], main a[href], a[href]"
    )

    for anchor in anchors:
        candidate = valid_link(anchor, source)
        if not candidate:
            continue

        title, url = candidate
        if url in seen_urls:
            continue

        seen_urls.add(url)

        container = anchor
        for _ in range(4):
            if container.parent is None:
                break
            container = container.parent

            text = clean_text(container.get_text(" ", strip=True))
            published = parse_date(text)

            if published:
                break
        else:
            published = None

        # Keep only links that look like actual news entries.
        path = urlparse(url).path.lower()
        looks_like_news = (
            published is not None
            or any(token in path for token in ("/news/", "/novyny/", "/2026/"))
        )

        if not looks_like_news:
            continue

        items.append({
            "id": f"{source['region']}:{url}",
            "title": title,
            "source": source["name"],
            "region": source["region"],
            "url": url,
            "publishedAt": published.isoformat() if published else None,
            "importance": importance(title),
        })

        if len(items) >= 20:
            break

    return items


def main():
    all_items = []

    for source in SOURCES:
        try:
            source_items = fetch_source(source)
            print(f"{source['name']}: {len(source_items)} items")
            all_items.extend(source_items)
        except Exception as error:
            print(f"News source failed: {source['name']}: {error}")

    unique = {item["id"]: item for item in all_items}
    items = list(unique.values())

    items.sort(
        key=lambda item: item["publishedAt"] or "",
        reverse=True,
    )

    result = {
        "ok": bool(items),
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "items": items[:40],
    }

    with open("news-data.json", "w", encoding="utf-8") as file:
        json.dump(result, file, ensure_ascii=False, indent=2)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
