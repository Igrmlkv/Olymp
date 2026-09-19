# Иконки PWA

Здесь должны лежать `icon-192.png`, `icon-512.png` и `icon-512-maskable.png`,
на которые ссылается манифест в `vite.config.ts`.

Сгенерировать из `public/favicon.svg` можно любым конвертером, например:

```bash
npx pwa-asset-generator public/favicon.svg public/icons --icon-only --favicon --opaque false
```

Пока файлов нет, установка PWA на домашний экран будет без иконки — сборка при
этом не ломается.
