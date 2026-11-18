import asyncio
import json
from datetime import datetime, timezone

from dtek_client import DtekClient

CITY = "м. Київ"
STREET = "вул. Бальзака Оноре де"
HOUSE = "63Б"


async def main():
    async with DtekClient("kem", timeout=30) as client:
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
