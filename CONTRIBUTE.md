# CONTRIBUTE — гид для AI-агента

Этот документ — карта проекта для автономного агента (Claude / Copilot / и т.п.).
Он объясняет устройство кодовой базы, договорённости и типовые операции, чтобы
можно было вносить изменения без лишнего исследования.

## Быстрый контекст

- **Что это**: фронтенд-приложение на Vite + TypeScript + Leaflet. Никакого
  бэкенда. Всё состояние живёт в памяти и частично в `localStorage`.
- **Две страницы**: `index.html` (основное приложение) и `converter.html`
  (отдельный конвертер форматов). Обе собираются как независимые entry points в
  `vite.config.ts`.
- **Язык интерфейса**: русский. Тексты UI, alert'ов и комментариев в коде — по-русски.
- **Сообщения коммитов**: тоже по-русски.

## Команды, которые нужно знать

```bash
npm run dev                   # dev-сервер Vite на http://localhost:5173
npm run build                 # продакшн-сборка в dist/
npm run preview               # предпросмотр сборки на 5173
npm test                      # vitest run (unit)
npx tsc --noEmit              # строгий type-check без эмита
npx vitest run --exclude='**/e2e/**'   # unit-тесты без Playwright
```

Playwright (e2e) нужен только когда просят e2e. Они требуют запущенный preview
на порту 5174 и падают в vitest — это нормально.

## Архитектура

### Слои

```
  UI (src/ui, index.html, styles/)
      │  читает/пишет через state + шину событий
      ▼
  Core (src/core)
      │  state.ts — единый store
      │  events.ts — типизированная шина (EventMap в types.ts)
      │  map.ts   — обёртка над Leaflet
      │  grid.ts, grid-render.ts — модель сетки и её отрисовка на карте
      │  markers.ts, markers-render.ts — аналогично для меток
      │  zone.ts, projects.ts — выбор зоны, сохранение проектов
      ▼
  Export (src/export)
         KML/KMZ/PNG/GPX, общий grid-painter для PNG+KMZ overlay
```

### Стейт и события

- `src/core/state.ts` — синглтон `state` с API `get` / `set` / `patch` /
  `snapshot` / `load`. Полная форма — `AppState` в `src/types.ts`.
- `src/core/events.ts` + `EventMap` в `types.ts` — типизированный event-bus
  (`bus.on`, `bus.emit`). Все межмодульные оповещения идут через него.
- Ключевые события: `project:loaded`, `grid:created`, `grid:style-changed`,
  `zone:selected`, `marker:*`, `map:moved`.
- **Правило**: при изменениях, которые должны видеть другие модули, меняй state
  через `set/patch` и эмить событие. Не зови UI из core напрямую.

### UI-табы

Каждый таб (`src/ui/tab-*.ts`) — одна функция `init...()`, вызываемая из
`src/main.ts` после `DOMContentLoaded`. Таб рендерит свой HTML через
`container.innerHTML = ...`, потом вешает слушателей и подписывается на `bus`.

Общие правила:
- Для DOM-селекторов использовать helper `$` из `src/utils/dom.ts`.
- Инпуты надо **синхронизировать из state** по событию `project:loaded` —
  иначе после загрузки проекта UI покажет дефолты, а state будет другим.
  Пример: `tab-grid.ts::syncInputsFromState`.
- Не хранить UI-состояние вне `state` — всё переживающее сессию идёт туда.

### Модалки

- Один div `#modal-overlay` в `index.html` используется всеми модалками.
- Каждая модалка — файл `src/ui/modal-*.ts` с функцией `show...Modal()`,
  которая заполняет `#modal-overlay` разметкой и ставит `display: flex`.
- Закрытие: крестик, Esc, клик по overlay. Эти три пути должны работать
  одновременно в каждой модалке (шаблон в `modal-help.ts` и `modal-png.ts`).

### Экспорт: grid-painter

**Важный инвариант**: PNG-экспорт и KMZ `GroundOverlay` используют **одну и ту же**
функцию рисования сетки — `drawGridOnCanvas` из `src/export/grid-painter.ts`.
Различаются только:
1. Проекцией (PNG — Mercator из `utils/geo.ts`, overlay — линейная lat/lng
   из-за требований KML `GroundOverlay`).
2. Параметром `edgeLabelsOutside` (PNG рисует краевые метки за пределами
   сетки в буферной зоне, overlay — внутри padding-страйпа).

**Не дублируй логику рисования**. Если нужно поменять стиль линий, шрифт,
обводку или позицию меток — правь `grid-painter.ts`, не трогай png-renderer
или grid-overlay.

### Резкость PNG

Линии снапятся к пиксельной решётке (`snap()` в `grid-painter.ts`): для
нечётной толщины — `Math.round(x) + 0.5`, для чётной — целые пиксели.
Без этого 1–2px линии размываются антиалиасингом canvas.

Разрешение PNG задано в `src/constants.ts` (`PNG_MAX_SIDE = 4000`). Поднимать
выше 5000 не рекомендую — многие просмотрщики тормозят.

