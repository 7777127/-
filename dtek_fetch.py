import asyncio
import json
from datetime import datetime, timezone, timedelta

from dtek_client import DtekClient

SITE_KEY = "kem"

CITY = "м. Київ"
STREET = "вул. Бальзака Оноре"
HOUSE = "63/Б"


async def main() -> None:
    async with DtekClient(SITE_KEY) as client:
        response = await client.get_home_num(CITY, STREET)

        house = response.find_house(HOUSE)

        if house is None:
            raise RuntimeError(
                f"Будинок {HOUSE!r} не знайдено на {STREET!r}. "
                f"Доступні будинки: {list(response.houses)[:30]}"
            )

        group_id = house.primary_group

        if not group_id:
            raise RuntimeError(
                f"DTEK не повернув групу для адреси "
                f"{STREET}, {HOUSE}."
            )

        today = None
        tomorrow = None
        group_name = ""

        if response.preset:
            group_name = str(
                response.preset.sch_names.get(group_id, "")
            )

        if response.fact:
            today = response.fact.get_group_today(group_id)

            tomorrow_date = (
                response.fact.today_date + timedelta(days=1)
            )

            tomorrow = response.fact.get_group_for_date(
                tomorrow_date,
                group_id,
            )

        group = (
            f"{CITY}, {STREET}, {HOUSE}"
        )

        if group_name:
            group += f" -> {group_name}"

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

    with open(
        "dtek-data.json",
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            result,
            f,
            ensure_ascii=False,
            indent=2,
            default=str,
        )

    print(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2,
            default=str,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
