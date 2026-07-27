# Ручной ввод APP2

React-форма для просмотра автоматических значений и ввода/правки ручных данных в таблицу **App2** (Rayfin Data API / Fabric).

## Fabric

```bash
npx rayfin login
npx rayfin up
```

После деплоя UI ходит в GraphQL Data API (`App2`), а не в Express `/api`. Нужна сессия Fabric SSO.

## Локально (опционально, Express → MS SQL dbo.APP2)

```bash
cd server
copy .env.example .env
npm install
npm start
```

```bash
cd client
npm install
npm run dev
```

Локальный Vite-прокси `/api` остаётся для Express; в Fabric используется RayfinClient.
