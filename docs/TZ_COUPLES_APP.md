# ТЗ: **LovePDuo** (LPD — Love Play Duo)

> Версия документа: **1.1.2**  
> Статус: живой документ — можно дополнять секциями без ломки структуры  
> Платформа: **Android (Google Play)** в первую очередь; iOS — фаза 2  
> Исполнитель реализации: **Cursor Agent** (автономная разработка, самопроверка, git push)  
> Язык продукта: RU (основной), EN (заготовка строк)  
> Локальный путь проекта владельца: **`C:\prodject\LovePDio`**  
> **Канонический GitHub-репозиторий: [`https://github.com/saha9012/LovePDuo.git`](https://github.com/saha9012/LovePDuo.git)** — вся разработка только здесь (НЕ `saha9012/pom`)

---

## 0. Как пользоваться этим ТЗ

1. Это **источник правды** для продукта. Любое изменение фичи = правка версии и changelog в конце.
2. Cursor читает ТЗ целиком перед стартом спринта и работает **без ожидания уточнений**, если решение можно принять из секций 3–12 и 24.
3. Если конфликт: **приоритет** = Acceptance Criteria (секция 14) + Ideal Bar / авто-доводка (секция 24) > UX-правила (секция 5) > backlog (секция 16).
4. Документ специально **большой и избыточный**, чтобы агент мог сам дизайнить, рисовать ассеты и доводить до идеала по чеклистам.

### 0.1. Правила для Cursor Agent

- Работай итерациями: **спроектировать → реализовать → запустить → проверить → починить → улучшить до Ideal Bar → commit → push**.
- Не спрашивай человека про цвета, отступы, названия экранов, если они уже заданы ниже.
- Если ассет нужен — **создай сам**. Не ставь заглушки “TODO art” надолго.
- UI не должен выглядеть как шаблон Material “из коробки”. Кастомные компоненты обязательны.
- **Стек — средство, не цель.** Зафиксируй выбор в README и не прыгай без причины.
- Каждые заметные изменения: commit с понятным сообщением + push в feature-ветку.
- Definition of Done: работает на 2 устройствах/эмуляторах, нет крашей, dark-romantic визуал, empty/error/loading, агент не видит очевидных улучшений (§24).

### 0.2. Режим работы до упора (критично)

Агент **не останавливается “потому что вроде работает”**.

Работать пока не случится одно из:
1. человека/оператора явно остановили;
2. внешний фактор оборвал сессию;
3. агент на **~100% уверен**, что выжал максимум по текущему скоупу (Ideal Bar §14.2, чеклист §23).

Перед паузой: собираемый проект, `docs/PROGRESS.md`, push в git.

### 0.3. Путь проекта

- Владелец локально: **`C:\prodject\LovePDio`**
- Бренд: **LovePDuo** / **LPD** = Love Play Duo
- Пакеты: `lovepduo`, `app.lovepduo`
- Документы: `docs/`

### 0.4. Канонический репозиторий (критично)

| Что | Значение |
| --- | --- |
| Canonical remote | **`https://github.com/saha9012/LovePDuo.git`** |
| Owner local path | **`C:\prodject\LovePDio`** |
| Base branch | `main` |

1. Вся реализация / commits / pushes / PRs — **только** в LovePDuo.
2. **`saha9012/pom` запрещён** как дом продукта.
3. Feature-ветки: `cursor/<descriptive-name>-8960` (или суффикс агента).

---

## 1. Продуктовая идея

**LovePDuo (LPD)** — тёмное, дерзко-красивое приложение для влюблённых: проработанные миниигры на **двух телефонах**, общая музыка внутри приложения, ритуалы “вместе”.

Позиционирование: **инновационный dark romantic playground для двоих** — не ванильная love-app.

---

## 2–3. Аудитория и бренд

- ЦА: пары 16–35 (фокус 18–28), LDR и рядом.
- Tone: тёплый, чуть дерзкий, живой. Не корпоративно. Не ватно.
- Hero первого экрана: крупный **LovePDuo**, один подзаголовок, один CTA, full-bleed фон.
- Store title draft: `LovePDuo: игры для двоих`

---

## 4. Платформа и стек

| Фаза | Платформа |
|------|-----------|
| MVP | Android |
| 1.5 | Preview web |
| 2 | iOS |

**Зафиксированный стек реализации:** Expo (React Native) + TypeScript + Reanimated; backend WS stub; later Supabase/Firebase.  
(Flutter рекомендован в дефолтах, но SDK отсутствует в среде владельца — см. README.)

Структура:

```text
/apps/mobile
/packages/ui
/packages/game-core
/backend
/assets
/docs
README.md
```

---

## 5. Визуальный язык

**Dark Romantic Innovation** — ночь, бархат, янтарь, пыльная роза, стекло, cinematic light.

```text
--bg-0: #07060A
--bg-1: #121018
--bg-2: #1B1524
--bg-elevated: #241C31
--stroke: rgba(255,214,186,0.12)
--text-primary: #F7EDE3
--text-secondary: #C9B6A8
--text-muted: #8E7B72
--accent-rose: #E39AA0
--accent-amber: #E2B07A
--accent-wine: #8E3B4A
--accent-mist: #7A8CA3
```

Типографика: Fraunces (display), Sora (UI), IBM Plex Mono (коды).  
Motion: breathing bg, pair cinematic, veil, game juice, post-match reveal.  
Светлая тема в MVP не делается.

---

## 6. Экраны

Tabs: Home · Play · Music · Together · Profile  
+ Auth/Onboarding: Splash, Welcome, Sign in, Create/Join pair, Pair success cinematic.

---

## 7. Функциональные требования

### 7.1–7.2 Пара / presence

Must: регистрация/вход, create/join 6-char code, одна активная пара, presence.  
Should: QR + `lovepduo://join/CODE`, имя пары, mood-фон, pulse/warmth.

### 7.3 Игры MVP

Общее: 2 телефона, lobby/ready/start/reconnect, post-match copy ≥30 фраз, rematch.

1. **Sky Claim** — раздельные поля, falling orbs/amber/decoy, combo, ~45–60s, seed spawn.
2. **Heartbeat Tap** — общий бит, perfect/great/miss, sync bonus, 30–45s.
3. **Truth Or Spark** — question/dare/spark, soft/spicy, skip limit, ≥60 RU cards.

### 7.4 Музыка

Must: upload persist + in-app player + pair library + reactions + now playing.  
Try hard: Spotify OAuth/metadata/remote; VK import or honest fallback.  
Принцип: любой трек = запись `Track` в библиотеке пары.

### 7.5–7.7 Together / notifications / safety

Daily Spark, Warmth, Candle Timer, Notes, Memories; invites; 16+; unlink/report; secrets in env.

---

## 8–12. NFR, ассеты, design system, API, store

См. также `DESIGN_SYSTEM.md`, `GAMES_SPEC.md`.  
Entities: User, Pair, Presence, GameSession, Track, Playlist, Note, Memory, DailySpark.  
Game states: `lobby → countdown → playing → round_end → finished`.

---

## 13. Фазы

0 Foundation → 1 Pair core → 2 Games MVP → 3 Music persist → 4 Polish/store → 5 Expand

---

## 14. Acceptance Criteria

### 14.1 Must-have

- Android install, регистрация, связка двух аккаунтов
- Dark romantic amber/dusty-rose
- Бренд LovePDuo/LPD с первого экрана
- 3 MVP-игры с 2 телефонов
- Sky Claim + живой post-match
- Upload музыка persist + in-app
- Spotify/VK попытки в PROGRESS
- Нет критических крашей; ассеты не grey placeholder; git push

### 14.2 Ideal Bar

Сторис-скрин, pair cinematic, игры понятны за ~10с, post-match улыбка/азарт, музыкальная «полка», нет очевидных косяков «на потом».

---

## 15–19. Метрики, backlog, out of scope, контент, store listing

Out of scope MVP: мессенджер/звонки, dating, подписка, комнаты >2, пиратский оффлайн Spotify/VK.  
Контент: `assets/content/sparks_ru.json` ≥60, `post_match_ru.json` ≥30.

---

## 20–21. Операционный план и дефолты

| Тема | Дефолт |
|------|--------|
| Название | LovePDuo / LPD |
| Путь | `C:\prodject\LovePDio` |
| Стек | Expo RN (зафиксировано; Flutter был дефолт ТЗ) |
| Backend | WS stub → Firebase/Supabase |
| MVP игры | Sky Claim, Heartbeat Tap, Truth Or Spark |
| Музыка | upload persist + Spotify try + VK try |

---

## 22. Changelog

### 1.1.2
- Product-facing текст без черновых имён; бренд везде LovePDuo/LPD.
- Историческая пометка только здесь (v1.0.0-draft).

### 1.1.1
- Канонический GitHub: `https://github.com/saha9012/LovePDuo.git`.
- §0.4: pom запрещён как дом продукта.

### 1.1.0
- Ребренд LovePDuo / LPD; dark romantic; music persist; Sky Claim quality focus; §0.2 + §24.

### 1.0.0-draft
- Первичное ТЗ под временным именем Aurora Pair (позже → LovePDuo).

---

## 23. Чеклист “не дефолтная love-приложуха”

1. LovePDuo как бренд-герой?
2. Фон с глубиной?
3. Янтарь + пыльная роза (не purple neon)?
4. Выразительные шрифты?
5. Home не dashboard?
6. Motion к месту?
7. Кастомные иконки/обложки?
8. Игры кайфовы с 2 телефонов?
9. Музыка остаётся в приложении?
10. Хочется снять Reels?

Если ≥2 “нет” — сначала визуал/feel.

---

## 24. Авто-доводка до Ideal Bar

Видишь слабость относительно §5 / §14.2 / §23 → улучшай сам.  
Цикл: найти → улучшить → проверить на 1–2 клиентах → commit/push → повторять до остановки по §0.2.

**Конец ТЗ v1.1.2 — LovePDuo (LPD).**
