import sql from 'mssql';

const sqlPort = parseInt(process.env.SQL_PORT, 10) || 1433;
const sqlServer = (process.env.SQL_SERVER || 'localhost').trim();

const config = {
  server: sqlServer,
  port: sqlPort,
  database: (process.env.SQL_DATABASE || '').trim(),
  user: (process.env.SQL_USER || '').trim(),
  password: process.env.SQL_PASSWORD || '',
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

let pool = null;

export async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

/** Проверка доступа к таблице [dbo].[APP2] */
export async function checkTable() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT COUNT(*) AS cnt FROM [dbo].[APP2]
  `);
  const row = result.recordset?.[0];
  return { ok: true, rowCount: row ? Number(row.cnt) : 0 };
}

export async function getData(filters = {}) {
  const pool = await getPool();
  const { bu, kpi_code, shift_date, shift_n } = filters;

  const request = pool.request();
  let query = `
    SELECT TOP 5000
      t.BU,
      t.KPI_code,
      t.shift_date,
      t.shift_n,
      t.ShiftFrom,
      t.ShiftTo,
      t.SCENARIO,
      MAX(CASE WHEN t.value_source = 'APP' THEN t.kpi_value END) AS kpi_value_manual,
      MAX(CASE WHEN t.value_source = 'APP' THEN t.TMSTMP END) AS TMSTMP_MANUAL,
      MAX(CASE WHEN ISNULL(t.value_source, '') <> 'APP' THEN t.kpi_value END) AS kpi_value_auto
    FROM [dbo].[APP2] t
    WHERE 1=1
  `;

  if (bu) {
    request.input('bu', sql.VarChar(5), bu);
    query += ` AND t.BU = @bu`;
  }
  if (kpi_code !== undefined && kpi_code !== '' && kpi_code !== null) {
    request.input('kpi_code', sql.Int, parseInt(kpi_code, 10));
    query += ` AND t.KPI_code = @kpi_code`;
  }
  if (shift_date) {
    request.input('shift_date', sql.Date, shift_date);
    query += ` AND t.shift_date = @shift_date`;
  }
  if (shift_n !== undefined && shift_n !== '' && shift_n !== null) {
    request.input('shift_n', sql.Int, parseInt(shift_n, 10));
    query += ` AND t.shift_n = @shift_n`;
  }

  query += `
    GROUP BY t.BU, t.KPI_code, t.shift_date, t.shift_n, t.ShiftFrom, t.ShiftTo, t.SCENARIO
    ORDER BY t.shift_date DESC, t.BU, t.KPI_code, t.shift_n
  `;

  const result = await request.query(query);
  return result.recordset;
}

export async function getFilterOptions() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT DISTINCT BU FROM [dbo].[APP2] WHERE BU IS NOT NULL ORDER BY BU
  `);
  const bu = (result.recordset || []).map((r) => r.BU);

  const r2 = await pool.request().query(`
    SELECT DISTINCT KPI_code FROM [dbo].[APP2] WHERE KPI_code IS NOT NULL ORDER BY KPI_code
  `);
  const kpi_code = (r2.recordset || []).map((r) => r.KPI_code);

  const r3 = await pool.request().query(`
    SELECT DISTINCT shift_date FROM [dbo].[APP2] WHERE shift_date IS NOT NULL ORDER BY shift_date DESC
  `);
  const shift_date = (r3.recordset || []).map((r) => r.shift_date);

  const r4 = await pool.request().query(`
    SELECT DISTINCT shift_n FROM [dbo].[APP2] WHERE shift_n IS NOT NULL ORDER BY shift_n
  `);
  const shift_n = (r4.recordset || []).map((r) => r.shift_n);

  return { bu, kpi_code, shift_date, shift_n };
}

export async function saveManualRow(row) {
  const pool = await getPool();
  const {
    BU,
    KPI_code,
    shift_date,
    shift_n,
    SCENARIO,
    kpi_value_manual,
  } = row;

  const request = pool.request();
  request.input('BU', sql.VarChar(5), BU);
  request.input('KPI_code', sql.Int, KPI_code);
  request.input('shift_date', sql.Date, shift_date);
  request.input('shift_n', sql.Int, shift_n);
  request.input('SCENARIO', sql.NVarChar(20), SCENARIO || null);
  request.input('kpi_value', sql.Decimal(18, 10), kpi_value_manual);

  await request.query(`
    MERGE [dbo].[APP2] AS target
    USING (SELECT @BU AS BU, @KPI_code AS KPI_code, @shift_date AS shift_date, @shift_n AS shift_n, @SCENARIO AS SCENARIO) AS source
    ON target.BU = source.BU
       AND target.KPI_code = source.KPI_code
       AND target.shift_date = source.shift_date
       AND target.shift_n = source.shift_n
       AND ISNULL(target.SCENARIO, '') = ISNULL(source.SCENARIO, '')
       AND target.value_source = 'APP'
    WHEN MATCHED THEN
      UPDATE SET kpi_value = @kpi_value, TMSTMP = GETDATE()
    WHEN NOT MATCHED BY TARGET THEN
      INSERT (BU, KPI_code, shift_date, shift_n, ShiftFrom, ShiftTo, value_source, SCENARIO, kpi_value, TMSTMP)
      VALUES (
        @BU,
        @KPI_code,
        @shift_date,
        @shift_n,
        (SELECT TOP 1 ShiftFrom FROM [dbo].[APP2] WHERE BU = @BU AND KPI_code = @KPI_code AND shift_date = @shift_date AND shift_n = @shift_n),
        (SELECT TOP 1 ShiftTo FROM [dbo].[APP2] WHERE BU = @BU AND KPI_code = @KPI_code AND shift_date = @shift_date AND shift_n = @shift_n),
        'APP',
        @SCENARIO,
        @kpi_value,
        GETDATE()
      );
  `);
}
