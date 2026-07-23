import { useState, useEffect, useCallback } from 'react';

const API = '/api';
const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 минут

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

const formatDateForInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const rowKey = (r) =>
  [r.BU, r.KPI_code, formatDateForInput(r.shift_date), r.shift_n, r.SCENARIO || ''].join('|');

export default function App() {
  const [data, setData] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filters, setFilters] = useState({
    bu: '',
    kpi_code: '',
    shift_date: '',
    shift_n: '',
  });
  const [manualValues, setManualValues] = useState({});
  const [filterOptions, setFilterOptions] = useState({ bu: [], kpi_code: [], shift_date: [], shift_n: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/filters`);
      if (!res.ok) throw new Error(await res.text());
      const opts = await res.json();
      setFilterOptions({
        bu: (opts.bu || []).sort(),
        kpi_code: (opts.kpi_code || []).sort((a, b) => a - b),
        shift_date: (opts.shift_date || []).map((d) => formatDateForInput(d)).filter(Boolean).sort().reverse(),
        shift_n: (opts.shift_n || []).sort((a, b) => a - b),
      });
    } catch (e) {
      const msg = e?.message || String(e);
      const isNetwork = msg.includes('fetch') || msg.includes('Failed') || msg.includes('NetworkError') || msg.includes('ECONNREFUSED');
      setError(
        isNetwork
          ? 'Не удалось подключиться к API. Проверьте, что сервер запущен на порту 5174 и что UI открыт по адресу Vite (например, http://localhost:5173).'
          : msg
      );
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.bu) params.set('bu', filters.bu);
      if (filters.kpi_code !== '') params.set('kpi_code', filters.kpi_code);
      if (filters.shift_date) params.set('shift_date', filters.shift_date);
      if (filters.shift_n !== '') params.set('shift_n', filters.shift_n);
      const res = await fetch(`${API}/data?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const list = await res.json();
      setData(list);
      setLastUpdate(new Date());
      setManualValues((prev) => {
        const next = { ...prev };
        list.forEach((r) => {
          const key = rowKey(r);
          if (next[key] === undefined && r.kpi_value_manual != null && r.kpi_value_manual !== '')
            next[key] = String(r.kpi_value_manual);
        });
        return next;
      });
    } catch (e) {
      const msg = e.message || String(e);
      const isNetwork = msg.includes('fetch') || msg.includes('Failed') || msg.includes('NetworkError');
      setError(
        isNetwork
          ? 'Нет подключения к серверу. Запустите API: cd server && node index.js (порт 5174)'
          : msg
      );
    } finally {
      setLoading(false);
    }
  }, [filters.bu, filters.kpi_code, filters.shift_date, filters.shift_n]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const t = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
  };

  const getManualValue = (row) => {
    const key = rowKey(row);
    return manualValues[key] !== undefined ? manualValues[key] : (row.kpi_value_manual != null ? String(row.kpi_value_manual) : '');
  };

  const setManualValue = (row, value) => {
    const key = rowKey(row);
    setManualValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleAccept = async () => {
    const toSave = data
      .map((row) => {
        const manual = getManualValue(row);
        if (manual === '' && (row.kpi_value_manual == null || row.kpi_value_manual === '')) return null;
        return {
          BU: row.BU,
          KPI_code: row.KPI_code,
          shift_date: formatDateForInput(row.shift_date) || row.shift_date,
          shift_n: row.shift_n,
          SCENARIO: row.SCENARIO || null,
          kpi_value_manual: manual === '' ? null : parseFloat(manual),
        };
      })
      .filter(Boolean);

    if (toSave.length === 0) {
      setError('Нет данных для сохранения. Введите значения в колонку «Значение ручное».');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchData();
      await fetchFilterOptions();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`app ${loading || saving ? 'loading' : ''}`}>
      <header className="header">
        <div className="header-left">
          <button type="button" className="btn" onClick={handleRefresh} disabled={loading}>
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
              <option key={v} value={v}>{v}</option>
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
              <option key={v} value={v}>{v}</option>
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
              <option key={v} value={v}>{v}</option>
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
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="error">{error}</div>}

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
              <th>Дата/время ручная внесения/правки</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={9}>
                  Нет данных. Убедитесь, что во всех фильтрах выбрано «Все» и нажмите «Обновить».
                  {!error && ' Если не помогло — откройте в браузере: '}
                  {!error && <a href="http://localhost:5174/api/data" target="_blank" rel="noreferrer" style={{ color: '#8af' }}>http://localhost:5174/api/data</a>}
                  {!error && ' (должен вернуться JSON-массив).'}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
