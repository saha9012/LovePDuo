# LovePDuo (LPD — Love Play Duo)

Тёмное, дерзко-красивое приложение для влюблённых: миниигры с **двух телефонов**, музыка, которая остаётся в приложении, и ритуалы «вместе».

> Канонический репозиторий: [`https://github.com/saha9012/LovePDuo.git`](https://github.com/saha9012/LovePDuo.git)  
> Локальный путь владельца: `C:\prodject\LovePDio`  
> ТЗ: [`docs/TZ_COUPLES_APP.md`](docs/TZ_COUPLES_APP.md)

## Стек (зафиксировано)

| Слой | Выбор | Почему |
|------|--------|--------|
| Mobile | **Expo (React Native) + TypeScript** | Быстрый вау-UI, Reanimated, Android-first, web preview |
| Motion | `react-native-reanimated` + custom chrome | Breathing bg, veil, juice |
| Persist (MVP) | AsyncStorage + upload URIs | Музыка/пара переживают релог |
| Realtime (next) | Node WebSocket room server в `/backend` | Синхрон 2 телефонов |
| Backend later | Supabase/Firebase | Auth + storage + presence |

Flutter в среде владельца не установлен — Expo выбран ради Ideal Bar и скорости доводки визуала/игр.

## Структура

```text
apps/mobile          Expo app (LovePDuo)
backend              Realtime room stub
packages/ui          (задел)
packages/game-core   (задел)
assets/              brand / content / audio
docs/                TZ, design, games, progress
```

## Запуск

```bash
cd apps/mobile
npm install
npm start
# Android: npm run android
# Web preview: npm run web
```

ApplicationId / bundle: `app.lovepduo`  
Scheme: `lovepduo://join/CODE`

## MVP игры

1. **Sky Claim** — ловля огней на своём поле, комбо, обманки, post-match
2. **Heartbeat Tap** — ритм + sync bonus
3. **Truth Or Spark** — ≥60 карточек RU, soft/spicy

## Музыка

- Upload mp3/m4a → библиотека пары (persist)
- Spotify / VK — metadata + честные fallback (см. `docs/PROGRESS.md`)

## Документы

- [`docs/TZ_COUPLES_APP.md`](docs/TZ_COUPLES_APP.md) — источник правды
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)
- [`docs/GAMES_SPEC.md`](docs/GAMES_SPEC.md)
- [`docs/PROGRESS.md`](docs/PROGRESS.md)
