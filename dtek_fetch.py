import asyncio
import json
from datetime import datetime, timezone

from dtek_client import DtekClient

SITE_KEY = "kem"
CITY = "м. Київ"
STREET = "вул. Оноре де Бальзака"
HOUSE = "63Б"


async def main() -> None:
    # The library handles the DTEK Yii2 CSRF bootstrap itself.
    async with DtekClient(SITE_KEY) as client:
        # Fetch the complete house/group/schedule response for the street.
        response = await client.get_home_num(CITY, STREET)

        # Verify that the requested house exists before reading schedules.
        house = response.find_house(HOUSE)
        if house is None:
            raise RuntimeError(
                f"House {HOUSE!r} was not found on {STREET!r}. "
                f"Available houses sample: {list(response.houses)[:20]}"
            )

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
        "site": SITE_KEY,
        "address": {
            "city": CITY,
            "street": STREET,
            "house": HOUSE,
        },
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
