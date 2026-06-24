import json
import os
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DB_PATH = os.getenv(
    "STOCK_DB_PATH",
    "/Users/zhangyb04/code/github/zettaranc-skill/data/stock_data.sqlite",
)

app = FastAPI(title="ZettaRanc Daily Watch API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_connection() -> sqlite3.Connection:
    db_file = Path(DB_PATH)
    if not db_file.exists():
        raise FileNotFoundError(f"Database file not found: {DB_PATH}")
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_watchlist_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts_code TEXT NOT NULL UNIQUE,
            name TEXT,
            tags TEXT DEFAULT '',
            added_date TEXT DEFAULT CURRENT_TIMESTAMP,
            alert_enabled INTEGER DEFAULT 1,
            notes TEXT DEFAULT '',
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_watchlist_tags
        ON watchlist(tags)
        """
    )


def ensure_selection_cache_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS selection_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trade_date TEXT NOT NULL,
            signal TEXT NOT NULL,
            rank INTEGER NOT NULL,
            ts_code TEXT NOT NULL,
            name TEXT,
            close REAL,
            pct_chg REAL,
            vol_ratio REAL,
            tags TEXT DEFAULT '[]',
            generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(trade_date, signal, ts_code)
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_selection_cache_date_signal
        ON selection_cache(trade_date DESC, signal, rank)
        """
    )


def normalize_trade_date(raw: str | None) -> str:
    if not raw:
        with get_connection() as conn:
            row = conn.execute("SELECT MAX(trade_date) FROM daily_kline").fetchone()
            return row[0] if row and row[0] else ""
    if len(raw) == 8 and raw.isdigit():
        return raw
    return raw


def describe_strategy(row: dict[str, Any], indicator: dict[str, Any] | None) -> dict[str, Any]:
    pct_chg = float(row.get("pct_chg") or 0)
    is_limit_up = bool(row.get("is_limit_up"))
    vol_ratio = float(row.get("vol_ratio") or 0)
    tags: list[str] = []
    signal = "观察"

    if is_limit_up:
        tags.append("涨停")
        signal = "B1"
    elif pct_chg >= 8:
        tags.append("强势")
        signal = "B2"
    elif pct_chg >= 3:
        tags.append("反弹")

    if indicator:
        if indicator.get("is_fanbao"):
            tags.append("反包")
            signal = "B1"
        if indicator.get("is_beidou"):
            tags.append("北斗")
        if indicator.get("is_suoliang"):
            tags.append("缩量")
        if indicator.get("is_jiayin_zhenyang"):
            tags.append("甲寅真阳")
        if indicator.get("is_jiayang_zhenyin"):
            tags.append("甲阳真阴")
        if indicator.get("is_fangliang_yinxian"):
            tags.append("放量阴线")
        if bool(indicator.get("is_needle_20")):
            tags.append("单针")
        if indicator.get("brick_trend_up"):
            tags.append("红砖")
        elif indicator.get("brick_count"):
            tags.append("砖形观察")

    if vol_ratio >= 2.0:
        tags.append("量能放大")
    if pct_chg >= 15:
        tags.append("爆发")

    if signal == "观察" and tags:
        signal = "观察"

    return {
        "signal": signal,
        "tags": tags[:5],
        "summary": "结合 ZG 的 B1/B2、单针、红砖思路做风控判断。",
    }


def classify_selection_signal(row: dict[str, Any], indicator: dict[str, Any] | None) -> tuple[str | None, list[str]]:
    pct_chg = float(row.get("pct_chg") or 0)
    is_limit_up = bool(row.get("is_limit_up"))
    vol_ratio = float(row.get("vol_ratio") or 0)

    if is_limit_up or pct_chg >= 8 or (indicator and indicator.get("is_fanbao")):
        return "B1", ["涨停/强势", "反包"] if indicator and indicator.get("is_fanbao") else ["强势"]
    if pct_chg >= 3 and vol_ratio >= 1.3:
        return "B2", ["放量回调", "加速"]
    if indicator and bool(indicator.get("is_needle_20")):
        return "单针", ["单针", "短线观察"]
    return None, []


