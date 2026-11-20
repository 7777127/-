import asyncio
import json
from datetime import datetime, timezone, timedelta

from dtek_client import DtekClient

SITE_KEY = "kem"
CITY = "м. Київ"
STREET = "вул. Бальзака Оноре"
HOUSE = "63/Б"

# DTEK currently lists 63/Б separately from 63-В.
# 63/Б belongs to queue 9.1, while 63-В belongs to queue 11.1.
HOUSE_QUEUE_OVERRIDES = {
    "63/Б": "9.1",
}


async def main() -> None:
    async with DtekClient(SITE_KEY) as client:
        response = await client.get_home_num(CITY, STREET)

        house = response.find_house(HOUSE)
        if house is None:
            raise RuntimeError(
                f"House {HOUSE!r} was not found on {STREET!r}. "
                f"Available houses sample: {list(response.houses)[:20]}"
            )

        # Use the address-specific queue when DTEK's house entry incorrectly
        # resolves 63/Б to the neighbouring 63-В entry.
        queue_override = HOUSE_QUEUE_OVERRIDES.get(HOUSE)

        if queue_override and response.preset:
            group_id = None
            group_name = None

            for gid, name in response.preset.sch_names.items():
                name_text = str(name)
                if queue_override in name_text:
                    group_id = gid
                    group_name = name_text
                    break

            if group_id is None:
                raise RuntimeError(
                    f"Queue {queue_override!r} was not found in DTEK preset. "
                    f"Available queues: {dict(response.preset.sch_names)}"
                )
        else:
            group_id = house.primary_group
            group_name = ""

        if not group_id:
            raise RuntimeError(f"No DTEK group found for {HOUSE!r}.")

        if not group_name:
            group_name = str(group_id)

        today = None
        tomorrow = None

        if response.fact:
            today = response.fact.get_group_today(group_id)

            tomorrow_date = response.fact.today_date + timedelta(days=1)
            tomorrow = response.fact.get_group_for_date(
                tomorrow_date,
                group_id,
            )

        group = f"{CITY}, {STREET}, {HOUSE} -> {group_name}"

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
        json.dump(
            result,
            f,
            ensure_ascii=False,
            indent=2,
            default=str,
        )

    print(json.dumps(
        result,
        ensure_ascii=False,
        indent=2,
        default=str,
    ))


if __name__ == "__main__":
    asyncio.run(main())
