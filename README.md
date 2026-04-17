# msrv_map — Генератор карт с координатной сеткой

Веб-приложение для создания карт с координатной сеткой квадратов и точками интереса.
Предназначено для подготовки карт к полевой работе: экспорт на мобильные устройства
(MapsPlus, AlpineQuest, Google Earth) и печать.

## Возможности

### Карта
- 3 подложки: спутниковый снимок (ArcGIS), OpenStreetMap, OpenTopoMap
- Перемещение, зум, автоматическое центрирование на сетке при загрузке проекта

### Координатная сетка
- Выбор прямоугольной зоны → генерация сетки из квадратов заданного размера
- Настраиваемый размер ячейки (в метрах), стартовая буква, цвет и толщина линий
- Специальные ячейки: **A1** — блок масштаба (`<размер м>`), **A2** — «улитка» с секторами 1–4
- Краевые метки (буквы слева/справа, цифры сверху/снизу)
- Сдвиг сетки стрелками с произвольным шагом
- Настраиваемые шрифты, размеры подписей, их цвет и обводка

### Метки (POI)
- 5 типов: обычная, внимание, опасность, инфо, КПП
- Название + описание для каждой метки
- Перетаскивание, редактирование, удаление

### Проекты
- Сохранение в браузере (`localStorage`)
- При загрузке карта центрируется на сетке, настройки оформления подтягиваются автоматически
- Импорт KMZ/KML заменяет текущие данные

### Экспорт
- **PNG** — высокое разрешение (до 4000px), offscreen canvas с пиксельным snap линий и общей реализацией рендера с KMZ overlay
- **KML** — только точки (метки), без полигонов сетки — совместимо с MapsPlus, AlpineQuest
- **KMZ** — точки + сетка как полупрозрачный `GroundOverlay` поверх карты

### Конвертер
Отдельная страница (`/converter.html`) для преобразования между KML, KMZ и GPX.

### Справка
Модалка со справкой по всем разделам показывается при первой загрузке и открывается
кнопкой `?` в шапке.

## Требования

- Node.js 18+
- npm

## Локальная разработка

```bash
git clone <repo-url>
cd msrv_map
npm install
npm run dev
```

Откройте http://localhost:5173 в браузере.

### Сборка

```bash
npm run build       # собирает в dist/
npm run preview     # запускает preview-сервер на порту 5173
```

### Тесты

```bash
npm test                    # unit-тесты (vitest)
npx playwright test         # e2e (нужен запущенный preview на 5174)
```

## Деплой

### Nginx (статика)

Соберите проект (`npm run build`) и положите содержимое `dist/` в корень статики.
Пример `/etc/nginx/sites-available/msrv-map`:

```nginx
server {
    listen 80;
    server_name maps.example.com;

    root /var/www/msrv-map;
    index index.html;

    # SPA-роуты на единственный 404 не нужны — есть статические
    # converter.html и index.html, остальное просто файлы

    location / {
        try_files $uri $uri/ =404;
    }

    # Кеширование ассетов Vite (имена с хешем)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
```

Подключить и перезапустить:

```bash
sudo ln -s /etc/nginx/sites-available/msrv-map /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Docker (multi-stage с nginx)

Создайте `Dockerfile` в корне:

```dockerfile
# build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# runtime stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Минимальный `nginx.conf`:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / { try_files $uri $uri/ =404; }
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

Сборка и запуск:

```bash
docker build -t msrv-map .
docker run -d -p 8080:80 --name msrv-map msrv-map
```

Открыть: http://localhost:8080

### docker-compose

```yaml
services:
  web:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
```

```bash
docker compose up -d --build
```

### GitHub Pages / Netlify / Vercel

Приложение — чистая статика, SPA-роутинг не нужен (`index.html` и `converter.html` —
обычные файлы). Любой статический хостинг работает из коробки:

- Билд-команда: `npm run build`
- Директория публикации: `dist`

## Стек

| Технология     | Назначение               |
|---------------|--------------------------|
| Vite          | Сборка, dev-сервер       |
| TypeScript    | Типобезопасность         |
| Leaflet       | Интерактивная карта      |
| JSZip         | Работа с KMZ (ZIP)       |
| Vitest        | Unit-тесты               |
| Playwright    | E2E-тесты                |

## Структура проекта

```
src/
  core/        — бизнес-логика (карта, сетка, маркеры, проекты, event-bus)
  export/      — экспорт/импорт (KML, KMZ, GPX, PNG, общий grid-painter)
  converter/   — отдельная страница конвертера
  ui/          — интерфейс (sidebar, табы, модалки)
  utils/       — утилиты (geo, dom, xml, download)
styles/        — CSS
e2e/           — Playwright-тесты
```

Подробности архитектуры для агента-помощника — в [CONTRIBUTE.md](./CONTRIBUTE.md).

## Лицензия

MIT
