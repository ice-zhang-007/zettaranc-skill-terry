import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";

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
                <strong>{item.ts_code}</strong> · {item.pct_chg}% · 成交额{" "}
                {item.vol}
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
                <strong>{item.name}</strong>
                <div className="hint">
                  {item.ts_code} · {item.pct_chg}% · {item.vol_ratio} 倍量
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
                      <strong>{item.name}</strong>
                      <div className="hint">{item.ts_code}</div>
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
              <strong>{item.name}</strong>
              <div className="hint">{item.ts_code}</div>
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
                            <strong>{item.name}</strong>
                            <div className="hint">
                              {item.ts_code} · 涨幅 {item.pct_chg}% · 量比{" "}
                              {item.vol_ratio}
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
              <strong>{item.name}</strong>
              <div className="hint">{item.ts_code}</div>
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
              <strong>{item.ts_code}</strong>
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
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/strategy-backtest" element={<StrategyBacktestPage />} />
          <Route path="/indicators" element={<IndicatorsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
