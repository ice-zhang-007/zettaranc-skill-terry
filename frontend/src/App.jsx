import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
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
  const { data, loading, error } = useApi("/selection-history");
  const [activeTab, setActiveTab] = useState("B1");

  const tabItems = data?.signals || ["B1", "B2", "单针"];

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>选股列表</h1>
          <p>
            按 B1、B2、单针 三个维度，保留最近 10 日的打点结果，便于回看和对比。
          </p>
        </div>
      </section>

      <div className="card">
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
        {loading && <p>正在加载...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && data?.days?.length ? (
          <div className="selection-list">
            {data.days.map((day) => {
              const items = day[activeTab] || [];
              return (
                <div key={day.trade_date} className="selection-day">
                  <div className="selection-day-header">
                    <strong>{day.trade_date}</strong>
                    <span className="badge secondary">{items.length} 只</span>
                  </div>
                  {items.length ? (
                    <div className="selection-items">
                      {items.map((item) => (
                        <div
                          key={`${day.trade_date}-${item.ts_code}`}
                          className="row-item"
                        >
                          <div>
                            <StockLink
                              ts_code={item.ts_code}
                              name={item.name}
                            />
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
              );
            })}
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

function KlinePanel({ data }) {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const rows = useMemo(() => data?.history || [], [data?.history]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver = null;

    loadEcharts()
      .then((echarts) => {
        if (disposed || !chartRef.current || !rows.length) return;

        const dates = rows.map((item) => formatDateLabel(item.trade_date));
        const kline = rows.map((item) => [
          Number(item.open ?? item.close ?? 0),
          Number(item.close ?? 0),
          Number(item.low ?? item.close ?? 0),
          Number(item.high ?? item.close ?? 0),
        ]);
        const volumes = rows.map((item, index) => [
          index,
          Number(item.vol || 0),
          Number(item.close || 0) >= Number(item.open ?? item.close ?? 0)
            ? 1
            : -1,
        ]);
        const limitUpPoints = rows
          .map((item, index) =>
            item.is_limit_up
              ? {
                  name: "涨停",
                  coord: [dates[index], Number(item.low || item.close || 0)],
                  value: "涨停",
                  symbol: "pin",
                  symbolSize: 38,
                  itemStyle: { color: "#ffcc00" },
                  label: { color: "#050505", fontSize: 10 },
                }
              : null,
          )
          .filter(Boolean);
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
              data: ["K线", "MA5", "MA24", "MA72", "MA120", "MA240"],
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
                  html += `<span style="color:${color}">●</span> K线 开:<b>${open.toFixed(2)}</b> 收:<b>${close.toFixed(2)}</b> 高:<b>${high.toFixed(2)}</b> 低:<b>${low.toFixed(2)}</b><br/>`;
                }
                Object.keys(maColors).forEach((name) => {
                  const point = params.find((item) => item.seriesName === name);
                  if (point?.data != null) {
                    html += `<span style="color:${point.color}">━</span> ${name}: <b>${Number(point.data).toFixed(2)}</b><br/>`;
                  }
                });
                const volume = params.find((item) => item.seriesName === "成交量");
                if (volume) {
                  html += `成交量: <b>${formatVolume(volume.data[1])}</b>`;
                }
                return html;
              },
            },
            axisPointer: { link: [{ xAxisIndex: "all" }] },
            grid: [
              { left: 54, right: 28, top: 48, height: "62%" },
              { left: 54, right: 28, top: "76%", height: "16%" },
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
            ],
            dataZoom: [
              {
                type: "inside",
                xAxisIndex: [0, 1],
                start,
                end: 100,
                zoomOnMouseWheel: true,
                moveOnMouseMove: true,
              },
              {
                type: "slider",
                xAxisIndex: [0, 1],
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
                  data: limitUpPoints,
                },
              },
              ...Object.entries(maColors).map(([name, color]) => ({
                name,
                type: "line",
                data: calculateMA(rows, Number(name.replace("MA", ""))),
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
            ],
          },
          true,
        );

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
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, [rows]);

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
          <span>
            {formatDateLabel(rows[0].trade_date)} ~{" "}
            {formatDateLabel(rows[rows.length - 1].trade_date)}
          </span>
        </div>
        <span>{rows.length} 根K线</span>
      </div>
      <div ref={chartRef} className="kline-echarts" />
      <div className="kline-load-fallback">ECharts 加载失败，请检查网络。</div>
    </div>
  );
}

function StockDetailPage() {
  const { ts_code } = useParams();
  const { data, loading, error } = useApi(
    `/stock/${ts_code}?tradeDate=20260624`,
  );

  const indicatorFlags = [
    { label: "反包", value: data?.indicator?.is_fanbao },
    { label: "北斗", value: data?.indicator?.is_beidou },
    { label: "缩量", value: data?.indicator?.is_suoliang },
    { label: "单针", value: data?.indicator?.is_needle_20 },
    { label: "红砖", value: data?.indicator?.brick_trend_up },
  ].filter((item) => item.value);

  const historyRows = data?.history || [];
  const latestPoint = historyRows[historyRows.length - 1] || null;

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>{data?.name || ts_code}</h1>
          <p>
            {data?.ts_code || ts_code} · 最新交易日 {data?.trade_date || "-"}
          </p>
        </div>
        <div className="pill">个股详情</div>
      </section>

      {loading && <p>正在加载...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && data ? (
        <>
          <div className="stats-grid">
            <StatCard
              title="最新收盘"
              value={latestPoint?.close ?? "-"}
              hint="最近一日价格"
            />
            <StatCard
              title="最新涨跌"
              value={`${latestPoint?.pct_chg ?? "-"}%`}
              hint="当日涨跌幅"
            />
            <StatCard
              title="信号"
              value={data.indicator?.signal || "WATCH"}
              hint="策略标签"
            />
          </div>

          <div className="detail-grid">
            <div className="card">
              <h2>基础信息</h2>
              <div className="detail-list">
                <div className="detail-row">
                  <span className="label">代码</span>
                  <span>{data.ts_code}</span>
                </div>
                <div className="detail-row">
                  <span className="label">名称</span>
                  <span>{data.name}</span>
                </div>
                <div className="detail-row">
                  <span className="label">最新日期</span>
                  <span>{data.trade_date}</span>
                </div>
                <div className="detail-row">
                  <span className="label">止损评分</span>
                  <span>{data.indicator?.sell_score ?? "-"}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h2>当前指标</h2>
              <div className="badge-wrap">
                {indicatorFlags.length ? (
                  indicatorFlags.map((item) => (
                    <span key={item.label} className="badge">
                      {item.label}
                    </span>
                  ))
                ) : (
                  <span className="badge secondary">暂无显著信号</span>
                )}
              </div>
              {data.indicator?.sell_reason ? (
                <p className="detail-note">{data.indicator.sell_reason}</p>
              ) : null}
            </div>
          </div>

          <div className="card">
            <h2>两年历史 K 线</h2>
            <KlinePanel data={data} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function App() {
  const location = useLocation();
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
    if (location.pathname.startsWith("/stock/")) {
      return "个股详情";
    }
    return map[location.pathname] || "ZettaRanc";
  }, [location.pathname]);

  return (
    <div className="app-shell">
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

      <main>
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
