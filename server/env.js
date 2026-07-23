import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.error('');
  console.error('Файл .env не найден: ' + envPath);
  console.error('Скопируйте .env.example в .env и заполните переменные (SQL_SERVER, SQL_DATABASE, SQL_USER, SQL_PASSWORD):');
  console.error('  copy .env.example .env');
  console.error('');
}

dotenv.config({ path: envPath });

if (!process.env.SQL_SERVER || !process.env.SQL_DATABASE) {
  console.warn('Предупреждение: SQL_SERVER или SQL_DATABASE не заданы. Проверьте файл .env в папке server.');
}
