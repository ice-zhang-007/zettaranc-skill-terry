import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";

const navItems = [
  { to: "/", label: "首页" },
  { to: "/daily-watch", label: "每日看盘" },
  { to: "/screener", label: "策略观察" },
  { to: "/selection", label: "选股列表" },
  { to: "/watchlist", label: "自选股" },
  { to: "/strategy-backtest", label: "策略回测" },
  { to: "/indicators", label: "指标" },
];

function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api${path}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, loading, error };
}

function StatCard({ title, value, hint }) {
  return (
    <div className="card stat-card">
      <div className="label">{title}</div>
      <div className="value">{value}</div>
      <div className="hint">{hint}</div>
    </div>
  );
}

function StockLink({ ts_code, name, className = "stock-link" }) {
  return (
    <Link to={`/stock/${ts_code}`} className={className}>
      <strong>{name || ts_code}</strong>
      <div className="hint">{ts_code}</div>
    </Link>
  );
}

function HomePage() {
  const { data, loading, error } = useApi(
    "/market-overview?trade_date=20260624",
  );
  const { data: dailyData, loading: dailyLoading } = useApi(
    "/daily-watch?tradeDate=20260624",
  );

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>ZettaRanc 看盘终端</h1>
          <p>
            基于 SQLite 的股票数据，结合 ZG 的 B1/B2、单针、红砖思路做即时观察。
          </p>
        </div>
        <div className="pill">参考站点：每日看盘 / 策略观察 / 自选股</div>
      </section>

      <div className="stats-grid">
        <StatCard
          title="最新交易日"
          value="2026-06-24"
          hint="以数据库最新可用日期为准"
        />
        <StatCard
          title="强势股数"
          value={data?.count ?? "-"}
          hint="当日涨幅 ≥ 9%"
        />
        <StatCard
          title="首屏看盘"
          value={dailyData?.items?.length ?? "-"}
          hint="优先展示高强度票"
        />
      </div>

      <div className="card">
        <h2>今日强势榜</h2>
        {loading && <p>正在加载...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && data?.top_gainers?.length ? (
          <ul className="list">
            {data.top_gainers.map((item) => (
              <li key={item.ts_code}>
                <StockLink ts_code={item.ts_code} name={item.ts_code} /> ·{" "}
                {item.pct_chg}% · 成交额 {item.vol}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="card">
        <h2>今日重点观察</h2>
        {dailyLoading && <p>正在加载...</p>}
        {!dailyLoading &&
          dailyData?.items?.slice(0, 8).map((item) => (
            <div key={item.ts_code} className="row-item">
              <div>
                <StockLink ts_code={item.ts_code} name={item.name} />
                <div className="hint">
                  {item.pct_chg}% · {item.vol_ratio} 倍量
                </div>
              </div>
              <div className="badge-wrap">
                <span className="badge">{item.signal}</span>
                {item.tags.map((tag) => (
                  <span key={tag} className="badge secondary">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function DailyWatchPage() {
  const { data, loading, error } = useApi("/daily-watch?tradeDate=20260624");

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>每日看盘</h1>
          <p>把当日涨幅、量能、ZG策略标签组合成一张可读性更强的观察表。</p>
        </div>
      </section>

      <div className="card">
        {loading && <p>正在加载...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && data?.items?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>股票</th>
                  <th>涨跌幅</th>
                  <th>量比</th>
                  <th>信号</th>
                  <th>标签</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.ts_code}>
                    <td>
                      <StockLink ts_code={item.ts_code} name={item.name} />
                    </td>
                    <td>{item.pct_chg}%</td>
                    <td>{item.vol_ratio}</td>
                    <td>{item.signal}</td>
                    <td>
                      <div className="badge-wrap">
                        {item.tags.map((tag) => (
                          <span key={tag} className="badge secondary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScreenerPage() {
  const { data, loading } = useApi("/strategy-summary");
  const { data: watchData } = useApi("/watchlist");

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>策略观察</h1>
          <p>用 B1/B2、红砖、单针等细节把行情判断做成更容易执行的规则。</p>
        </div>
      </section>

      <div className="card">
        <h2>ZG 参考原则</h2>
        {loading && <p>正在加载...</p>}
        {data?.principles?.map((item) => (
          <div key={item} className="row-item">
            <span className="badge">规则</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>自选股快照</h2>
        {watchData?.items?.slice(0, 10).map((item) => (
          <div key={item.ts_code} className="row-item">
            <div>
              <StockLink ts_code={item.ts_code} name={item.name} />
            </div>
            <span className="badge secondary">{item.tags || "观察"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SelectionPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const { data, loading, error } = useApi(
    `/selection-history?refresh=${refreshKey}`,
  );
  const [activeTab, setActiveTab] = useState("B1");
  const [activeDate, setActiveDate] = useState("");

  const tabItems = data?.signals || ["B1", "B2", "单针"];
  const dayItems = data?.days || [];
  const selectedDate = activeDate || dayItems[0]?.trade_date || "";
  const selectedDay = dayItems.find((day) => day.trade_date === selectedDate);
  const selectedItems = selectedDay?.[activeTab] || [];

  useEffect(() => {
    if (!dayItems.length) return;
    if (!selectedDate || !dayItems.some((day) => day.trade_date === selectedDate)) {
      setActiveDate(dayItems[0].trade_date);
    }
  }, [dayItems, selectedDate]);

  const runSelection = () => {
    setRefreshing(true);
    setRefreshMessage("");
    fetch("/api/selection-history/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit_days: 10, row_limit: 200 }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`一键选股失败：${res.status}`);
        return res.json();
      })
      .then((json) => {
        setRefreshMessage(`已缓存 ${json.cached_count ?? 0} 条选股结果`);
        setRefreshKey((value) => value + 1);
      })
      .catch((e) => {
        setRefreshMessage(String(e));
      })
      .finally(() => {
        setRefreshing(false);
      });
  };

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>选股列表</h1>
          <p>
            按 B1、B2、单针 三个维度，保留最近 10 日的打点结果，便于回看和对比。
          </p>
        </div>
        <button
          className="action-button"
          type="button"
          onClick={runSelection}
          disabled={refreshing}
        >
          {refreshing ? "选股中..." : "一键选股"}
        </button>
      </section>

      <div className="card">
        {refreshMessage ? <p className="hint">{refreshMessage}</p> : null}
        <div className="tabs">
          {tabItems.map((item) => (
            <button
              key={item}
              className={`tab-button ${activeTab === item ? "active" : ""}`}
              onClick={() => setActiveTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="tabs date-tabs">
          {dayItems.map((day) => (
            <button
              key={day.trade_date}
              className={`tab-button ${selectedDate === day.trade_date ? "active" : ""}`}
              onClick={() => setActiveDate(day.trade_date)}
            >
              {day.trade_date.slice(4)}
            </button>
          ))}
        </div>
        {loading && <p>正在加载...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && selectedDay ? (
          <div className="selection-list">
            <div className="selection-day">
              <div className="selection-day-header">
                <strong>{selectedDay.trade_date}</strong>
                <span className="badge secondary">{selectedItems.length} 只</span>
              </div>
              {selectedItems.length ? (
                <div className="selection-items">
                  {selectedItems.map((item) => (
                    <div
                      key={`${selectedDay.trade_date}-${item.ts_code}`}
                      className="row-item"
                    >
                      <div>
                        <StockLink ts_code={item.ts_code} name={item.name} />
                        <div className="hint">
                          涨幅 {item.pct_chg}% · 量比 {item.vol_ratio}
                        </div>
                      </div>
                      <div className="badge-wrap">
                        {item.tags.map((tag) => (
                          <span key={tag} className="badge secondary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="hint">当日暂无该信号名单。</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WatchlistPage() {
  const { data } = useApi("/watchlist");
  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>自选股</h1>
          <p>从数据库中的 watchlist 表读取关注池，方便做后续进一步分析。</p>
        </div>
      </section>
      <div className="card">
        {data?.items?.map((item) => (
          <div key={item.ts_code} className="row-item">
            <div>
              <StockLink ts_code={item.ts_code} name={item.name} />
            </div>
            <div className="badge-wrap">
              <span className="badge secondary">{item.tags || "观察"}</span>
              <span className="badge">
                {item.alert_enabled ? "提醒开启" : "提醒关闭"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyBacktestPage() {
  const { data } = useApi("/strategy-summary");
  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>策略回测</h1>
          <p>回测数据目前以规则化策略说明为主，后续可继续接入历史收益表。</p>
        </div>
      </section>
      <div className="card">
        <h2>当前策略框架</h2>
        {data?.principles?.map((item) => (
          <div key={item} className="row-item">
            <span className="badge">规则</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IndicatorsPage() {
  const { data, loading } = useApi("/market-overview?trade_date=20260624");
  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>指标</h1>
          <p>展示当日强势票的量价和波动状况，给出更直观的市场判断。</p>
        </div>
      </section>
      <div className="stats-grid">
        <StatCard
          title="强势票数"
          value={data?.count ?? "-"}
          hint="收盘涨幅大于 9%"
        />
        <StatCard
          title="首席标的"
          value={data?.top_gainers?.[0]?.ts_code ?? "-"}
          hint="当日最强势的标的"
        />
      </div>
      <div className="card">
        {loading && <p>正在加载...</p>}
        {data?.top_gainers?.map((item) => (
          <div key={item.ts_code} className="row-item">
            <div>
              <StockLink ts_code={item.ts_code} name={item.ts_code} />
              <div className="hint">
                涨幅 {item.pct_chg}% / 量比 {item.vol_ratio}
              </div>
            </div>
            <span className="badge">{item.vol}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ECHARTS_CDN =
  "https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js";
const upColor = "#ff3333";
const downColor = "#00cc66";
const maColors = {
  MA5: "#ffffff",
  MA24: "#ffcc00",
  MA72: "#cc66ff",
  MA120: "#00cc66",
  MA240: "#66ffff",
};

function loadEcharts() {
  if (window.echarts) return Promise.resolve(window.echarts);

  const existingScript = document.querySelector(`script[src="${ECHARTS_CDN}"]`);
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(window.echarts), {
        once: true,
      });
      existingScript.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = ECHARTS_CDN;
    script.async = true;
    script.onload = () => resolve(window.echarts);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function formatDateLabel(raw) {
  if (!raw || raw.length !== 8) return raw || "--";
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`;
}

function formatVolume(value) {
  const num = Number(value || 0);
  if (num >= 100000000) return `${(num / 100000000).toFixed(2)}亿`;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  return num.toFixed(0);
}

function formatAmount(value) {
  const num = Number(value || 0);
  if (num >= 100000) return `${(num / 100000).toFixed(2)}亿`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}千万`;
  if (num > 0) return `${num.toFixed(0)}万`;
  return "-";
}

function formatPrice(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : "-";
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num > 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function calculateMA(rows, windowSize) {
  return rows.map((_, index) => {
    if (index + 1 < windowSize) return null;
    const windowRows = rows.slice(index + 1 - windowSize, index + 1);
    const total = windowRows.reduce(
      (sum, row) => sum + Number(row.close || 0),
      0,
    );
    return Number((total / windowSize).toFixed(3));
  });
}


function calculateMAValues(values, windowSize) {
  return values.map((_, index) => {
    if (index + 1 < windowSize) return null;
    const windowValues = values.slice(index + 1 - windowSize, index + 1);
    const total = windowValues.reduce((sum, value) => sum + Number(value || 0), 0);
    return Number((total / windowSize).toFixed(3));
  });
}

function calculateVolumeMA(rows, windowSize) {
  const values = rows.map((row) => Number(row.vol || 0));
  return calculateMAValues(values, windowSize);
}
function calculateEMAValues(values, span) {
  const alpha = 2 / (span + 1);
  let previous = null;
  return values.map((value) => {
    const current = Number(value || 0);
    previous = previous == null ? current : alpha * current + (1 - alpha) * previous;
    return Number(previous.toFixed(3));
  });
}

function calculateMACD(rows) {
  const closes = rows.map((row) => Number(row.close || 0));
  const ema12 = calculateEMAValues(closes, 12);
  const ema26 = calculateEMAValues(closes, 26);
  const diff = ema12.map((value, index) => Number((value - ema26[index]).toFixed(3)));
  const dea = calculateEMAValues(diff, 9);
  const macd = diff.map((value, index) => Number((2 * (value - dea[index])).toFixed(3)));
  const macdMa5 = calculateMAValues(macd, 5);
  const crossBars = macd.map((value, index) => {
    if (index === 0) return null;
    const crossUp = diff[index - 1] <= 0 && diff[index] > 0;
    const crossDown = diff[index - 1] >= 0 && diff[index] < 0;
    if (crossUp) return { value, color: "#ff1a1a" };
    if (crossDown) return { value, color: "#66ff99" };
    return null;
  });
  const crossMacd = crossBars.map((item) => (item ? item.value : null));
  const highlight = macd.map((value, index) => {
    const base = macdMa5[index];
    if (base == null || value <= base) return [index, null, null];
    return [index, base, value];
  });
  return { diff, dea, macd, macdMa5, crossBars, crossMacd, highlight };
}
function calculateEMA(rows, span) {
  const alpha = 2 / (span + 1);
  let previous = null;
  return rows.map((row) => {
    const close = Number(row.close || 0);
    previous = previous == null ? close : alpha * close + (1 - alpha) * previous;
    return Number(previous.toFixed(3));
  });
}

function calculateZhixingShort(rows) {
  const first = calculateEMA(rows, 10).map((close) => ({ close }));
  return calculateEMA(first, 10);
}

function calculateZhixingLong(rows) {
  const windows = [14, 28, 57, 114];
  const maList = windows.map((windowSize) => calculateMA(rows, windowSize));
  return rows.map((_, index) => {
    const values = maList.map((line) => line[index]);
    if (values.some((value) => value == null)) return null;
    const total = values.reduce((sum, value) => sum + Number(value), 0);
    return Number((total / values.length).toFixed(3));
  });
}

function getKlineValues(item, previousItem) {
  const close = Number(item.close || 0);
  const previousClose = Number(previousItem?.close ?? close);
  const open = Number(item.open ?? previousClose);
  const high = Number(item.high ?? Math.max(open, close));
  const low = Number(item.low ?? Math.min(open, close));

  return [open, close, low, high];
}

function getPeriodKey(tradeDate, period) {
  if (period === "month") return tradeDate.slice(0, 6);
  if (period !== "week") return tradeDate;

  const year = Number(tradeDate.slice(0, 4));
  const month = Number(tradeDate.slice(4, 6)) - 1;
  const day = Number(tradeDate.slice(6, 8));
  const date = new Date(Date.UTC(year, month, day));
  const weekDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekDay);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${weekYear}W${String(week).padStart(2, "0")}`;
}

function aggregateKlineRows(rows, period) {
  if (period === "day") return rows;

  const groups = [];
  let current = null;

  rows.forEach((item, index) => {
    const key = getPeriodKey(item.trade_date, period);
    const previousItem = rows[index - 1];
    const [open, close, low, high] = getKlineValues(item, previousItem);

    if (!current || current.key !== key) {
      current = {
        key,
        trade_date: item.trade_date,
        open,
        high,
        low,
        close,
        vol: Number(item.vol || 0),
        amount: Number(item.amount || 0),
        vol_ratio: item.vol_ratio,
        turnover_rate: item.turnover_rate,
        turnover: item.turnover,
        is_limit_up: item.is_limit_up,
        is_limit_down: item.is_limit_down,
        signal_marks: item.signal_marks || [],
      };
      groups.push(current);
      return;
    }

    current.trade_date = item.trade_date;
    current.high = Math.max(Number(current.high || 0), high);
    current.low = Math.min(Number(current.low || low), low);
    current.close = close;
    current.vol += Number(item.vol || 0);
    current.amount += Number(item.amount || 0);
    current.vol_ratio = item.vol_ratio;
    current.turnover_rate = item.turnover_rate;
    current.turnover = item.turnover;
    current.is_limit_up = current.is_limit_up || item.is_limit_up;
    current.is_limit_down = current.is_limit_down || item.is_limit_down;
    current.signal_marks = Array.from(
      new Set([...(current.signal_marks || []), ...(item.signal_marks || [])]),
    );
  });

  return groups.map((item, index) => {
    const previousClose = Number(groups[index - 1]?.close ?? item.open);
    const pct_chg =
      previousClose > 0 ? ((Number(item.close) - previousClose) / previousClose) * 100 : 0;
    return { ...item, pct_chg };
  });
}

function KlinePanel({ data, period, lineMode, quoteSummary }) {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const rows = useMemo(
    () => aggregateKlineRows(data?.history || [], period),
    [data?.history, period],
  );

  useEffect(() => {
    let disposed = false;
    let resizeObserver = null;

    loadEcharts()
      .then((echarts) => {
        if (disposed || !chartRef.current || !rows.length) return;

        const dates = rows.map((item) => formatDateLabel(item.trade_date));
        const kline = rows.map((item, index) =>
          getKlineValues(item, rows[index - 1]),
        );
        const volumes = rows.map((item, index) => [
          index,
          Number(item.vol || 0),
          kline[index][1] >= kline[index][0] ? 1 : -1,
        ]);
        const volumeMA5 = calculateVolumeMA(rows, 5);
        const volumeMA60 = calculateVolumeMA(rows, 60);
        const macdData = calculateMACD(rows);
        const b1Points = rows
          .map((item, index) =>
            item.signal_marks?.includes("B1")
              ? {
                name: "B1",
                coord: [dates[index], kline[index][2]],
                value: "B1",
                symbol: "circle",
                symbolSize: 0,
                label: { color: "#ffcc00", fontSize: 12, fontWeight: 700 },
              }
              : null,
          )
          .filter(Boolean);
        const overlaySeries =
          lineMode === "zhixing"
            ? [
              { name: "短期趋势", color: "#ffffff", data: calculateZhixingShort(rows) },
              { name: "长期趋势", color: "#ffcc00", data: calculateZhixingLong(rows) },
            ]
            : Object.entries(maColors).map(([name, color]) => ({
              name,
              color,
              data: calculateMA(rows, Number(name.replace("MA", ""))),
            }));
        const overlayNames = overlaySeries.map((item) => item.name);
        const latest = rows[rows.length - 1];
        const start = rows.length > 180 ? 100 - (180 / rows.length) * 100 : 0;

        const chart =
          chartInstanceRef.current || echarts.init(chartRef.current, null);
        chartInstanceRef.current = chart;
        chart.setOption(
          {
            backgroundColor: "#050505",
            animation: false,
            legend: {
              top: 8,
              right: 18,
              itemWidth: 14,
              itemHeight: 8,
              textStyle: { color: "#aaa", fontSize: 11 },
              data: ["K线", ...overlayNames, "成交量", "MA5量", "MA60量", "DIFF", "DEA", "MACD"],
            },
            tooltip: {
              trigger: "axis",
              axisPointer: { type: "cross", label: { backgroundColor: "#333" } },
              backgroundColor: "rgba(10,10,10,0.94)",
              borderColor: "#444",
              textStyle: { color: "#eee", fontSize: 12 },
              formatter(params) {
                const k = params.find((item) => item.seriesName === "K线");
                let html = `<div style="font-weight:bold;margin-bottom:4px;">${params[0].axisValue}</div>`;
                if (k) {
                  const values = k.data.length >= 5 ? k.data.slice(1) : k.data;
                  const [open, close, low, high] = values;
                  const color = close >= open ? upColor : downColor;
                  const point = rows[k.dataIndex] || {};
                  const pct = point.pct_chg;
                  const turnover = point.turnover_rate ?? point.turnover;
                  html += `<div style="color:${color};font-weight:700;margin-bottom:3px;">● K线 涨幅: <b>${formatPercent(pct)}</b></div>`;
                  html += `开: <b>${open.toFixed(2)}</b><br/>`;
                  html += `收: <b>${close.toFixed(2)}</b><br/>`;
                  html += `高: <b>${high.toFixed(2)}</b><br/>`;
                  html += `低: <b>${low.toFixed(2)}</b><br/>`;
                  html += `成交额: <b>${formatAmount(point.amount)}</b><br/>`;
                  html += `换手: <b>${turnover == null ? "-" : formatPercent(turnover)}</b><br/>`;
                  html += `量比: <b>${point.vol_ratio == null ? "-" : Number(point.vol_ratio).toFixed(2)}</b><br/>`;
                }

                return html;
              },
            },
            axisPointer: { link: [{ xAxisIndex: "all" }] },
            grid: [
              { left: 54, right: 28, top: 48, height: "54%" },
              { left: 54, right: 28, top: "66%", height: "11%" },
              { left: 54, right: 28, top: "81%", height: "12%" },
            ],
            xAxis: [
              {
                type: "category",
                data: dates,
                boundaryGap: false,
                axisLine: { lineStyle: { color: "#333" } },
                axisLabel: { color: "#888", fontSize: 10 },
                splitLine: { show: false },
                min: "dataMin",
                max: "dataMax",
              },
              {
                type: "category",
                gridIndex: 1,
                data: dates,
                boundaryGap: false,
                axisLine: { lineStyle: { color: "#333" } },
                axisLabel: { show: false },
                splitLine: { show: false },
                min: "dataMin",
                max: "dataMax",
              },
              {
                type: "category",
                gridIndex: 2,
                data: dates,
                boundaryGap: false,
                axisLine: { lineStyle: { color: "#333" } },
                axisLabel: { color: "#888", fontSize: 10 },
                splitLine: { show: false },
                min: "dataMin",
                max: "dataMax",
              },
            ],
            yAxis: [
              {
                scale: true,
                axisLabel: { color: "#888", fontSize: 10 },
                axisLine: { lineStyle: { color: "#333" } },
                splitLine: { lineStyle: { color: "#1a1a1a" } },
              },
              {
                scale: true,
                gridIndex: 1,
                splitNumber: 2,
                axisLabel: { show: false },
                axisLine: { show: false },
                splitLine: { show: false },
              },
              {
                scale: true,
                gridIndex: 2,
                splitNumber: 2,
                axisLabel: { color: "#888", fontSize: 10 },
                axisLine: { show: false },
                splitLine: { lineStyle: { color: "#1a1a1a" } },
              },
            ],
            dataZoom: [
              {
                type: "inside",
                xAxisIndex: [0, 1, 2],
                start,
                end: 100,
                zoomOnMouseWheel: true,
                moveOnMouseMove: true,
              },
              {
                type: "slider",
                xAxisIndex: [0, 1, 2],
                top: "95%",
                height: 18,
                start,
                end: 100,
                borderColor: "#333",
                fillerColor: "rgba(255,255,255,0.08)",
                handleStyle: { color: "#666" },
                textStyle: { color: "#888" },
              },
            ],
            series: [
              {
                name: "K线",
                type: "candlestick",
                data: kline,
                itemStyle: {
                  color: upColor,
                  color0: downColor,
                  borderColor: upColor,
                  borderColor0: downColor,
                },
                markPoint: {
                  symbolKeepAspect: true,
                  data: b1Points,
                },
              },
              ...overlaySeries.map(({ name, color, data: lineData }) => ({
                name,
                type: "line",
                data: lineData,
                smooth: false,
                symbol: "none",
                lineStyle: { width: 1, color },
              })),
              {
                name: "成交量",
                type: "bar",
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: volumes,
                itemStyle: {
                  color(params) {
                    return params.value[2] > 0 ? upColor : downColor;
                  },
                },
              },
              {
                name: "MA5量",
                type: "line",
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: volumeMA5,
                smooth: false,
                symbol: "none",
                lineStyle: { width: 1, color: "#ffffff" },
              },
              {
                name: "MA60量",
                type: "line",
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: volumeMA60,
                smooth: false,
                symbol: "none",
                lineStyle: { width: 1, color: "#ffcc00" },
              },
              {
                name: "MACD",
                type: "custom",
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: macdData.macd.map((value, index) => [index, value]),
                renderItem(params, api) {
                  const xValue = api.value(0);
                  const yValue = api.value(1);
                  if (yValue == null) return null;
                  const zeroPoint = api.coord([xValue, 0]);
                  const valuePoint = api.coord([xValue, yValue]);
                  return {
                    type: "rect",
                    shape: {
                      x: valuePoint[0] - 1.5,
                      y: Math.min(zeroPoint[1], valuePoint[1]),
                      width: 3,
                      height: Math.max(Math.abs(valuePoint[1] - zeroPoint[1]), 1),
                    },
                    style: { fill: yValue >= 0 ? upColor : downColor },
                  };
                },
              },
              {
                name: "MACD零轴穿越",
                type: "custom",
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: macdData.crossMacd.map((value, index) => [index, value]),
                silent: true,
                renderItem(params, api) {
                  const xValue = api.value(0);
                  const yValue = api.value(1);
                  if (yValue == null) return null;
                  const color = macdData.crossBars[params.dataIndex]?.color;
                  if (!color) return null;
                  const zeroPoint = api.coord([xValue, 0]);
                  const valuePoint = api.coord([xValue, yValue]);
                  return {
                    type: "rect",
                    shape: {
                      x: valuePoint[0] - 4,
                      y: Math.min(zeroPoint[1], valuePoint[1]),
                      width: 8,
                      height: Math.max(Math.abs(valuePoint[1] - zeroPoint[1]), 1),
                    },
                    style: { fill: color },
                  };
                },
              },
              {
                name: "MACD增强",
                type: "custom",
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: macdData.highlight,
                silent: true,
                renderItem(params, api) {
                  const xValue = api.value(0);
                  const yStart = api.value(1);
                  const yEnd = api.value(2);
                  if (yStart == null || yEnd == null) return null;
                  const startPoint = api.coord([xValue, yStart]);
                  const endPoint = api.coord([xValue, yEnd]);
                  return {
                    type: "rect",
                    shape: {
                      x: startPoint[0] - 1.5,
                      y: Math.min(startPoint[1], endPoint[1]),
                      width: 3,
                      height: Math.max(Math.abs(endPoint[1] - startPoint[1]), 1),
                    },
                    style: { fill: "#ffff80" },
                  };
                },
              },
              {
                name: "DIFF",
                type: "line",
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: macdData.diff,
                smooth: false,
                symbol: "none",
                lineStyle: { width: 1, color: "#ffffff" },
              },
              {
                name: "DEA",
                type: "line",
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: macdData.dea,
                smooth: false,
                symbol: "none",
                lineStyle: { width: 1, color: "#ffcc00" },
              },
            ],
          },
          true,
        );

        const updateOverlayHeader = (event) => {
          const axisInfo = event.axesInfo?.find((item) => item.axisDim === "x");
          if (axisInfo?.value != null) {
            setHoverIndex(Number(axisInfo.value));
          }
        };
        chart.off("updateAxisPointer", updateOverlayHeader);
        chart.on("updateAxisPointer", updateOverlayHeader);

        resizeObserver = new ResizeObserver(() => chart.resize());
        resizeObserver.observe(chartRef.current);

        if (latest) {
          chart.dispatchAction({
            type: "showTip",
            seriesIndex: 0,
            dataIndex: rows.length - 1,
          });
        }
      })
      .catch(() => {
        if (chartRef.current) chartRef.current.dataset.error = "true";
      });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chartInstanceRef.current?.off("updateAxisPointer");
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, [rows, lineMode]);

  const headerOverlaySeries =
    lineMode === "zhixing"
      ? [
        { name: "短期趋势", color: "#ffffff", data: calculateZhixingShort(rows) },
        { name: "长期趋势", color: "#ffcc00", data: calculateZhixingLong(rows) },
      ]
      : Object.keys(maColors).map((name) => ({
        name,
        data: calculateMA(rows, Number(name.replace("MA", ""))),
      }));
  const overlayHeaderIndex = hoverIndex == null ? rows.length - 1 : hoverIndex;
  const overlayHeaderItems = headerOverlaySeries
    .map(({ name, color, data: lineData }) => {
      const value = lineData[overlayHeaderIndex];
      return value == null
        ? null
        : {
          name,
          value: Number(value).toFixed(2),
          color: maColors[name] || color || "#dce7f4",
        };
    })
    .filter(Boolean);
  const volumeHeaderIndex = hoverIndex == null ? rows.length - 1 : hoverIndex;
  const volumeHeaderItems = [
    {
      name: "成交量",
      value: formatVolume(rows[volumeHeaderIndex]?.vol),
      color: "#cbd5e1",
    },
    {
      name: "MA5量",
      value: formatVolume(calculateVolumeMA(rows, 5)[volumeHeaderIndex]),
      color: "#ffffff",
    },
    {
      name: "MA60量",
      value: formatVolume(calculateVolumeMA(rows, 60)[volumeHeaderIndex]),
      color: "#ffcc00",
    },
  ];
  const macdHeaderData = calculateMACD(rows);
  const macdHeaderItems = [
    {
      name: "DIFF",
      value: Number(macdHeaderData.diff[volumeHeaderIndex] || 0).toFixed(3),
      color: "#ffffff",
    },
    {
      name: "DEA",
      value: Number(macdHeaderData.dea[volumeHeaderIndex] || 0).toFixed(3),
      color: "#ffcc00",
    },
    {
      name: "MACD",
      value: Number(macdHeaderData.macd[volumeHeaderIndex] || 0).toFixed(3),
      color:
        Number(macdHeaderData.macd[volumeHeaderIndex] || 0) >= 0
          ? upColor
          : downColor,
    },
  ];

  if (!rows.length) {
    return <div className="kline-empty">暂无 K 线数据</div>;
  }

  return (
    <div className="terminal-chart">
      <div className="terminal-chart-header">
        <div>
          <strong>
            {data.ts_code} {data.name}
          </strong>
          {quoteSummary ? <em>{quoteSummary}</em> : null}
          {overlayHeaderItems.length ? (
            <small>
              {overlayHeaderItems.map((item) => (
                <span key={item.name} style={{ color: item.color }}>
                  {item.name}: {item.value}
                </span>
              ))}
            </small>
          ) : null}
        </div>
      </div>
      <div ref={chartRef} className="kline-echarts" />
      <div className="volume-subchart-header">
        {volumeHeaderItems.map((item) => (
          <span key={item.name} style={{ color: item.color }}>
            {item.name}: {item.value}
          </span>
        ))}
      </div>
      <div className="macd-subchart-header">
        {macdHeaderItems.map((item) => (
          <span key={item.name} style={{ color: item.color }}>
            {item.name}: {item.value}
          </span>
        ))}
      </div>
      <div className="kline-load-fallback">ECharts 加载失败，请检查网络。</div>
    </div>
  );
}

function StockDetailPage() {
  const { ts_code } = useParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("day");
  const [lineMode, setLineMode] = useState("524");
  const [watchRefresh, setWatchRefresh] = useState(0);
  const [watchSaving, setWatchSaving] = useState(false);
  const [watchError, setWatchError] = useState("");
  const { data, loading, error } = useApi(
    `/stock/${ts_code}?tradeDate=20260624`,
  );
  const { data: selectionData } = useApi("/selection-history");
  const { data: watchData } = useApi(`/watchlist?refresh=${watchRefresh}`);

  const indicatorFlags = [
    { label: "反包", value: data?.indicator?.is_fanbao },
    { label: "北斗", value: data?.indicator?.is_beidou },
    { label: "缩量", value: data?.indicator?.is_suoliang },
    { label: "单针", value: data?.indicator?.is_needle_20 },
    { label: "红砖", value: data?.indicator?.brick_trend_up },
  ].filter((item) => item.value);

  const historyRows = data?.history || [];
  const latestPoint = historyRows[historyRows.length - 1] || null;
  const previousPoint = historyRows[historyRows.length - 2] || null;
  const latestKline = latestPoint
    ? getKlineValues(latestPoint, previousPoint)
    : null;
  const quoteTone =
    Number(latestPoint?.pct_chg || 0) >= 0 ? "quote-up" : "quote-down";
  const selectionDay = selectionData?.days?.[0] || null;
  const selectionItems = selectionDay?.B1?.length
    ? selectionDay.B1
    : selectionDay
      ? Object.values(selectionDay)
        .filter(Array.isArray)
        .flat()
      : [];
  const activeIndex = selectionItems.findIndex(
    (item) => item.ts_code === data?.ts_code,
  );
  const isWatched = Boolean(
    watchData?.items?.some((item) => item.ts_code === data?.ts_code),
  );
  const signalText = indicatorFlags.length
    ? indicatorFlags.map((item) => item.label).join(" / ")
    : "暂无显著信号";
  const quoteSummary = latestPoint
    ? [
      `开 ${formatPrice(latestKline?.[0])}`,
      `高 ${formatPrice(latestKline?.[3])}`,
      `低 ${formatPrice(latestKline?.[2])}`,
      `收 ${formatPrice(latestPoint?.close)}`,
      `涨幅 ${formatPercent(latestPoint?.pct_chg)}`,
      `成交额 ${formatAmount(latestPoint?.amount)}`,
      signalText,
    ].join("  ")
    : "";

  useEffect(() => {
    if (!selectionItems.length) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const currentIndex = activeIndex >= 0 ? activeIndex : 0;
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (currentIndex + offset + selectionItems.length) % selectionItems.length;
      const nextStock = selectionItems[nextIndex];
      if (nextStock?.ts_code) {
        event.preventDefault();
        navigate(`/stock/${nextStock.ts_code}`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, navigate, selectionItems]);

  const toggleWatchlist = () => {
    if (!data?.ts_code || watchSaving) return;

    setWatchSaving(true);
    setWatchError("");
    fetch(
      isWatched
        ? `/api/watchlist/${encodeURIComponent(data.ts_code)}`
        : "/api/watchlist",
      {
        method: isWatched ? "DELETE" : "POST",
        headers: isWatched ? undefined : { "Content-Type": "application/json" },
        body: isWatched
          ? undefined
          : JSON.stringify({
            ts_code: data.ts_code,
            name: data.name,
            tags: indicatorFlags.map((item) => item.label).join(","),
          }),
      },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`自选股操作失败：${res.status}`);
        return res.json();
      })
      .then(() => {
        setWatchRefresh((value) => value + 1);
      })
      .catch((e) => {
        setWatchError(String(e));
      })
      .finally(() => {
        setWatchSaving(false);
      });
  };

  return (
    <div className="page stock-detail-page">
      {loading && <p>正在加载...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && data ? (
        <section className="kline-layout">
          <aside className="selection-rail">
            <div className="selection-rail-header">
              <strong>趋势回调-b1</strong>
              <span>选股日 {formatDateLabel(selectionDay?.trade_date)}</span>
              <small>上下方向键切换股票</small>
            </div>
            <div className="selection-rail-list">
              {selectionItems.map((item, index) => (
                <Link
                  key={item.ts_code}
                  to={`/stock/${item.ts_code}`}
                  className={`selection-rail-item ${item.ts_code === data.ts_code ? "active" : ""
                    }`}
                >
                  <span>{index + 1}.</span>
                  <strong>{item.ts_code.split(".")[0]}</strong>
                  <em>{item.name}</em>
                  <small>{item.tags?.join(" / ") || "观察"}</small>
                </Link>
              ))}
            </div>
          </aside>

          <div className="quote-shell">
            <div className="quote-actions">
              <Link to="/selection">返回选股</Link>
              <button
                className={isWatched ? "active" : ""}
                type="button"
                onClick={toggleWatchlist}
                disabled={watchSaving}
              >
                {watchSaving ? "处理中" : isWatched ? "删自选" : "加自选"}
              </button>
              <span>简洁</span>
            </div>
            {watchError ? <p className="watch-error">{watchError}</p> : null}
            <div className="quote-header">
              <div className="quote-title">
                <h1>{data.name}</h1>
                <span>{data.ts_code.split(".")[0]}</span>
              </div>
              <div className="quote-date">{formatDateLabel(data.trade_date)}</div>
            </div>

            <div className="quote-board">
              <div className={`quote-price ${quoteTone}`}>
                <strong>{formatPrice(latestPoint?.close)}</strong>
                <span>{formatPercent(latestPoint?.pct_chg)}</span>
              </div>
              <div className="quote-metrics">
                <div>
                  <span>趋势</span>
                  <strong>短:{formatPrice(calculateMA(historyRows, 10).at(-1))}</strong>
                </div>
                <div>
                  <span>行业</span>
                  <strong>{data.indicator?.industry || "观察"}</strong>
                </div>
                <div>
                  <span>热门概念</span>
                  <strong>
                    {indicatorFlags.map((item) => item.label).join(" / ") || "-"}
                  </strong>
                </div>
                <div>
                  <span>成交额</span>
                  <strong>{formatAmount(latestPoint?.amount)}</strong>
                </div>
                <div>
                  <span>信号</span>
                  <strong>{data.indicator?.signal || "WATCH"}</strong>
                </div>
                <div>
                  <span>止损分</span>
                  <strong>{data.indicator?.sell_score ?? "-"}</strong>
                </div>
              </div>
            </div>

            <div className="kline-toolbar" aria-label="K线周期">
              <button type="button">30分</button>
              <button type="button">60分</button>
              <button
                className={period === "day" ? "active" : ""}
                type="button"
                onClick={() => setPeriod("day")}
              >
                日
              </button>
              <button
                className={period === "week" ? "active" : ""}
                type="button"
                onClick={() => setPeriod("week")}
              >
                周
              </button>
              <button
                className={period === "month" ? "active" : ""}
                type="button"
                onClick={() => setPeriod("month")}
              >
                月
              </button>
              <span className="toolbar-divider" />
              <button
                className={lineMode === "524" ? "active" : ""}
                type="button"
                onClick={() => setLineMode("524")}
              >
                524
              </button>
              <button
                className={lineMode === "zhixing" ? "active" : ""}
                type="button"
                onClick={() => setLineMode("zhixing")}
              >
                知行
              </button>
            </div>

            <div className="chart-workspace">
              <KlinePanel
                data={data}
                period={period}
                lineMode={lineMode}
                quoteSummary={quoteSummary}
              />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function App() {
  const location = useLocation();
  const isStockDetail = location.pathname.startsWith("/stock/");
  const title = useMemo(() => {
    const map = {
      "/": "首页",
      "/daily-watch": "每日看盘",
      "/screener": "策略观察",
      "/selection": "选股列表",
      "/watchlist": "自选股",
      "/strategy-backtest": "策略回测",
      "/indicators": "指标",
    };
    if (isStockDetail) {
      return "个股详情";
    }
    return map[location.pathname] || "ZettaRanc";
  }, [isStockDetail, location.pathname]);

  return (
    <div className={isStockDetail ? "app-shell stock-detail-shell" : "app-shell"}>
      <header className="topbar">
        <div>
          <div className="brand">ZettaRanc</div>
          <div className="subtitle">{title}</div>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={isStockDetail ? "stock-detail-main" : ""}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/daily-watch" element={<DailyWatchPage />} />
          <Route path="/screener" element={<ScreenerPage />} />
          <Route path="/selection" element={<SelectionPage />} />
          <Route path="/stock/:ts_code" element={<StockDetailPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/strategy-backtest" element={<StrategyBacktestPage />} />
          <Route path="/indicators" element={<IndicatorsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
