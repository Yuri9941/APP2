import { useState, useEffect, useCallback } from 'react';
import {
  initEmbeddedAuth,
  ensureSignedInWithFabric,
} from '@microsoft/rayfin-auth-provider-fabric';
import {
  rayfinClient,
  fabricAuthOptions,
  formatDateForInput,
  rowKey,
  aggregateRows,
  fetchApp2Rows,
  fetchFilterOptions,
  saveManualRows,
} from './rayfin';
import ReportCharts from './charts/ReportCharts';

const REFRESH_INTERVAL_MS = 60 * 1000; // раз в минуту

const formatDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return isNaN(x.getTime()) ? '' : x.toLocaleDateString('ru-RU');
};

const formatDateTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return isNaN(x.getTime()) ? '' : x.toLocaleString('ru-RU');
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [data, setData] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filters, setFilters] = useState({
    bu: '',
    kpi_code: '',
    shift_date: '',
    shift_n: '',
  });
  const [manualValues, setManualValues] = useState({});
  const [filterOptions, setFilterOptions] = useState({
    bu: [],
    kpi_code: [],
    shift_date: [],
    shift_n: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initEmbeddedAuth(rayfinClient.auth, fabricAuthOptions);
        const session = rayfinClient.auth.getSession();
        if (!cancelled) setReady(!!session?.isAuthenticated);
      } catch {
        if (!cancelled) setReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignIn = async () => {
    setAuthBusy(true);
    setError(null);
    try {
      await ensureSignedInWithFabric(rayfinClient.auth, fabricAuthOptions);
      setReady(true);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const loadFilterOptions = useCallback(async () => {
    try {
      const opts = await fetchFilterOptions();
      setFilterOptions({
        bu: (opts.bu || []).sort(),
        kpi_code: (opts.kpi_code || []).sort((a, b) => a - b),
        shift_date: (opts.shift_date || []).filter(Boolean).sort().reverse(),
        shift_n: (opts.shift_n || []).sort((a, b) => a - b),
      });
    } catch (e) {
      setError(e?.message || String(e));
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchApp2Rows(filters);
      const list = aggregateRows(raw);
      setData(list);
      setLastUpdate(new Date());
      setManualValues((prev) => {
        const next = { ...prev };
        list.forEach((r) => {
          const key = rowKey(r);
          if (next[key] === undefined && r.kpi_value_manual != null && r.kpi_value_manual !== '') {
            next[key] = String(r.kpi_value_manual);
          }
        });
        return next;
      });
    } catch (e) {
      const msg = e?.message || String(e);
      setError(
        msg.includes('auth') || msg.includes('Auth') || msg.includes('401')
          ? 'Нет сессии Fabric. Нажмите «Войти».'
          : msg
      );
    } finally {
      setLoading(false);
    }
  }, [filters.bu, filters.kpi_code, filters.shift_date, filters.shift_n]);

  useEffect(() => {
    if (!ready) return;
    loadFilterOptions();
  }, [ready, loadFilterOptions]);

  useEffect(() => {
    if (!ready) return;
    fetchData();
  }, [ready, fetchData]);

  useEffect(() => {
    if (!ready) return;
    const t = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [ready, fetchData]);

  const getManualValue = (row) => {
    const key = rowKey(row);
    return manualValues[key] !== undefined
      ? manualValues[key]
      : row.kpi_value_manual != null
        ? String(row.kpi_value_manual)
        : '';
  };

  const setManualValue = (row, value) => {
    const key = rowKey(row);
    setManualValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleAccept = async () => {
    const toSave = data
      .map((row) => {
        const manual = getManualValue(row);
        const prev =
          row.kpi_value_manual != null && row.kpi_value_manual !== ''
            ? String(row.kpi_value_manual)
            : '';
        if (manual === prev) return null;
        if (manual === '') return null;
        return {
          ...row,
          shift_date: formatDateForInput(row.shift_date) || row.shift_date,
          kpi_value_manual_prev: row.kpi_value_manual,
          kpi_value_manual: parseFloat(manual),
        };
      })
      .filter(Boolean);

    if (toSave.length === 0) {
      setError('Нет изменений для сохранения. Измените «Значение ручное» и нажмите «Принять».');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveManualRows(toSave);
      await fetchData();
      await loadFilterOptions();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-left">
            <button type="button" className="btn" onClick={handleSignIn} disabled={authBusy}>
              {authBusy ? 'Вход…' : 'Войти через Fabric'}
            </button>
          </div>
        </header>
        {error && <div className="error">{error}</div>}
        <p style={{ padding: '1rem' }}>
          Для работы с таблицей App2 нужна сессия Fabric (SSO). Откройте приложение из портала Fabric
          или нажмите «Войти через Fabric».
        </p>
      </div>
    );
  }

  return (
    <div className={`app ${loading || saving ? 'loading' : ''}`}>
      <header className="header">
        <div className="header-left">
          <button type="button" className="btn" onClick={fetchData} disabled={loading}>
            Обновить
          </button>
          <button type="button" className="btn" onClick={handleAccept} disabled={saving || loading}>
            Принять
          </button>
        </div>
        <div className="header-right">
          <span className="last-update">
            Последнее обновление: {lastUpdate ? formatDateTime(lastUpdate) : '—'}
          </span>
        </div>
      </header>

      <div className="filters">
        <label>
          Бизнес-единица:
          <select
            value={filters.bu}
            onChange={(e) => setFilters((f) => ({ ...f, bu: e.target.value }))}
          >
            <option value="">Все</option>
            {filterOptions.bu.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Код MIRS:
          <select
            value={filters.kpi_code}
            onChange={(e) => setFilters((f) => ({ ...f, kpi_code: e.target.value }))}
          >
            <option value="">Все</option>
            {filterOptions.kpi_code.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Дата смены:
          <select
            value={filters.shift_date}
            onChange={(e) => setFilters((f) => ({ ...f, shift_date: e.target.value }))}
          >
            <option value="">Все</option>
            {filterOptions.shift_date.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Номер смены:
          <select
            value={filters.shift_n}
            onChange={(e) => setFilters((f) => ({ ...f, shift_n: e.target.value }))}
          >
            <option value="">Все</option>
            {filterOptions.shift_n.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="error">{error}</div>}

      <ReportCharts rows={data} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Бизнес-единица</th>
              <th>Код MIRS</th>
              <th>Дата смены</th>
              <th>Номер смены</th>
              <th>Источник</th>
              <th>Сценарий</th>
              <th>Значение автом</th>
              <th>Значение ручное</th>
              <th>Дата/время ручного ввода</th>
              <th>USER</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={10}>
                  Нет данных в App2. Загрузите строки в таблицу Data App / App2 и нажмите «Обновить».
                </td>
              </tr>
            )}
            {data.map((row) => (
              <tr key={rowKey(row)}>
                <td>{row.BU}</td>
                <td>{row.KPI_code}</td>
                <td>{formatDate(row.shift_date)}</td>
                <td>{row.shift_n}</td>
                <td>APP / авто</td>
                <td>{row.SCENARIO ?? ''}</td>
                <td>{row.kpi_value_auto != null ? Number(row.kpi_value_auto) : ''}</td>
                <td>
                  <input
                    type="number"
                    step="any"
                    className="kpi-manual"
                    value={getManualValue(row)}
                    onChange={(e) => setManualValue(row, e.target.value)}
                    placeholder="Введите значение"
                  />
                </td>
                <td className="tmstmp-manual">
                  {row.TMSTMP_MANUAL ? formatDateTime(row.TMSTMP_MANUAL) : '—'}
                </td>
                <td>{row.USER_MANUAL || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
