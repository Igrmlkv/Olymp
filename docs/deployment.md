# Развёртывание

## Порядок имеет значение

Юрисдикция `eu` у D1 и R2 задаётся **только при создании** и не меняется потом.
Если создать ресурсы без неё, придётся пересоздавать и переносить данные.

## 1. Cloudflare-ресурсы

```bash
# D1 в EU-юрисдикции
wrangler d1 create olymp-audit --location weur

# R2 в EU-юрисдикции
wrangler r2 bucket create olymp-packages --jurisdiction eu
```

Полученный `database_id` вписать в `workers/proxy/wrangler.toml` вместо
`REPLACE_WITH_D1_ID`.

## 2. Миграции

```bash
pnpm db:migrate:local    # локально
pnpm db:migrate:remote   # в Cloudflare
```

## 3. Секреты

```bash
cd workers/proxy
wrangler secret put ANTHROPIC_API_KEY
```

Ключ живёт только здесь. Ни в репозитории, ни в клиентском бандле его быть не может.

## 4. Деплой Worker

```bash
pnpm --filter @olymp/proxy deploy
```

## 5. PWA на Pages

```bash
pnpm --filter @olymp/pwa build
wrangler pages deploy apps/pwa/dist --project-name olymp
```

Маршрут `/api/*` должен уходить на Worker — настраивается через Routes или
Pages Functions, в зависимости от выбранной схемы домена.

## 6. Админ-панель за Access

Админка не имеет собственной авторизации: единственный барьер — Cloudflare Access.
Задать политику доступа (по email) до первого деплоя, иначе панель окажется открытой.

```bash
pnpm --filter @olymp/admin build
wrangler pages deploy apps/admin/dist --project-name olymp-admin
```

## 7. Публикация пакета контента

```bash
wrangler r2 object put olymp-packages/packages/math/grade-4/1.0.0.json \
  --file content/packages/math/grade-4/1.0.0.json --jurisdiction eu

wrangler r2 object put olymp-packages/packages/math/grade-4/latest.json \
  --file content/packages/math/grade-4/1.0.0.json --jurisdiction eu
```

Откат версии — перезапись `latest.json` содержимым предыдущей версии; сами
версионные объекты никогда не перезаписываются.

## Проверка после деплоя

```bash
curl https://<worker>/api/health
curl https://<worker>/api/packages/math/4/latest.json | head -c 200
```
