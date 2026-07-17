#!/usr/bin/env python3
"""
Live demo feeder: every INTERVAL seconds, append ONE new daily row to each
`excel_company_*` table in dev_catalog_for_individual_use.kevin_dev so the
running app (30s polling) shows data growing in real time.

The new row's date = max(Date)+1 for that table; its metrics are drawn from the
table's own last-14-day averages with mild jitter, kept internally consistent
(adspend=clicks*cpc, conversions=clicks*cvr, revenue=conversions*rev_per_conv,
roas=revenue/adspend). No DDL, INSERT only, dev schema only.

Every change is logged to scripts/live_feed.log (and stdout).

Usage:
  python scripts/live_feed.py            # loop forever, every 2 min
  python scripts/live_feed.py --once     # one tick, then exit
  python scripts/live_feed.py --dry-run  # print the INSERTs, execute nothing
  INTERVAL=30 python scripts/live_feed.py

Auth from env: DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID
(default warehouse 060a27190dd3ecb5).
"""
import os
import sys
import time
import random
from datetime import date, datetime, timedelta

from databricks import sql  # databricks-sql-connector

CATALOG = os.environ.get("DATABRICKS_CATALOG", "dev_catalog_for_individual_use")
SCHEMA = os.environ.get("DATABRICKS_SCHEMA", "kevin_dev")
WAREHOUSE_ID = os.environ.get("DATABRICKS_WAREHOUSE_ID", "060a27190dd3ecb5")
PREFIX = "excel_company_"
INTERVAL = int(os.environ.get("INTERVAL", "120"))  # 2 minutes
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "live_feed.log")

DRY_RUN = "--dry-run" in sys.argv
ONCE = "--once" in sys.argv

# Safety net: never touch a production catalog.
if CATALOG.lower().startswith("prod"):
    sys.exit(f"Refusing to target production catalog {CATALOG!r}")


def log(msg):
    """Print and append a timestamped line to the change log."""
    line = f"{datetime.now().isoformat(timespec='seconds')}  {msg}"
    print(line, flush=True)
    try:
        with open(LOG_PATH, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def connect():
    host = os.environ["DATABRICKS_HOST"].replace("https://", "").rstrip("/")
    return sql.connect(
        server_hostname=host,
        http_path=f"/sql/1.0/warehouses/{WAREHOUSE_ID}",
        access_token=os.environ["DATABRICKS_TOKEN"],
    )


def company_tables(cur):
    cur.execute(f"SHOW TABLES IN `{CATALOG}`.`{SCHEMA}` LIKE '{PREFIX}*'")
    return sorted(r[1] for r in cur.fetchall() if str(r[1]).startswith(PREFIX))


def jitter(x, pct=0.12):
    return x * (1 + random.uniform(-pct, pct))


def next_row_sql(cur, table):
    assert table.startswith(PREFIX), table  # never write outside managed tables
    fq = f"`{CATALOG}`.`{SCHEMA}`.`{table}`"
    cur.execute(
        f"SELECT CAST(MAX(Date) AS STRING), "
        f"AVG(Clicks), AVG(CPC), AVG(CVR), AVG(ROAS) "
        f"FROM {fq} WHERE Date >= date_sub((SELECT MAX(Date) FROM {fq}), 14)"
    )
    max_d, clicks, cpc, cvr, roas = cur.fetchone()
    if not max_d:
        return None, None
    d = date.fromisoformat(max_d) + timedelta(days=1)
    day = WEEKDAYS[d.weekday()]

    # Draw the independent metrics from recent norms; derive the rest so the
    # canonical identities (adspend=clicks·cpc, conv=clicks·cvr, rev=adspend·roas) hold.
    clicks_n = max(1, round(jitter(float(clicks or 0))))
    cpc_n = max(0.05, jitter(float(cpc or 0)))
    adspend_n = round(clicks_n * cpc_n, 2)
    cvr_n = max(0.001, jitter(float(cvr or 0)))
    conv_n = max(0, round(clicks_n * cvr_n))
    roas_n = round(max(0.0, jitter(float(roas or 0))), 4)
    revenue_n = round(adspend_n * roas_n, 2)

    sql_stmt = (
        f"INSERT INTO {fq} "
        f"(Date, Day, Total_Adspend, Clicks, CPC, Revenue, Conversions, ROAS, CVR) VALUES "
        f"(DATE'{d.isoformat()}', '{day}', {adspend_n}, {clicks_n}, {round(cpc_n,4)}, "
        f"{revenue_n}, {conv_n}, {roas_n}, {round(cvr_n,5)})"
    )
    return sql_stmt, d.isoformat()


def tick():
    with connect() as conn, conn.cursor() as cur:
        for table in company_tables(cur):
            stmt, d = next_row_sql(cur, table)
            if not stmt:
                log(f"{table}: no data, skipped")
                continue
            if DRY_RUN:
                print(f"  {stmt}")
            else:
                cur.execute(stmt)
                log(f"{table}: +1 row for {d}")


def main():
    log(f"live_feed → {CATALOG}.{SCHEMA} ({'DRY RUN' if DRY_RUN else 'writing'}), "
        f"interval {INTERVAL}s, log {LOG_PATH}")
    while True:
        try:
            tick()
        except Exception as e:  # keep the demo feeder alive across transient errors
            log(f"tick failed: {e}")
        if ONCE or DRY_RUN:
            break
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
