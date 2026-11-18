import asyncio
import json
from datetime import datetime, timezone

from curl_cffi.requests import AsyncSession
from dtek_client import DtekClient
from dtek_client.browser_auth import get_cleared_cookies

BASE_URL = "https://www.dtek-kem.com.ua"
SCHEDULE_URL = f"{BASE_URL}/ua/shutdowns"

CITY = "м. Київ"
STREET = "вул. Бальзака Оноре де"
HOUSE = "63Б"


async def main():
    cookies, csrf_token = await get_cleared_cookies(SCHEDULE_URL)

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "uk,en;q=0.9",
        "Origin": BASE_URL,
        "Referer": SCHEDULE_URL,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }

    if csrf_token:
        headers["X-CSRF-Token"] = csrf_token

    session = AsyncSession(
        timeout=30.0,
        headers=headers,
        cookies=cookies,
        impersonate="chrome120",
    )

    async with DtekClient(
        "kem",
        ajax_url=f"{BASE_URL}/ua/ajax",
        session=session,
        timeout=30,
    ) as client:
        response = await client.get_home_num(CITY, STREET)

        group = await client.get_group_by_address(
            CITY,
            STREET,
            HOUSE,
            response=response,
        )

        today = await client.get_today_schedule(
            CITY,
            STREET,
            HOUSE,
            response=response,
        )

        tomorrow = await client.get_tomorrow_schedule(
            CITY,
            STREET,
            HOUSE,
            response=response,
        )

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
