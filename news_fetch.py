import hashlib
import json
import re
from datetime import datetime, timedelta, timezone

from bs4 import BeautifulSoup
import requests

OUTPUT_FILE = "news-data.json"
RETENTION_DAYS = 3  # 2 або 3 дні — скільки тримати новини в стрічці

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

SOURCES = [
    {
        "prefix": "kyivinfo",
        "name": "Київ ІНФО",
        "region": "kyiv",
        "url": "https://t.me/kievinfo_kyiv",
        "web_url": "https://t.me/s/kievinfo_kyiv",
    },
    {
        "prefix": "kyivnebo",
        "name": "Київ Небо",
        "region": "kyiv",
        "url": "https://t.me/kyiv_nebo",
        "web_url": "https://t.me/s/kyiv_nebo",
    },
]

URGENT_WORDS = (
    "ракет", "шахед", "дрон", "бпла", "обстріл",
    "удар", "вибух", "атака", "тривог", "пуски", "балістик",
)

IMPORTANT_WORDS = (
    "безпек", "надзвичай", "рятув", "захист",
    "пошкоджен", "відновлен", "знеструм", "світл",
    "опален", "укрит", "цивільн", "метро", "транспорт",
)


def clean_text(value):
    return re.sub(r"\s+", " ", value or "").strip()


def importance(title, full_text=""):
    text = f"{title} {full_text}".lower()
    if any(word in text for word in URGENT_WORDS):
        return "red"
    if any(word in text for word in IMPORTANT_WORDS):
        return "orange"
    return "normal"


def parse_published_dt(raw_dt):
    if not raw_dt:
        return None
    try:
        dt = datetime.fromisoformat(raw_dt.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def make_id(prefix, key):
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def load_existing_items(cutoff_dt):
    """Завантажує попередні новини та залишає лише актуальні за RETENTION_DAYS."""
    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return [], None
    except json.JSONDecodeError as err:
        msg = f"Пошкоджений {OUTPUT_FILE}: {err}"
        print(f"ПОПЕРЕДЖЕННЯ: {msg}")
        return [], msg
    except OSError as err:
        msg = f"Помилка читання {OUTPUT_FILE}: {err}"
        print(f"ПОПЕРЕДЖЕННЯ: {msg}")
        return [], msg

    raw_items = data.get("items") if isinstance(data, dict) else []
    if not isinstance(raw_items, list):
        return [], None

    kept = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        dt = parse_published_dt(item.get("publishedAt"))
        if dt and dt >= cutoff_dt:
            kept.append(item)

    return kept, None


def fetch_source(source, cutoff_dt):
    """Отримує пости з публічної веб-сторінки каналу та повертає (items, error_str)."""
    try:
        response = requests.get(
            source["web_url"],
            headers=HEADERS,
            timeout=25,
        )
        response.raise_for_status()
    except requests.Timeout:
        err = f"{source['name']}: таймаут запиту"
        print(f"News source failed: {err}")
        return [], err
    except requests.HTTPError as exc:
        code = exc.response.status_code if exc.response is not None else "unknown"
        err = f"{source['name']}: HTTP {code}"
        print(f"News source failed: {err}")
        return [], err
    except requests.RequestException as exc:
        err = f"{source['name']}: помилка мережі ({exc})"
        print(f"News source failed: {err}")
        return [], err

    try:
        soup = BeautifulSoup(response.text, "html.parser")
        messages = soup.select(".tgme_widget_message_wrap")
    except Exception as exc:
        err = f"{source['name']}: помилка парсингу HTML ({exc})"
        print(f"News source failed: {err}")
        return [], err

    items = []
    for msg in messages[-20:]:
        try:
            text_el = msg.select_one(".tgme_widget_message_text")
            time_el = msg.select_one("time.time")
            link_el = msg.select_one(".tgme_widget_message_date")

            raw_multiline = text_el.get_text("\n", strip=True) if text_el else ""
            full_text = clean_text(raw_multiline)
            if not full_text:
                continue

            first_line = raw_multiline.split("\n")[0].strip() if raw_multiline else full_text
            title = first_line[:120] + "..." if len(first_line) > 120 else first_line

            dt = parse_published_dt(time_el.get("datetime") if time_el else None) or datetime.now(timezone.utc)
            if dt < cutoff_dt:
                continue

            post_url = (link_el.get("href") if link_el else "") or source["url"]
            dedup_key = post_url.strip() if post_url.strip() != source["url"] else f"{source['name']}::{full_text}"

            items.append({
                "id": make_id(source["prefix"], dedup_key),
                "title": title,
                "text": full_text,
                "source": source["name"],
                "region": source["region"],
                "url": post_url,
                "publishedAt": dt.isoformat(),
                "importance": importance(title, full_text),
            })
        except Exception as exc:
            print(f"ПОПЕРЕДЖЕННЯ ({source['name']}): пропущено пост через помилку: {exc}")
            continue

    print(f"{source['name']}: {len(items)} items")
    return items, None


def main():
    now_dt = datetime.now(timezone.utc)
    cutoff_dt = now_dt - timedelta(days=RETENTION_DAYS)

    existing_items, load_err = load_existing_items(cutoff_dt)
    fetched_items = []
    errors = []

    if load_err:
        errors.append(load_err)

    for source in SOURCES:
        source_items, err = fetch_source(source, cutoff_dt)
        if err:
            errors.append(err)
        fetched_items.extend(source_items)

    # Об'єднуємо старі (за останні RETENTION_DAYS днів) та нові записи без дублікатів
    merged = {}
    for item in existing_items:
        item_id = item.get("id") or make_id(item.get("source", "src"), item.get("url") or item.get("text", ""))
        merged[item_id] = item

    for item in fetched_items:
        merged[item["id"]] = item

    items = list(merged.values())
    items.sort(
        key=lambda x: parse_published_dt(x.get("publishedAt")) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    result = {
        "ok": len(items) > 0 or len(errors) < len(SOURCES),
        "fetchedAt": now_dt.isoformat(),
        "retentionDays": RETENTION_DAYS,
        "count": len(items),
        "items": items,
    }
    if errors:
        result["errors"] = errors

    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
            json.dump(result, file, ensure_ascii=False, indent=2)
    except OSError as exc:
        print(f"КРИТИЧНА ПОМИЛКА запису {OUTPUT_FILE}: {exc}")
        raise SystemExit(1)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
