# Олимп

Бесплатное некоммерческое офлайн-first PWA для русскоязычных детей в Нидерландах:
поддержка русского языка и уровня математики, сопоставимого с российской школьной
программой. Эталон сложности — школьный этап ВсОШ; участие в самой олимпиаде не требуется.

MVP — 4 класс РФ (≈ groep 6 нидерландской basisschool), математика и русский язык.

Полное техническое задание: [docs/spec-v4.md](docs/spec-v4.md).

## Структура

```
apps/pwa          — клиент (React + Vite + TS, offline-first, IndexedDB)
apps/admin        — админ-панель за Cloudflare Access
workers/proxy     — Cloudflare Worker: прокси к Anthropic API, выдача пакетов, телеметрия
packages/schema   — Zod-схемы задач, пакетов, форматов олимпиады и телеметрии
pipeline          — генерация задач (Opus 5) + независимая верификация + сборка пакетов
db/migrations     — схема D1 (провенанс, лог прокси, агрегаты телеметрии)
content           — архивные образцы и собранные пакеты
docs              — ТЗ, архитектура, правовой блок
```

## Быстрый старт

```bash
pnpm install
pnpm dev
```

PWA поднимется на `http://localhost:5173`. Для работы с контентом и подсказками нужен
локальный Worker:

```bash
cp workers/proxy/.dev.vars.example workers/proxy/.dev.vars   # вписать ANTHROPIC_API_KEY
pnpm dev:proxy
```

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | PWA в режиме разработки |
| `pnpm dev:proxy` | Worker-прокси локально (`wrangler dev`, порт 8787) |
| `pnpm dev:admin` | админ-панель |
| `pnpm typecheck` | проверка типов во всех пакетах |
| `pnpm test` | тесты |
| `pnpm build` | сборка всех пакетов |
| `pnpm db:migrate:local` | применить миграции D1 локально |
| `pnpm --filter @olymp/pwa icons` | пересобрать иконки PWA |

## Конвейер контента

```bash
cd pipeline && cp .env.example .env    # вписать ANTHROPIC_API_KEY

pnpm --filter @olymp/pipeline generate -- --subject math --grade 4 --topic word_problems --level 2 --count 10
pnpm --filter @olymp/pipeline verify   -- --run <run-id>
pnpm --filter @olymp/pipeline publish  -- --run <run-id> --version 1.0.0
```

Архивные задачи идут в обход генерации — их ответы берутся из официального ключа:

```bash
pnpm --filter @olymp/pipeline import-archive -- --subject math --grade 4 --version 1.0.0
```

Генерация и верификация — независимые прогоны Claude Opus 5; спорные случаи уходят
к Claude Fable 5.1. Публикуются только задачи с вердиктом `pass`. Подробнее —
[docs/architecture.md](docs/architecture.md).

## Приватность

Регистрации и аккаунтов нет. Прогресс ребёнка хранится только в IndexedDB на устройстве
и никогда не покидает его. Телеметрия обезличена, без IP и геолокации, со сменяемым
`installation_id` и ретенцией 90 дней. В промптах к Anthropic нет персональных данных —
только тексты задач.

Правовая рамка: GDPR + нидерландский UAVG. См. [docs/legal/](docs/legal/).

## Контент

В приложении 28 задач для 4 класса — школьный этап ВсОШ в Москве за 2024/25 и
2025/26 годы, с официальными ключами ответов и обязательной атрибуцией
(математика — 15, русский язык — 13). Подробнее, включая критерии отбора и то,
что не вошло: [docs/content-bank.md](docs/content-bank.md).

Чтобы задачи были видны при локальном запуске, пакеты нужно положить в локальный
R2 — команды там же.

## Статус

Реализовано: схемы данных, ядро PWA (выбор класса, темы, решение задач с
подсказками и разбором, режим олимпиады, родительский экран, стрики),
Worker-прокси, конвейер контента, архивный банк задач, иконки PWA, схема D1, CI.

Не реализовано: генерация новых задач (конвейер готов, нужен ключ API), панели
админки, регистрация service worker в UI. См. [docs/roadmap.md](docs/roadmap.md).
