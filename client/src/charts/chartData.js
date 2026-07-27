/** Агрегации для мини-отчётов над таблицей (мера — кол-во строк, кроме топ-3). */

function monthKey(d) {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function scenarioLabel(s) {
  const v = (s ?? '').toString().trim();
  return v || '(пусто)';
}

/** Матрица: сценарий × месяц → count */
export function buildScenarioMonthMatrix(rows) {
  const months = new Set();
  const scenarios = new Set();
  const counts = new Map();

  for (const r of rows || []) {
    const m = monthKey(r.shift_date);
    if (!m) continue;
    const s = scenarioLabel(r.SCENARIO);
    months.add(m);
    scenarios.add(s);
    const k = `${s}||${m}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  const monthList = [...months].sort();
  const scenarioList = [...scenarios].sort();
  const data = [];
  for (let yi = 0; yi < scenarioList.length; yi++) {
    for (let xi = 0; xi < monthList.length; xi++) {
      const v = counts.get(`${scenarioList[yi]}||${monthList[xi]}`) || 0;
      if (v > 0) data.push([xi, yi, v]);
    }
  }
  return { months: monthList, scenarios: scenarioList, data };
}

/** Месяц → count (горизонтальная гистограмма) */
export function buildMonthCounts(rows) {
  const counts = new Map();
  for (const r of rows || []) {
    const m = monthKey(r.shift_date);
    if (!m) continue;
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  const months = [...counts.keys()].sort();
  return {
    months,
    values: months.map((m) => counts.get(m)),
  };
}

/** Код MIRS → count (pie) */
export function buildMirsCounts(rows) {
  const counts = new Map();
  for (const r of rows || []) {
    const code = r.KPI_code == null ? '(пусто)' : String(r.KPI_code);
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Топ-3 наибольших ручных значений */
export function buildTop3Manual(rows) {
  const withManual = (rows || [])
    .filter((r) => r.kpi_value_manual != null && r.kpi_value_manual !== '')
    .map((r) => ({
      label: `${r.BU ?? ''}/${r.KPI_code ?? ''}`,
      value: Number(r.kpi_value_manual),
    }))
    .filter((r) => !isNaN(r.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return {
    labels: withManual.map((r) => r.label),
    values: withManual.map((r) => r.value),
  };
}