def get_recent_trade_dates(conn: sqlite3.Connection, limit: int = 10) -> list[str]:
    return [
        row[0]
        for row in conn.execute(
            """
            SELECT DISTINCT trade_date
            FROM daily_kline
            ORDER BY trade_date DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    ]


def rolling_value(values: list[float], index: int, window: int, fn: Any) -> float | None:
    if index + 1 < window:
        return None
    chunk = values[index + 1 - window : index + 1]
    return fn(chunk)


def rolling_ma(values: list[float], window: int) -> list[float | None]:
    return [
        rolling_value(values, index, window, lambda chunk: sum(chunk) / window)
        for index in range(len(values))
    ]


def rolling_hhv(values: list[float], window: int) -> list[float | None]:
    return [
        rolling_value(values, index, window, max)
        for index in range(len(values))
    ]


def rolling_llv(values: list[float], window: int) -> list[float | None]:
    return [
        rolling_value(values, index, window, min)
        for index in range(len(values))
    ]


def ema(values: list[float], window: int) -> list[float]:
    if not values:
        return []
    alpha = 2 / (window + 1)
    result = [values[0]]
    for value in values[1:]:
        result.append(alpha * value + (1 - alpha) * result[-1])
    return result


def tdx_sma(values: list[float], window: int, weight: int) -> list[float]:
    if not values:
        return []
    result = [values[0]]
    for value in values[1:]:
        result.append((weight * value + (window - weight) * result[-1]) / window)
    return result


def safe_div(numerator: float, denominator: float, fallback: float = 0) -> float:
    if denominator == 0:
        return fallback
    return numerator / denominator


def evaluate_selection_formula(history: list[sqlite3.Row]) -> dict[str, list[str]]:
    if len(history) < 115:
        return {}

    opens = [float(row["open"] if row["open"] is not None else row["close"] or 0) for row in history]
    highs = [float(row["high"] if row["high"] is not None else row["close"] or 0) for row in history]
    lows = [float(row["low"] if row["low"] is not None else row["close"] or 0) for row in history]
    closes = [float(row["close"] or 0) for row in history]
    volumes = [float(row["vol"] or 0) for row in history]

    ma14 = rolling_ma(closes, 14)
    ma28 = rolling_ma(closes, 28)
    ma57 = rolling_ma(closes, 57)
    ma114 = rolling_ma(closes, 114)

    high9 = rolling_hhv(highs, 9)
    low9 = rolling_llv(lows, 9)
    rsv = [
        50
        if high9[index] is None or low9[index] is None
        else safe_div(closes[index] - low9[index], high9[index] - low9[index], 0.5) * 100
        for index in range(len(history))
    ]
    k_values = tdx_sma(rsv, 3, 1)
    d_values = tdx_sma(k_values, 3, 1)
    j_values = [
        3 * k_values[index] - 2 * d_values[index]
        for index in range(len(history))
    ]

    zxdq = ema(ema(closes, 10), 10)
    zxdkx: list[float | None] = []
    for index in range(len(history)):
        parts = [ma14[index], ma28[index], ma57[index], ma114[index]]
        zxdkx.append(None if any(value is None for value in parts) else sum(parts) / 4)

    b1_series: list[bool] = []
    short_vol: list[float] = []
    long_vol: list[float] = []
    high_close3 = rolling_hhv(closes, 3)
    low3 = rolling_llv(lows, 3)
    high_close21 = rolling_hhv(closes, 21)
    low21 = rolling_llv(lows, 21)

    for index in range(len(history)):
        prev_close = closes[index - 1] if index > 0 else closes[index]
        amplitude = safe_div(highs[index] - lows[index], prev_close) * 100
        pct_chg = safe_div(closes[index], prev_close, 1) * 100 - 100
        center = zxdkx[index]
        b1_series.append(
            center is not None
            and j_values[index] < 17
            and closes[index] > center
            and zxdq[index] > center
            and amplitude <= 7
            and -2.98 <= pct_chg <= 2.95
        )

        short_range = (
            None
            if high_close3[index] is None or low3[index] is None
            else high_close3[index] - low3[index]
        )
        long_range = (
            None
            if high_close21[index] is None or low21[index] is None
            else high_close21[index] - low21[index]
        )
        short_vol.append(
            50
            if short_range is None
            else safe_div(closes[index] - low3[index], short_range, 0.5) * 100
        )
        long_vol.append(
            50
            if long_range is None
            else safe_div(closes[index] - low21[index], long_range, 0.5) * 100
        )

    index = len(history) - 1
    prev_close = closes[index - 1]
    pct_chg = safe_div(closes[index], prev_close, 1) * 100 - 100
    denominator = highs[index] - prev_close
    upper_shadow_ok = (
        closes[index] > opens[index]
        and denominator > 0
        and (highs[index] - closes[index]) / denominator < 0.3
    )
    b2 = (
        b1_series[index - 1]
        and pct_chg > 3.95
        and volumes[index] > volumes[index - 1]
        and j_values[index] < 80
        and upper_shadow_ok
    )
    needle = (
        len(history) >= 3
        and long_vol[index - 2] > 85
        and short_vol[index - 2] > 70
        and long_vol[index - 1] >= 70
        and short_vol[index - 1] >= 70
        and long_vol[index] > 70
        and short_vol[index] <= 30
    )

    result: dict[str, list[str]] = {}
    if b1_series[index]:
        result["B1"] = [
            "B1",
            f"J={j_values[index]:.1f}",
            "知行趋势上方",
        ]
    if b2:
        result["B2"] = [
            "B2",
            "昨日B1",
            "放量突破",
        ]
    if needle:
        result["单针"] = [
            "单针",
            f"短:{short_vol[index]:.1f}",
            f"长:{long_vol[index]:.1f}",
        ]
    return result


def build_selection_for_date(
    conn: sqlite3.Connection,
    trade_date: str,
    limit: int = 200,
) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT dk.ts_code, dk.trade_date, dk.close, dk.pct_chg, dk.vol,
               dk.vol_ratio, sb.name
        FROM daily_kline dk
        LEFT JOIN stock_basic sb ON sb.ts_code = dk.ts_code
        WHERE dk.trade_date = ?
        ORDER BY dk.pct_chg DESC, dk.vol DESC
        """,
        (trade_date,),
    ).fetchall()

    day_result: dict[str, Any] = {
        "trade_date": trade_date,
        "B1": [],
        "B2": [],
        "单针": [],
    }
    for row in rows:
        history = conn.execute(
            """
            SELECT trade_date, open, high, low, close, vol
            FROM daily_kline
            WHERE ts_code = ? AND trade_date <= ?
            ORDER BY trade_date ASC
            """,
            (row["ts_code"], trade_date),
        ).fetchall()
        signals = evaluate_selection_formula(history)
        for signal, tags in signals.items():
            day_result[signal].append(
                {
                    "ts_code": row["ts_code"],
                    "name": row["name"] or row["ts_code"],
                    "close": round(float(row["close"] or 0), 2),
                    "pct_chg": round(float(row["pct_chg"] or 0), 2),
                    "vol_ratio": round(float(row["vol_ratio"] or 1), 2),
                    "tags": tags,
                }
            )
    for signal in ["B1", "B2", "单针"]:
        day_result[signal].sort(
            key=lambda item: (float(item["pct_chg"] or 0), float(item["close"] or 0)),
            reverse=True,
        )
        day_result[signal] = day_result[signal][:limit]
    return day_result


def write_selection_cache(
    conn: sqlite3.Connection,
    days: list[dict[str, Any]],
) -> int:
    ensure_selection_cache_table(conn)
    total = 0
    for day in days:
        trade_date = day["trade_date"]
        conn.execute(
            "DELETE FROM selection_cache WHERE trade_date = ?",
            (trade_date,),
        )
        for signal in ["B1", "B2", "单针"]:
            for rank, item in enumerate(day.get(signal, []), start=1):
                conn.execute(
                    """
                    INSERT INTO selection_cache (
                        trade_date, signal, rank, ts_code, name, close,
                        pct_chg, vol_ratio, tags
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        trade_date,
                        signal,
                        rank,
                        item["ts_code"],
                        item["name"],
                        item["close"],
                        item["pct_chg"],
                        item["vol_ratio"],
                        json.dumps(item["tags"], ensure_ascii=False),
                    ),
                )
                total += 1
    conn.commit()
    return total


def read_selection_cache(
    conn: sqlite3.Connection,
    limit_days: int = 10,
) -> list[dict[str, Any]]:
    ensure_selection_cache_table(conn)
    trade_dates = [
        row[0]
        for row in conn.execute(
            """
            SELECT DISTINCT trade_date
            FROM selection_cache
            ORDER BY trade_date DESC
            LIMIT ?
            """,
            (limit_days,),
        ).fetchall()
    ]
    days: list[dict[str, Any]] = []
    for trade_date in trade_dates:
        day_result: dict[str, Any] = {
            "trade_date": trade_date,
            "B1": [],
            "B2": [],
            "单针": [],
        }
        rows = conn.execute(
            """
            SELECT signal, ts_code, name, close, pct_chg, vol_ratio, tags
            FROM selection_cache
            WHERE trade_date = ?
            ORDER BY signal, rank
            """,
            (trade_date,),
        ).fetchall()
        for row in rows:
            signal = row["signal"]
            if signal not in day_result:
                day_result[signal] = []
            try:
                tags = json.loads(row["tags"] or "[]")
            except json.JSONDecodeError:
                tags = []
            day_result[signal].append(
                {
                    "ts_code": row["ts_code"],
                    "name": row["name"] or row["ts_code"],
                    "close": round(float(row["close"] or 0), 2),
                    "pct_chg": round(float(row["pct_chg"] or 0), 2),
                    "vol_ratio": round(float(row["vol_ratio"] or 1), 2),
                    "tags": tags,
                }
            )
        days.append(day_result)
    return days


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "db": DB_PATH}


@app.get("/api/market-overview")
def market_overview(tradeDate: str | None = Query(default=None, alias="tradeDate")) -> dict[str, Any]:
    trade_date = normalize_trade_date(tradeDate)
    try:
        with get_connection() as conn:
            rows = conn.execute(
                """
                SELECT ts_code, trade_date, close, pct_chg, vol, vol_ratio, is_limit_up
                FROM daily_kline
                WHERE trade_date = ?
                ORDER BY pct_chg DESC, vol DESC
                LIMIT 20
                """,
                (trade_date,),
            ).fetchall()
            top_up = [dict(r) for r in rows if float(r["pct_chg"] or 0) >= 9]
            return {
                "trade_date": trade_date,
                "top_gainers": [
                    {
                        "ts_code": r["ts_code"],
                        "close": round(float(r["close"] or 0), 2),
                        "pct_chg": round(float(r["pct_chg"] or 0), 2),
                        "vol": round(float(r["vol"] or 0), 2),
                        "vol_ratio": round(float(r["vol_ratio"] or 1), 2),
                    }
                    for r in top_up[:10]
                ],
                "count": len(top_up),
            }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/daily-watch")
def daily_watch(tradeDate: str | None = Query(default=None, alias="tradeDate")) -> dict[str, Any]:
    trade_date = normalize_trade_date(tradeDate)
    try:
        with get_connection() as conn:
            daily_rows = conn.execute(
                """
                SELECT dk.ts_code, dk.trade_date, dk.close, dk.pct_chg, dk.vol, dk.vol_ratio,
                       dk.is_limit_up, sb.name
                FROM daily_kline dk
                LEFT JOIN stock_basic sb ON sb.ts_code = dk.ts_code
                WHERE dk.trade_date = ?
                ORDER BY dk.pct_chg DESC, dk.vol DESC
                LIMIT 60
                """,
                (trade_date,),
            ).fetchall()

            items: list[dict[str, Any]] = []
            for row in daily_rows:
                indicator_row = conn.execute(
                    """
                    SELECT is_fanbao, is_beidou, is_suoliang, is_jiayin_zhenyang,
                           is_jiayang_zhenyin, is_fangliang_yinxian, is_needle_20,
                           brick_count, brick_trend_up, signal, sell_score, sell_reason
                    FROM indicator_cache
                    WHERE ts_code = ?
                    ORDER BY trade_date DESC
                    LIMIT 1
                    """,
                    (row["ts_code"],),
                ).fetchone()
                indicator = dict(indicator_row) if indicator_row else None
                strategy = describe_strategy(dict(row), indicator)
                items.append(
                    {
                        "ts_code": row["ts_code"],
                        "name": row["name"] or row["ts_code"],
                        "trade_date": row["trade_date"],
                        "close": round(float(row["close"] or 0), 2),
                        "pct_chg": round(float(row["pct_chg"] or 0), 2),
                        "vol": round(float(row["vol"] or 0), 2),
                        "vol_ratio": round(float(row["vol_ratio"] or 1), 2),
                        "is_limit_up": bool(row["is_limit_up"]),
                        "signal": strategy["signal"],
                        "tags": strategy["tags"],
                        "summary": strategy["summary"],
                        "indicator": {
                            "signal": indicator["signal"] if indicator else "WATCH",
                            "sell_score": indicator["sell_score"] if indicator else 0,
                            "sell_reason": indicator["sell_reason"] if indicator else "",
                        },
                    }
                )

            return {
                "trade_date": trade_date,
                "items": items,
            }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/stock/{ts_code}")
def stock_detail(ts_code: str, tradeDate: str | None = Query(default=None, alias="tradeDate")) -> dict[str, Any]:
    trade_date = normalize_trade_date(tradeDate)
    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT ts_code, name FROM stock_basic WHERE ts_code = ?",
                (ts_code,),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="stock not found")
            daily_rows = conn.execute(
                """
                SELECT trade_date, open, high, low, close, pct_chg, vol, amount,
                       is_limit_up, is_limit_down
                FROM daily_kline
                WHERE ts_code = ?
                ORDER BY trade_date ASC
                """,
                (ts_code,),
            ).fetchall()
            indicator = conn.execute(
                "SELECT * FROM indicator_cache WHERE ts_code = ? ORDER BY trade_date DESC LIMIT 1",
                (ts_code,),
            ).fetchone()
            latest_trade_date = (
                daily_rows[-1]["trade_date"] if daily_rows else trade_date
            )
            return {
                "ts_code": ts_code,
                "name": row["name"],
                "trade_date": latest_trade_date,
                "history": [dict(r) for r in daily_rows],
                "indicator": dict(indicator) if indicator else None,
            }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/strategy-summary")
def strategy_summary() -> dict[str, Any]:
    return {
        "title": "ZG 交易参考",
        "principles": [
            "B1：强势起爆，优先看放量和板块共振。",
            "B2：加速段，确认后可继续保留部分仓位。",
            "单针：短线回调后若有反包，优先观察不追。",
            "红砖：连续红砖说明趋势延续，四块砖之后注意减仓或清仓。",
            "红砖变绿就走：这是最重要的纪律之一。",
        ],
    }


@app.get("/api/watchlist")
def watchlist() -> dict[str, Any]:
    try:
        with get_connection() as conn:
            ensure_watchlist_table(conn)
            rows = conn.execute(
                """
                SELECT ts_code, name, tags, notes, alert_enabled, added_date, updated_at
                FROM watchlist
                ORDER BY updated_at DESC
                LIMIT 200
                """
            ).fetchall()
            return {"items": [dict(r) for r in rows]}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/watchlist")
def add_watchlist_item(payload: dict[str, Any] = Body(default={})) -> dict[str, Any]:
    ts_code = str(payload.get("ts_code") or "").strip().upper()
    if not ts_code:
        raise HTTPException(status_code=400, detail="ts_code is required")

    try:
        with get_connection() as conn:
            ensure_watchlist_table(conn)
            stock_row = conn.execute(
                "SELECT name FROM stock_basic WHERE ts_code = ?",
                (ts_code,),
            ).fetchone()
            name = str(payload.get("name") or (stock_row["name"] if stock_row else ts_code))
            tags = str(payload.get("tags") or "")
            notes = str(payload.get("notes") or "")
            alert_enabled = 1 if payload.get("alert_enabled", True) else 0
            conn.execute(
                """
                INSERT INTO watchlist (ts_code, name, tags, notes, alert_enabled)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(ts_code) DO UPDATE SET
                    name = excluded.name,
                    tags = excluded.tags,
                    notes = excluded.notes,
                    alert_enabled = excluded.alert_enabled,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (ts_code, name, tags, notes, alert_enabled),
            )
            conn.commit()
            row = conn.execute(
                """
                SELECT ts_code, name, tags, notes, alert_enabled, added_date, updated_at
                FROM watchlist
                WHERE ts_code = ?
                """,
                (ts_code,),
            ).fetchone()
            return {"item": dict(row), "message": "added"}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.delete("/api/watchlist/{ts_code}")
def delete_watchlist_item(ts_code: str) -> dict[str, Any]:
    normalized_code = ts_code.strip().upper()
    if not normalized_code:
        raise HTTPException(status_code=400, detail="ts_code is required")

    try:
        with get_connection() as conn:
            ensure_watchlist_table(conn)
            cursor = conn.execute(
                "DELETE FROM watchlist WHERE ts_code = ?",
                (normalized_code,),
            )
            conn.commit()
            return {"deleted": cursor.rowcount, "ts_code": normalized_code}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/selection-history")
def selection_history() -> dict[str, Any]:
    try:
        with get_connection() as conn:
            history = read_selection_cache(conn)
            generated = False
            if not history:
                trade_dates = get_recent_trade_dates(conn)
                days = [build_selection_for_date(conn, date) for date in trade_dates]
                write_selection_cache(conn, days)
                history = read_selection_cache(conn)
                generated = True

            return {
                "signals": ["B1", "B2", "单针"],
                "days": history,
                "source": "cache",
                "generated": generated,
            }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/selection-history/refresh")
def refresh_selection_history(payload: dict[str, Any] = Body(default={})) -> dict[str, Any]:
    limit_days = int(payload.get("limit_days") or 10)
    limit_days = max(1, min(limit_days, 60))
    row_limit = int(payload.get("row_limit") or 200)
    row_limit = max(20, min(row_limit, 1000))
    trade_date = payload.get("trade_date")

    try:
        with get_connection() as conn:
            ensure_selection_cache_table(conn)
            trade_dates = [normalize_trade_date(str(trade_date))] if trade_date else get_recent_trade_dates(conn, limit_days)
            days = [
                build_selection_for_date(conn, date, limit=row_limit)
                for date in trade_dates
                if date
            ]
            cached_count = write_selection_cache(conn, days)
            return {
                "signals": ["B1", "B2", "单针"],
                "days": read_selection_cache(conn, limit_days),
                "cached_count": cached_count,
                "trade_dates": trade_dates,
            }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
