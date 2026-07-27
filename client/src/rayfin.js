import { RayfinClient } from '@microsoft/rayfin-client';

export const rayfinClient = new RayfinClient({
  baseUrl: import.meta.env.VITE_RAYFIN_API_URL ?? '',
  publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY ?? '',
});

export const fabricAuthOptions = {
  workspaceId: import.meta.env.VITE_FABRIC_WORKSPACE_ID ?? '',
  projectId: import.meta.env.VITE_FABRIC_ITEM_ID ?? '',
  fabricPortalUrl: import.meta.env.VITE_FABRIC_PORTAL_URL ?? 'https://app.fabric.microsoft.com',
  returnOrigin: typeof window !== 'undefined' ? window.location.origin : '',
};

const APP2_FIELDS = [
  'id',
  'BU',
  'KPI_code',
  'shift_date',
  'shift_n',
  'ShiftFrom',
  'ShiftTo',
  'value_source',
  'SCENARIO',
  'kpi_value',
  'TMSTMP',
  'changed_by',
];

export function formatDateForInput(d) {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function rowKey(r) {
  return [r.BU, r.KPI_code, formatDateForInput(r.shift_date), r.shift_n, r.SCENARIO || ''].join('|');
}

/** Email/UPN текущего пользователя Fabric SSO. */
export function getCurrentUserLabel() {
  const session = rayfinClient.auth.getSession();
  const user = session?.user;
  if (!user) return '';
  return (user.email || user.id || '').trim();
}

function manualChanged(prev, next) {
  const a = prev == null || prev === '' ? null : Number(prev);
  const b = next == null || next === '' ? null : Number(next);
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  return a !== b;
}

/** Сырые строки App2 → строки UI (auto + manual). */
export function aggregateRows(rawRows) {
  const map = new Map();
  for (const t of rawRows || []) {
    const key = rowKey(t);
    let row = map.get(key);
    if (!row) {
      row = {
        BU: t.BU,
        KPI_code: t.KPI_code,
        shift_date: t.shift_date,
        shift_n: t.shift_n,
        ShiftFrom: t.ShiftFrom,
        ShiftTo: t.ShiftTo,
        SCENARIO: t.SCENARIO,
        kpi_value_manual: null,
        TMSTMP_MANUAL: null,
        USER_MANUAL: null,
        kpi_value_auto: null,
        _manualId: null,
      };
      map.set(key, row);
    }
    if ((t.value_source || '') === 'APP') {
      row.kpi_value_manual = t.kpi_value;
      row.TMSTMP_MANUAL = t.TMSTMP;
      row.USER_MANUAL = t.changed_by ?? null;
      row._manualId = t.id;
    } else {
      row.kpi_value_auto = t.kpi_value;
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const da = formatDateForInput(b.shift_date).localeCompare(formatDateForInput(a.shift_date));
    if (da !== 0) return da;
    if (a.BU !== b.BU) return String(a.BU).localeCompare(String(b.BU));
    if (a.KPI_code !== b.KPI_code) return Number(a.KPI_code) - Number(b.KPI_code);
    return Number(a.shift_n) - Number(b.shift_n);
  });
}

function buildWhere(filters = {}) {
  const where = {};
  if (filters.bu) where.BU = { eq: filters.bu };
  if (filters.kpi_code !== undefined && filters.kpi_code !== '' && filters.kpi_code !== null) {
    where.KPI_code = { eq: parseInt(filters.kpi_code, 10) };
  }
  if (filters.shift_date) {
    where.shift_date = { eq: filters.shift_date };
  }
  if (filters.shift_n !== undefined && filters.shift_n !== '' && filters.shift_n !== null) {
    where.shift_n = { eq: parseInt(filters.shift_n, 10) };
  }
  return Object.keys(where).length ? where : undefined;
}

export async function fetchApp2Rows(filters = {}) {
  let q = rayfinClient.data.App2.select(APP2_FIELDS);
  const where = buildWhere(filters);
  if (where) q = q.where(where);
  const page = await q.first(5000).executePaginated();
  return page?.items ?? page ?? [];
}

export async function fetchFilterOptions() {
  const page = await rayfinClient.data.App2.select([
    'BU',
    'KPI_code',
    'shift_date',
    'shift_n',
  ])
    .first(5000)
    .executePaginated();
  const rows = page?.items ?? page ?? [];
  const bu = [...new Set(rows.map((r) => r.BU).filter(Boolean))].sort();
  const kpi_code = [...new Set(rows.map((r) => r.KPI_code).filter((v) => v != null))].sort(
    (a, b) => a - b
  );
  const shift_date = [
    ...new Set(rows.map((r) => formatDateForInput(r.shift_date)).filter(Boolean)),
  ]
    .sort()
    .reverse();
  const shift_n = [...new Set(rows.map((r) => r.shift_n).filter((v) => v != null))].sort(
    (a, b) => a - b
  );
  return { bu, kpi_code, shift_date, shift_n };
}

/**
 * Сохраняет только строки, где ручное значение реально изменилось.
 * TMSTMP и USER пишутся только в этот момент.
 */
export async function saveManualRows(rows) {
  const user = getCurrentUserLabel();
  const now = new Date();

  for (const row of rows) {
    if (!manualChanged(row.kpi_value_manual_prev, row.kpi_value_manual)) {
      continue;
    }

    const payload = {
      BU: row.BU,
      KPI_code: row.KPI_code,
      shift_date: row.shift_date,
      shift_n: row.shift_n,
      ShiftFrom: row.ShiftFrom ?? undefined,
      ShiftTo: row.ShiftTo ?? undefined,
      SCENARIO: row.SCENARIO || undefined,
      value_source: 'APP',
      kpi_value: row.kpi_value_manual,
      TMSTMP: now,
      changed_by: user || undefined,
    };

    if (row._manualId) {
      await rayfinClient.data.App2.update({ id: row._manualId }, payload);
    } else {
      await rayfinClient.data.App2.create(payload);
    }
  }
}
