import './env.js';
import express from 'express';
import cors from 'cors';
import { getData, getFilterOptions, saveManualRow, checkTable } from './db.js';

const app = express();
const PORT = process.env.PORT || 5174;

app.use(cors());
app.use(express.json());

app.get('/api/check', async (req, res) => {
  try {
    const result = await checkTable();
    res.json({ ...result, table: 'dbo.ZHGOK_2026_test' });
  } catch (err) {
    console.error('[/api/check]', err);
    res.status(500).json({
      ok: false,
      error: err.message,
      code: err.code || err.name,
    });
  }
});

app.get('/api/filters', async (req, res) => {
  try {
    const options = await getFilterOptions();
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data', async (req, res) => {
  try {
    const filters = {
      bu: req.query.bu || '',
      kpi_code: req.query.kpi_code,
      shift_date: req.query.shift_date || '',
      shift_n: req.query.shift_n,
    };
    const data = await getData(filters);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/save', async (req, res) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    for (const row of rows) {
      await saveManualRow(row);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`DB: ${process.env.SQL_SERVER || '?'}:${process.env.SQL_PORT || '1433'}, database: ${process.env.SQL_DATABASE || '?'}`);
});
