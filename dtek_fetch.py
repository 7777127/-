import asyncio
import json
from datetime import datetime, timezone

from curl_cffi.requests import AsyncSession
from dtek_client import DtekClient
from dtek_client.browser_auth import get_cleared_cookies

CITY = "м. Київ"
STREET = "вул. Бальзака Оноре де"
HOUSE = "63Б"

BASE_URL = "https://www.dtek-kem.com.ua"
SCHEDULE_URL = f"{BASE_URL}/ua/shutdowns"
AJAX_URL = f"{BASE_URL}/ua/ajax"


async def main():
    cookies, csrf_token = await get_cleared_cookies(SCHEDULE_URL)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "uk,en;q=0.9",
        "Origin": BASE_URL,
        "Referer": SCHEDULE_URL,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }

    if csrf_token:
        headers["X-CSRF-Token"] = csrf_token

    async with AsyncSession(
        timeout=30,
        headers=headers,
        cookies=cookies,
        impersonate="chrome120",
    ) as session:
        async with DtekClient(
            "kem",
            ajax_url=AJAX_URL,
            session=session,
        ) as client:
            group = await client.get_group_by_address(CITY, STREET, HOUSE)
            today = await client.get_today_schedule(CITY, STREET, HOUSE)
            tomorrow = await client.get_tomorrow_schedule(CITY, STREET, HOUSE)

    result = {
        "ok": True,
        "address": f"{STREET}, {HOUSE}, {CITY}",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "group": group,
        "today": today,
        "tomorrow": tomorrow,
    }

    with open("dtek-data.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2, default=str)

    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