### KML / KMZ — важные особенности

- **KML экспорт (`exportKml`) содержит только точки**, без полигонов сетки.
  Это осознанное решение: в MapsPlus/AlpineQuest векторная сетка рендерится
  плохо. Сетка доступна только через KMZ как `GroundOverlay`.
- **KMZ** = zip с `doc.kml` + `grid_overlay.png`. Сгенерированный KML
  ссылается на картинку через `<Icon><href>grid_overlay.png</href></Icon>` —
  путь относительный, без `./`.
- `kml-parser.ts` парсит оба формата обратно.

## Договорённости по коду

- **TypeScript строгий**, без `any` где возможно. Типы в `src/types.ts`.
- **Без лишних комментариев**. Комментарий объясняет *почему*, а не *что*.
  Хорошие примеры — одна строка про неочевидный инвариант (см. комментарий
  про линейную проекцию в `grid-overlay.ts`).
- **CSS БЭМ-подобный**: `.modal__header`, `.header__link--active`.
  Стили модалок — в `styles/modals.css`, общие — в `styles/main.css`.
- **Никаких i18n-библиотек** — просто строки на русском в коде.
- **Не добавлять зависимости** без веской причины. Сейчас runtime — только
  `leaflet` и `jszip`.

## Тесты

- Unit: `*.test.ts` рядом с кодом (`src/core/grid.test.ts`,
  `src/utils/geo.test.ts`, `src/export/*.test.ts`).
- Запуск: `npm test` (или `npx vitest run --exclude='**/e2e/**'` если нужно
  без Playwright-файлов).
- **Всегда запускай `npx tsc --noEmit` после правок** — vitest ошибки типов не
  ловит.
- E2E (`e2e/app.spec.ts`) — Playwright. Поднимать не каждый раз, только когда
  задача требует.

## Типовые задачи

### Добавить настройку оформления сетки

1. Поле в `AppState` (`src/types.ts`) + дефолт в `constants.ts` + инициализация
   в `state.ts::createDefaultState`.
2. Инпут в `src/ui/tab-grid.ts`: добавить в HTML, прочитать в `syncAllState`,
   написать в `syncInputsFromState`.
3. Прочитать в `src/export/grid-painter.ts::drawGridOnCanvas` (добавить в
   `GridPaintOptions`) и передать из обоих вызывающих.

### Добавить новый формат экспорта

1. Модуль в `src/export/<format>.ts` с функцией `export<Format>()`.
2. Кнопка в `src/ui/export-panel.ts`.
3. Проброс в `src/main.ts::initExportPanel({ on... })`.

### Добавить поле в проект (сохранение)

Автоматически: `saveProject` делает `state.snapshot()`, `loadProject` делает
`state.load(data)`. Достаточно добавить поле в `AppState` и дефолты.
UI-only поля (`markerMode`, `zoneSelectionMode`) удаляются вручную в
`projects.ts::saveProject`.

### Поправить баг «настройки не подтягиваются после загрузки проекта»

Скорее всего забыли обновить инпут в `syncInputsFromState` соответствующего
таба. Паттерн — подписка на `bus.on('project:loaded', syncInputsFromState)`.

## Git / коммиты

- Коммиты по-русски, императивный глагол в заголовке.
- Сообщение: 1–2 предложения про *почему*, потом буллеты про *что*.
- **Никаких push без прямой просьбы пользователя.**
- Никаких `--no-verify`, `--amend` без запроса.
- Подпись `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` —
  в конце.

## Beads (трекер задач)

Проект использует `bd` (beads) локально; `.beads/` в `.gitignore`.

```bash
bd ready                    # что можно брать
bd list --status=open
bd show <id>
bd create --title=... --description=... --type=bug|feature|task --priority=2
bd update <id> --claim      # взять в работу
bd close <id> [--reason=]
```

Приоритеты — числа 0–4 (0 = критично). **Не** `high/medium/low`.
Warning'и про `dolt auto-push failed` можно игнорировать — это удалённый sync,
локальная база работает нормально.

## Сервер Leaflet-тайлов

Используются публичные провайдеры (ArcGIS, OSM, OpenTopoMap) — см.
`src/constants.ts::TILE_PROVIDERS` и `src/core/map.ts::getTileUrl`.
Для PNG-рендера (`loadTiles` в `png-renderer.ts`) идёт прямой HTTP к тем же
серверам с `crossOrigin='anonymous'`. Если хостинг за CORS-прокси — этого
достаточно; приватные тайлы потребуют отдельной логики.

## Чего не делать

- Не вводить React/Vue/любой фреймворк — приложение намеренно лёгкое.
- Не добавлять бэкенд — всё работает на клиенте.
- Не дублировать рендер сетки между PNG и KMZ (см. инвариант про
  `grid-painter`).
- Не трогать `.beads/` — это локальные данные трекера.
- Не пушить на удалённый репозиторий без прямого указания.
