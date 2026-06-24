import os
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
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
            rows = conn.execute(
                "SELECT ts_code, name, tags, notes, alert_enabled FROM watchlist ORDER BY updated_at DESC LIMIT 20"
            ).fetchall()
            return {"items": [dict(r) for r in rows]}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/selection-history")
def selection_history() -> dict[str, Any]:
    try:
        with get_connection() as conn:
            trade_dates = [
                row[0]
                for row in conn.execute(
                    "SELECT DISTINCT trade_date FROM daily_kline ORDER BY trade_date DESC LIMIT 10"
                ).fetchall()
            ]
            history: list[dict[str, Any]] = []
            for trade_date in trade_dates:
                rows = conn.execute(
                    """
                    SELECT dk.ts_code, dk.trade_date, dk.close, dk.pct_chg, dk.vol, dk.vol_ratio,
                           dk.is_limit_up, sb.name
                    FROM daily_kline dk
                    LEFT JOIN stock_basic sb ON sb.ts_code = dk.ts_code
                    WHERE dk.trade_date = ?
                    ORDER BY dk.pct_chg DESC, dk.vol DESC
                    LIMIT 80
                    """,
                    (trade_date,),
                ).fetchall()

                day_result = {"trade_date": trade_date, "B1": [], "B2": [], "单针": []}
                for row in rows:
                    indicator_row = conn.execute(
                        """
                        SELECT is_fanbao, is_needle_20, signal
                        FROM indicator_cache
                        WHERE ts_code = ? AND trade_date = ?
                        LIMIT 1
                        """,
                        (row["ts_code"], trade_date),
                    ).fetchone()
                    indicator = dict(indicator_row) if indicator_row else None
                    signal, tags = classify_selection_signal(dict(row), indicator)
                    if signal:
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
                history.append(day_result)

            return {"signals": ["B1", "B2", "单针"], "days": history}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
