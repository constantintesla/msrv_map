// Основное приложение
class KMZGenerator {
    constructor() {
        this.map = null;
        this.currentTileLayer = null; // Текущий слой тайлов
        this.gridLayer = null;
        this.markers = [];
        this.gridSquares = [];
        this.gridSize = 100; // метры
        this.gridColor = '#667eea'; // цвет сетки
        this.gridWeight = 2; // толщина сетки
        // Улитка всегда показывается только в квадрате A2
        this.showSquareNames = true;
        this.markerMode = false;
        this.currentBounds = null;
        this.edgeLabels = [];
        this.selectedZone = null; // Выбранная зона для сетки
        this.previewLabels = []; // Метки для предпросмотра печати (для обновления размера шрифта)
        this.zoneRectangle = null; // Прямоугольник выбранной зоны
        this.zoneSelectionMode = false; // Режим выбора зоны
        this.printPreviewMap = null; // Карта для предпросмотра печати
        this.gridBounds = null; // Границы сетки для позиционирования краевых меток
        this.showEdgeLeft = true;
        this.showEdgeRight = false;
        this.showEdgeTop = true;
        this.showEdgeBottom = true;
        this.currentMapType = 'satellite'; // Тип текущей карты
        
        this.init();
    }
    
    init() {
        this.initMap();
        this.initControls();
        this.initMarkerMode();
    }
    
    initMap() {
        // Инициализация карты
        this.map = L.map('map', {
            center: [43.1151, 131.8854], // Владивосток
            zoom: 13,
            zoomControl: true
        });
        
        // Загрузка подложки по умолчанию (спутник)
        this.loadMapType('satellite');
        
        // Сохранение границ при изменении карты
        this.map.on('moveend', () => {
            this.currentBounds = this.map.getBounds();
        });
    }
    
    loadMapType(type) {
        // Сохраняем все слои, которые нужно оставить (не тайловые)
        const layersToKeep = [];
        this.map.eachLayer((layer) => {
            if (!(layer instanceof L.TileLayer)) {
                layersToKeep.push(layer);
            }
        });
        
        // Полностью очищаем карту от тайловых слоёв
        this.map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                try {
                    layer.remove();
                    this.map.removeLayer(layer);
                } catch (e) {
                    // Игнорируем ошибки при удалении
                }
            }
        });
        
        // Сбрасываем текущий слой
        this.currentTileLayer = null;
        
        let tileLayer;
        
        if (type === 'satellite') {
            // Спутниковые снимки через Esri World Imagery
            tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri',
                maxZoom: 19,
                minZoom: 1,
                tileSize: 256
            });
        } else if (type === 'topographic') {
            // Топографическая карта через OpenStreetMap (надежный источник)
            tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
                minZoom: 1,
                subdomains: ['a', 'b', 'c']
            });
        } else if (type === 'elevation') {
            // Карта с высотами через OpenTopoMap
            tileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a>',
                maxZoom: 17,
                minZoom: 1,
                subdomains: ['a', 'b', 'c']
            });
        }
        
        if (tileLayer) {
            // Обработка ошибок загрузки тайлов (убираем вывод в консоль, чтобы не засорять)
            tileLayer.on('tileerror', (error, tile) => {
                // Тихо обрабатываем ошибки - они могут быть из-за отсутствующих тайлов на высоких зумах
            });
            
            // Добавляем слой на карту
            tileLayer.addTo(this.map);
            this.currentTileLayer = tileLayer;
            this.currentMapType = type;
            
            // Восстанавливаем другие слои поверх карты
            layersToKeep.forEach(layer => {
                if (!this.map.hasLayer(layer)) {
                    layer.addTo(this.map);
                }
            });
        }
    }
    
    initControls() {
        // Изменение типа карты
        document.getElementById('map-type').addEventListener('change', (e) => {
            this.loadMapType(e.target.value);
        });
        
        // Размер сетки
        document.getElementById('grid-size').addEventListener('change', (e) => {
            this.gridSize = parseInt(e.target.value) || 100;
            // Обновляем метку масштаба в квадрате A1 если сетка уже создана
            if (this.gridSquares.length > 0) {
                const a1Square = this.gridSquares.find(s => s.name === 'A1');
                if (a1Square && a1Square.label) {
                    // Пересоздаем метку с новым текстом
                    this.map.removeLayer(a1Square.label);
                    a1Square.label = null;
                    this.drawSquareLabel(a1Square);
                }
            }
        });
        
        // Выбор зоны для сетки
        document.getElementById('select-zone').addEventListener('click', () => {
            this.startZoneSelection();
        });
        
        // Очистка выбранной зоны
        document.getElementById('clear-zone').addEventListener('click', () => {
            this.clearSelectedZone();
        });
        
        // Создание сетки
        document.getElementById('generate-grid').addEventListener('click', () => {
            this.generateGrid();
        });
        
        // Настройки сетки
        document.getElementById('grid-color').addEventListener('change', (e) => {
            this.gridColor = e.target.value;
            // Если сетка уже создана, обновляем её
            if (this.gridSquares.length > 0) {
                this.updateGridStyle();
            }
        });
        
        document.getElementById('grid-weight').addEventListener('change', (e) => {
            this.gridWeight = parseInt(e.target.value);
            // Если сетка уже создана, обновляем её
            if (this.gridSquares.length > 0) {
                this.updateGridStyle();
            }
        });
        
        // Очистка сетки
        document.getElementById('clear-grid').addEventListener('click', () => {
            this.clearGrid();
        });
        
        // Улитка больше не переключается - она всегда в A2
        
        // Переключение названий квадратов
        document.getElementById('show-square-names').addEventListener('change', (e) => {
            this.showSquareNames = e.target.checked;
            this.updateGridDisplay();
        });
        
        // Переключение краевых меток - пересоздаем метки только если сетка уже создана
        document.getElementById('show-edge-left').addEventListener('change', (e) => {
            this.showEdgeLeft = e.target.checked;
            if (this.gridSquares.length > 0) {
                this.updateEdgeLabels();
            }
        });
        
        document.getElementById('show-edge-right').addEventListener('change', (e) => {
            this.showEdgeRight = e.target.checked;
            if (this.gridSquares.length > 0) {
                this.updateEdgeLabels();
            }
        });
        
        document.getElementById('show-edge-top').addEventListener('change', (e) => {
            this.showEdgeTop = e.target.checked;
            if (this.gridSquares.length > 0) {
                this.updateEdgeLabels();
            }
        });
        
        document.getElementById('show-edge-bottom').addEventListener('change', (e) => {
            this.showEdgeBottom = e.target.checked;
            if (this.gridSquares.length > 0) {
                this.updateEdgeLabels();
            }
        });
        
        // Предпросмотр печати
        document.getElementById('print-preview').addEventListener('click', () => {
            this.showPrintPreview();
        });
        
        // Закрытие модального окна предпросмотра
        document.getElementById('close-print-preview').addEventListener('click', () => {
            this.hidePrintPreview();
        });
        
        document.getElementById('cancel-print-btn').addEventListener('click', () => {
            this.hidePrintPreview();
        });
        
        // Изменение формата и ориентации
        document.getElementById('paper-size').addEventListener('change', () => {
            this.updatePrintPreview();
        });
        
        document.getElementById('orientation').addEventListener('change', () => {
            this.updatePrintPreview();
        });
        
        // Печать
        document.getElementById('print-btn').addEventListener('click', () => {
            // Проверяем, что карта предпросмотра создана
            if (!this.printPreviewMap) {
                alert('Дождитесь загрузки карты в предпросмотре');
                return;
            }
            
            // Убеждаемся, что модальное окно видимо
            const modal = document.getElementById('print-preview-modal');
            if (modal.style.display === 'none') {
                alert('Откройте предпросмотр печати сначала');
                return;
            }
            
            // Небольшая задержка для гарантии, что всё отрисовано
            setTimeout(() => {
                // Обновляем размер карты перед печатью
                if (this.printPreviewMap) {
                    this.printPreviewMap.invalidateSize();
                }
                
                // Запускаем стандартную печать - CSS @media print скроет всё лишнее
                window.print();
            }, 100);
        });
        
        // Экспорт KMZ
        document.getElementById('export-kmz').addEventListener('click', () => {
            this.exportKMZ();
        });
        
        // Экспорт KML
        document.getElementById('export-kml').addEventListener('click', () => {
            this.exportKML();
        });
        
        // Импорт KMZ/KML
        document.getElementById('import-kmz').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importKMZ(file);
            }
            // Сбрасываем input для возможности повторной загрузки того же файла
            e.target.value = '';
        });
        
        // Очистка всего
        document.getElementById('clear-all').addEventListener('click', () => {
            if (confirm('Удалить все метки и сетку?')) {
                this.clearAll();
            }
        });
        
        // Сохранение проекта
        document.getElementById('save-project').addEventListener('click', () => {
            this.saveProject();
        });
        
        // Загрузка списка проектов при инициализации
        this.updateProjectsList();
    }
    
    initMarkerMode() {
        const addMarkerBtn = document.getElementById('add-marker-btn');
        addMarkerBtn.addEventListener('click', () => {
            this.markerMode = !this.markerMode;
            if (this.markerMode) {
                addMarkerBtn.textContent = 'Отменить добавление меток';
                addMarkerBtn.classList.add('active');
                this.map.getContainer().style.cursor = 'crosshair';
            } else {
                addMarkerBtn.textContent = 'Режим добавления меток';
                addMarkerBtn.classList.remove('active');
                this.map.getContainer().style.cursor = '';
            }
        });
        
        this.map.on('click', (e) => {
            if (this.markerMode && !this.zoneSelectionMode) {
                this.addMarker(e.latlng);
            }
        });
    }
    
    startZoneSelection() {
        // Отключаем режим меток если активен
        if (this.markerMode) {
            const addMarkerBtn = document.getElementById('add-marker-btn');
            addMarkerBtn.click();
        }
        
        this.zoneSelectionMode = true;
        this.map.getContainer().style.cursor = 'crosshair';
        
        const selectBtn = document.getElementById('select-zone');
        selectBtn.textContent = 'Режим выбора активен - нарисуйте прямоугольник';
        selectBtn.disabled = true;
        
        // Очищаем предыдущую зону если есть
        this.clearSelectedZone();
        
        // Переменные для рисования
        let startPoint = null;
        let rectangle = null;
        let isDrawing = false;
        
        // Сохраняем предыдущее состояние перетаскивания для восстановления
        this.wasDraggingEnabled = this.map.dragging.enabled();
        
        // Временно отключаем перетаскивание карты
        this.map.dragging.disable();
        
        // Обработчик отмены по Escape
        const cancelHandler = (e) => {
            if (e.key === 'Escape' && this.zoneSelectionMode) {
                if (rectangle) {
                    this.map.removeLayer(rectangle);
                }
                if (this.wasDraggingEnabled) {
                    this.map.dragging.enable();
                }
                this.cancelZoneSelection();
                document.removeEventListener('keydown', cancelHandler);
            }
        };
        document.addEventListener('keydown', cancelHandler);
        
        // Начало рисования
        const onMouseDown = (e) => {
            if (!this.zoneSelectionMode) return;
            
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            
            startPoint = e.latlng;
            isDrawing = true;
            
            // Создаем временный прямоугольник
            rectangle = L.rectangle([startPoint, startPoint], {
                color: '#ff7800',
                weight: 2,
                fill: false,
                dashArray: '10, 5',
                interactive: false
            }).addTo(this.map);
        };
        
        // Обновление при движении мыши
        const onMouseMove = (e) => {
            if (!isDrawing || !startPoint || !rectangle) return;
            
            const bounds = L.latLngBounds([startPoint, e.latlng]);
            rectangle.setBounds(bounds);
        };
        
        // Завершение рисования
        const onMouseUp = (e) => {
            if (!isDrawing || !startPoint || !rectangle) return;
            
            L.DomEvent.stopPropagation(e);
            
            isDrawing = false;
            const bounds = L.latLngBounds([startPoint, e.latlng]);
            
            // Проверяем минимальный размер зоны
            const width = bounds.getEast() - bounds.getWest();
            const height = bounds.getNorth() - bounds.getSouth();
            if (width < 0.0001 || height < 0.0001) {
                this.map.removeLayer(rectangle);
                // Восстанавливаем перетаскивание
                if (this.wasDraggingEnabled) {
                    this.map.dragging.enable();
                }
                this.finishZoneSelection();
                return;
            }
            
            // Сохраняем выбранную зону
            this.selectedZone = bounds;
            
            // Заменяем временный прямоугольник на постоянный
            this.map.removeLayer(rectangle);
            this.zoneRectangle = L.rectangle(bounds, {
                color: '#3388ff',
                weight: 3,
                fill: true,
                fillOpacity: 0.1,
                fillColor: '#3388ff',
                interactive: false
            }).addTo(this.map);
            
            // Восстанавливаем перетаскивание
            if (this.wasDraggingEnabled) {
                this.map.dragging.enable();
            }
            
            // Завершаем режим выбора
            this.finishZoneSelection();
            
            // Удаляем временные обработчики
            this.map.off('mousedown', onMouseDown);
            this.map.off('mousemove', onMouseMove);
            this.map.off('mouseup', onMouseUp);
            document.removeEventListener('keydown', cancelHandler);
        };
        
        // Добавляем обработчики с высоким приоритетом
        this.map.on('mousedown', onMouseDown);
        this.map.on('mousemove', onMouseMove);
        this.map.on('mouseup', onMouseUp);
        
        // Также добавляем обработчик для отмены при клике вне карты
        const mapContainer = this.map.getContainer();
        const globalMouseUp = (e) => {
            if (isDrawing && !mapContainer.contains(e.target)) {
                if (rectangle) {
                    this.map.removeLayer(rectangle);
                }
                isDrawing = false;
                if (this.wasDraggingEnabled) {
                    this.map.dragging.enable();
                }
                this.cancelZoneSelection();
                document.removeEventListener('mouseup', globalMouseUp);
            }
        };
        document.addEventListener('mouseup', globalMouseUp);
    }
    
    cancelZoneSelection() {
        this.zoneSelectionMode = false;
        this.map.getContainer().style.cursor = '';
        
        // Восстанавливаем перетаскивание если было включено
        if (this.wasDraggingEnabled !== undefined && this.wasDraggingEnabled) {
            this.map.dragging.enable();
        }
        
        const selectBtn = document.getElementById('select-zone');
        selectBtn.textContent = 'Выбрать зону для сетки';
        selectBtn.disabled = false;
    }
    
    finishZoneSelection() {
        this.zoneSelectionMode = false;
        this.map.getContainer().style.cursor = '';
        
        const selectBtn = document.getElementById('select-zone');
        selectBtn.textContent = 'Выбрать зону для сетки';
        selectBtn.disabled = false;
        
        // Показываем информацию о выбранной зоне
        document.getElementById('zone-info').style.display = 'block';
        document.getElementById('clear-zone').style.display = 'inline-block';
    }
    
    clearSelectedZone() {
        if (this.zoneRectangle) {
            this.map.removeLayer(this.zoneRectangle);
            this.zoneRectangle = null;
        }
        this.selectedZone = null;
        document.getElementById('zone-info').style.display = 'none';
        document.getElementById('clear-zone').style.display = 'none';
    }
    
    generateGrid() {
        // Используем выбранную зону или видимую область карты
        const bounds = this.selectedZone || this.map.getBounds();
        if (!bounds) {
            if (!this.selectedZone) {
                alert('Пожалуйста, выберите зону для сетки или убедитесь, что карта загружена.');
            }
            return;
        }
        
        this.clearGrid();
        
        const gridSizeMeters = this.gridSize;
        const center = bounds.getCenter();
        
        // Получаем границы области в метрах
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        
        // Размер квадрата в градусах (на средней широте зоны)
        const avgLat = (ne.lat + sw.lat) / 2;
        const sizeDegLat = gridSizeMeters / 111320;
        const sizeDegLng = gridSizeMeters / (111320 * Math.cos(avgLat * Math.PI / 180));
        
        // Вычисляем размеры зоны
        const zoneWidth = ne.lng - sw.lng;
        const zoneHeight = ne.lat - sw.lat;
        
        // Вычисляем количество полных квадратов, которые помещаются в зону
        const cols = Math.floor(zoneWidth / sizeDegLng);
        const rows = Math.floor(zoneHeight / sizeDegLat);
        
        if (cols === 0 || rows === 0) {
            alert('Размер выбранной зоны слишком мал для создания сетки. Увеличьте размер зоны или уменьшите размер ячейки сетки.');
            return;
        }
        
        // Вычисляем фактические размеры сетки (в градусах)
        const gridWidthDeg = cols * sizeDegLng;
        const gridHeightDeg = rows * sizeDegLat;
        
        // Начальная точка - северо-западный угол зоны
        const startLat = ne.lat;
        const startLng = sw.lng;
        
        // Вычисляем границы сетки (начинаем от северо-западного угла зоны)
        const gridNorth = startLat;
        const gridSouth = startLat - gridHeightDeg;
        const gridWest = startLng;
        const gridEast = startLng + gridWidthDeg;
        
        // Сохраняем границы сетки для позиционирования краевых меток
        this.gridBounds = L.latLngBounds(
            [gridSouth, gridWest],
            [gridNorth, gridEast]
        );
        
        // Генерируем квадраты
        const squares = [];
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Вычисляем координаты углов квадрата
                const north = startLat - (row * sizeDegLat);
                const south = north - sizeDegLat;
                const west = startLng + (col * sizeDegLng);
                const east = west + sizeDegLng;
                
                const squareBounds = L.latLngBounds(
                    [south, west],
                    [north, east]
                );
                
                // Проверяем, что квадрат полностью внутри выбранной зоны (если зона выбрана)
                if (this.selectedZone) {
                    // Проверяем, что все углы квадрата находятся внутри зоны
                    const nw = squareBounds.getNorthWest();
                    const ne = squareBounds.getNorthEast();
                    const se = squareBounds.getSouthEast();
                    const sw = squareBounds.getSouthWest();
                    
                    if (!bounds.contains(nw) || !bounds.contains(ne) || 
                        !bounds.contains(se) || !bounds.contains(sw)) {
                        continue; // Пропускаем квадрат, который выходит за границы зоны
                    }
                }
                
                // Центр квадрата
                const squareCenter = squareBounds.getCenter();
                
                const square = {
                    row: row,
                    col: col,
                    center: squareCenter,
                    bounds: squareBounds,
                    name: this.getSquareName(row, col)
                };
                
                squares.push(square);
                
                // Создаем полигон для квадрата
                const polygon = L.polygon([
                    squareBounds.getNorthWest(),
                    squareBounds.getNorthEast(),
                    squareBounds.getSouthEast(),
                    squareBounds.getSouthWest()
                ], {
                    color: this.gridColor,
                    weight: this.gridWeight,
                    fill: false,
                    interactive: false,
                    pane: 'overlayPane'
                });
                
                polygon.addTo(this.map);
                square.polygon = polygon;
                
                // Добавляем улитку только для квадрата A2
                if (square.name === 'A2') {
                    this.drawSnail(square);
                }
                // Добавляем метку для квадрата (для A1 - масштаб, для остальных - название)
                this.drawSquareLabel(square);
            }
        }
        
        this.gridSquares = squares;
        this.gridLayer = L.layerGroup(); // Группа для хранения всех элементов сетки
        
        // Добавляем краевые подписи (буквы слева, цифры сверху/снизу)
        this.addEdgeLabels(squares);
        
        // Скрываем зону после создания сетки
        if (this.zoneRectangle) {
            this.map.removeLayer(this.zoneRectangle);
            this.zoneRectangle = null;
        }
        
        // Не обновляем при изменении масштаба - метки используют географические координаты и не должны съезжать
    }
    
    addEdgeLabels(squares) {
        if (squares.length === 0 || !this.gridBounds) return;
        
        // Удаляем старые метки
        if (this.edgeLabels) {
            this.edgeLabels.forEach(label => {
                this.map.removeLayer(label);
            });
            this.edgeLabels = [];
        }
        
        // Находим уникальные строки и столбцы
        const rows = [...new Set(squares.map(s => s.row))].sort((a, b) => a - b);
        const cols = [...new Set(squares.map(s => s.col))].sort((a, b) => a - b);
        
        // Вычисляем смещение меток от края сетки на основе размера сетки
        const sizeDegLat = this.gridSize / 111320;
        const centerLat = this.gridBounds.getCenter().lat;
        const sizeDegLng = this.gridSize / (111320 * Math.cos(centerLat * Math.PI / 180));
        // Смещаем метки на 8% от размера квадрата, чтобы они не наезжали на сетку
        const offsetLat = sizeDegLat * 0.08;
        const offsetLng = sizeDegLng * 0.08;
        
        // Добавляем буквенные метки слева
        if (this.showEdgeLeft) {
            rows.forEach(row => {
                const square = squares.find(s => s.row === row && s.col === cols[0]);
                if (square) {
                    const normalizedRow = row >= 0 ? row : 26 + (row % 26);
                    const letter = String.fromCharCode(65 + (normalizedRow % 26));
                    
                    const label = L.divIcon({
                        className: 'edge-label-left',
                        html: `<div style="
                            background: transparent;
                            padding: 0;
                            font-size: 12px;
                            font-weight: bold;
                            color: white;
                            pointer-events: none;
                            user-select: none;
                            text-align: center;
                            white-space: nowrap;
                        ">${letter}</div>`,
                        iconSize: [20, 16],
                        iconAnchor: [20, 8]
                    });
                    
                    const marker = L.marker([square.center.lat, this.gridBounds.getWest() - offsetLng], {
                        icon: label,
                        interactive: false,
                        zIndexOffset: 2000
                    });
                    marker.addTo(this.map);
                    this.edgeLabels.push(marker);
                }
            });
        }
        
        // Добавляем буквенные метки справа
        if (this.showEdgeRight) {
            rows.forEach(row => {
                const square = squares.find(s => s.row === row && s.col === cols[cols.length - 1]);
                if (square) {
                    const normalizedRow = row >= 0 ? row : 26 + (row % 26);
                    const letter = String.fromCharCode(65 + (normalizedRow % 26));
                    
                    const label = L.divIcon({
                        className: 'edge-label-right',
                        html: `<div style="
                            background: transparent;
                            padding: 0;
                            font-size: 12px;
                            font-weight: bold;
                            color: white;
                            pointer-events: none;
                            user-select: none;
                            text-align: center;
                            white-space: nowrap;
                        ">${letter}</div>`,
                        iconSize: [20, 16],
                        iconAnchor: [0, 8]
                    });
                    
                    const marker = L.marker([square.center.lat, this.gridBounds.getEast() + offsetLng], {
                        icon: label,
                        interactive: false,
                        zIndexOffset: 2000
                    });
                    marker.addTo(this.map);
                    this.edgeLabels.push(marker);
                }
            });
        }
        
        // Добавляем цифровые метки сверху
        if (this.showEdgeTop) {
            cols.forEach(col => {
                const square = squares.find(s => s.col === col && s.row === rows[0]);
                if (square) {
                    const normalizedCol = col >= 0 ? col : Math.abs(col);
                    const number = normalizedCol + 1;
                    
                    const label = L.divIcon({
                        className: 'edge-label-top',
                        html: `<div style="
                            background: transparent;
                            padding: 0;
                            font-size: 12px;
                            font-weight: bold;
                            color: white;
                            pointer-events: none;
                            user-select: none;
                            text-align: center;
                            white-space: nowrap;
                        ">${number}</div>`,
                        iconSize: [20, 16],
                        iconAnchor: [10, 16]
                    });
                    
                    const marker = L.marker([this.gridBounds.getNorth() + offsetLat, square.center.lng], {
                        icon: label,
                        interactive: false,
                        zIndexOffset: 2000
                    });
                    marker.addTo(this.map);
                    this.edgeLabels.push(marker);
                }
            });
        }
        
        // Добавляем цифровые метки снизу
        if (this.showEdgeBottom) {
            cols.forEach(col => {
                const square = squares.find(s => s.col === col && s.row === rows[rows.length - 1]);
                if (square) {
                    const normalizedCol = col >= 0 ? col : Math.abs(col);
                    const number = normalizedCol + 1;
                    
                    const label = L.divIcon({
                        className: 'edge-label-bottom',
                        html: `<div style="
                            background: transparent;
                            padding: 0;
                            font-size: 12px;
                            font-weight: bold;
                            color: white;
                            pointer-events: none;
                            user-select: none;
                            text-align: center;
                            white-space: nowrap;
                        ">${number}</div>`,
                        iconSize: [20, 16],
                        iconAnchor: [10, 0]
                    });
                    
                    const marker = L.marker([this.gridBounds.getSouth() - offsetLat, square.center.lng], {
                        icon: label,
                        interactive: false,
                        zIndexOffset: 2000
                    });
                    marker.addTo(this.map);
                    this.edgeLabels.push(marker);
                }
            });
        }
    }
    
    drawSnail(square) {
        // Улитка показывается только в квадрате A2
        if (square.name !== 'A2') {
            // Удаляем улитку если она была создана для другого квадрата
            if (square.snailLines) {
                square.snailLines.forEach(line => {
                    if (this.map.hasLayer(line)) {
                        this.map.removeLayer(line);
                    }
                });
            }
            if (square.snailLabels) {
                square.snailLabels.forEach(label => {
                    if (this.map.hasLayer(label)) {
                        this.map.removeLayer(label);
                    }
                });
            }
            return;
        }
        
        // Удаляем старые элементы если они есть
        if (square.snailLines) {
            square.snailLines.forEach(line => {
                if (this.map.hasLayer(line)) {
                    this.map.removeLayer(line);
                }
            });
        }
        if (square.snailLabels) {
            square.snailLabels.forEach(label => {
                if (this.map.hasLayer(label)) {
                    this.map.removeLayer(label);
                }
            });
        }
        
        // Создаем новые элементы
        square.snailLines = [];
        square.snailLabels = [];
        
        const bounds = square.bounds;
        const center = square.center;
        
        const nw = bounds.getNorthWest();
        const ne = bounds.getNorthEast();
        const se = bounds.getSouthEast();
        const sw = bounds.getSouthWest();
        
        // Рисуем крест - вертикальная и горизонтальная линии через центр
        // Вертикальная линия (север-юг)
        const verticalLine = L.polyline([
            [bounds.getNorth(), center.lng],
            [bounds.getSouth(), center.lng]
        ], {
            color: this.gridColor,
            weight: this.gridWeight,
            opacity: 0.8,
            interactive: false,
            pane: 'overlayPane'
        });
        verticalLine.addTo(this.map);
        square.snailLines.push(verticalLine);
        
        // Горизонтальная линия (запад-восток)
        const horizontalLine = L.polyline([
            [center.lat, bounds.getWest()],
            [center.lat, bounds.getEast()]
        ], {
            color: this.gridColor,
            weight: this.gridWeight,
            opacity: 0.8,
            interactive: false,
            pane: 'overlayPane'
        });
        horizontalLine.addTo(this.map);
        square.snailLines.push(horizontalLine);
        
        // Разделяем квадрат на 4 части с нумерацией:
        // 1 2
        // 4 3
        // (левый верх - 1, правый верх - 2, правый низ - 3, левый низ - 4)
        
        // Добавляем метки с номерами в центре каждой части (без фона)
        const parts = [
            { number: 1, center: L.latLng((nw.lat + center.lat) / 2, (nw.lng + center.lng) / 2) },
            { number: 2, center: L.latLng((ne.lat + center.lat) / 2, (ne.lng + center.lng) / 2) },
            { number: 3, center: L.latLng((se.lat + center.lat) / 2, (se.lng + center.lng) / 2) },
            { number: 4, center: L.latLng((sw.lat + center.lat) / 2, (sw.lng + center.lng) / 2) }
        ];
        
            parts.forEach(part => {
                const label = L.divIcon({
                    className: 'snail-label-div',
                    html: `<div style="
                        background: transparent;
                        border: none;
                        padding: 0;
                        font-size: 16px;
                        font-weight: bold;
                        color: white;
                        pointer-events: none;
                        user-select: none;
                        text-align: center;
                        line-height: 1;
                        font-family: Arial, sans-serif;
                    ">${part.number}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                
                const labelMarker = L.marker(part.center, {
                    icon: label,
                    interactive: false,
                    zIndexOffset: 1001
                });
                
                labelMarker.addTo(this.map);
                square.snailLabels.push(labelMarker);
            });
    }
    
    drawSquareLabel(square) {
        // Для квадрата A1 показываем масштаб (размер сетки в метрах) по центру в виде <100 м>
        // Для остальных квадратов - название в правом нижнем углу
        const isA1 = square.name === 'A1';
        const labelText = isA1 ? `&lt;${this.gridSize} м&gt;` : square.name;
        
        if (!square.label) {
            const bounds = square.bounds;
            const se = bounds.getSouthEast();
            
            // Смещаем немного внутрь от угла (для всех кроме A1)
            const sizeDegLat = this.gridSize / 111320;
            const sizeDegLng = this.gridSize / (111320 * Math.cos(bounds.getCenter().lat * Math.PI / 180));
            const offsetLat = sizeDegLat * 0.05; // 5% от размера квадрата
            const offsetLng = sizeDegLng * 0.05;
            
            // Позиция метки: по центру квадрата для A1, в правом нижнем углу для остальных
            const labelPos = isA1
                ? square.center
                : L.latLng(se.lat + offsetLat, se.lng - offsetLng);
            
            const label = L.divIcon({
                className: 'square-label-div',
                html: `<div style="
                    background: transparent;
                    padding: 0;
                    font-size: 11px;
                    font-weight: bold;
                    color: white;
                    pointer-events: none;
                    user-select: none;
                    white-space: nowrap;
                    text-align: ${isA1 ? 'center' : 'right'};
                ">${labelText}</div>`,
                iconSize: isA1 ? [80, 18] : [60, 16],
                iconAnchor: isA1 ? [40, 9] : [60, 16] // A1 - центр, остальные - правый нижний угол
            });
            
            const marker = L.marker(labelPos, {
                icon: label,
                interactive: false,
                zIndexOffset: 1000
            });
            
            square.label = marker;
        } else {
            // Обновляем текст метки если она уже существует
            const labelDiv = square.label.options.icon.options.html.match(/<div[^>]*>(.*?)<\/div>/);
            if (labelDiv) {
                square.label.options.icon.options.html = square.label.options.icon.options.html.replace(
                    />[^<]+</,
                    `>${labelText}<`
                );
            }
        }
        
        // Для квадрата A2 никогда не показываем название
        if (square.name === 'A2') {
            if (this.map.hasLayer(square.label)) {
                this.map.removeLayer(square.label);
            }
            return;
        }
        
        if (this.showSquareNames) {
            if (!this.map.hasLayer(square.label)) {
                square.label.addTo(this.map);
            }
        } else {
            if (this.map.hasLayer(square.label)) {
                this.map.removeLayer(square.label);
            }
        }
    }
    
    updateGridDisplay() {
        // Обновляем отображение названий квадратов
        if (this.gridSquares && this.gridSquares.length > 0) {
            this.gridSquares.forEach(square => {
                if (square.label) {
                    // Для квадрата A2 всегда скрываем название
                    if (square.name === 'A2') {
                        if (this.map.hasLayer(square.label)) {
                            this.map.removeLayer(square.label);
                        }
                        return;
                    }
                    
                    if (this.showSquareNames) {
                        if (!this.map.hasLayer(square.label)) {
                            square.label.addTo(this.map);
                        }
                    } else {
                        if (this.map.hasLayer(square.label)) {
                            this.map.removeLayer(square.label);
                        }
                    }
                }
            });
        }
    }
    
    updateGridStyle() {
        // Обновляем цвет и толщину существующей сетки
        if (this.gridSquares && this.gridSquares.length > 0) {
            this.gridSquares.forEach(square => {
                if (square.polygon) {
                    square.polygon.setStyle({
                        color: this.gridColor,
                        weight: this.gridWeight
                    });
                }
            });
        }
    }
    
    updateEdgeLabels() {
        // Удаляем старые краевые метки
        if (this.edgeLabels) {
            this.edgeLabels.forEach(label => {
                this.map.removeLayer(label);
            });
            this.edgeLabels = [];
        }
        
        // Создаем новые краевые метки
        if (this.gridSquares.length > 0) {
            this.addEdgeLabels(this.gridSquares);
        }
    }
    
    updatePreviewFontSizes() {
        if (!this.printPreviewMap) return;
        
        const zoom = this.printPreviewMap.getZoom();
        // Базовый размер шрифта при масштабе 13, масштабируется пропорционально
        const baseZoom = 13;
        // Уменьшены базовые размеры для лучшего отображения в предпросмотре
        const baseFontSize = 8; // для названий квадратов
        const baseEdgeFontSize = 9; // для краевых меток
        const baseSnailFontSize = 10; // для цифр в A2
        
        // Более плавное масштабирование: используем линейное масштабирование вместо экспоненциального
        // Каждый уровень зума увеличивает шрифт на 10% вместо удвоения
        const zoomDiff = zoom - baseZoom;
        const scale = 1 + (zoomDiff * 0.1); // +10% за каждый уровень зума
        
        // Рассчитываем размеры с ограничениями
        const fontSize = Math.max(6, Math.min(14, baseFontSize * scale)); // минимум 6px, максимум 14px
        const edgeFontSize = Math.max(6, Math.min(16, baseEdgeFontSize * scale)); // минимум 6px, максимум 16px
        const snailFontSize = Math.max(8, Math.min(18, baseSnailFontSize * scale)); // минимум 8px, максимум 18px
        
        // Обновляем размер шрифта всех текстовых меток на карте предпросмотра
        const mapContainer = this.printPreviewMap.getContainer();
        if (mapContainer) {
            // Обновляем названия квадратов
            const squareLabels = mapContainer.querySelectorAll('.square-label-div div');
            squareLabels.forEach(label => {
                label.style.fontSize = fontSize + 'px';
            });
            
            // Обновляем краевые метки
            const edgeLabels = mapContainer.querySelectorAll('.edge-label-left div, .edge-label-right div, .edge-label-top div, .edge-label-bottom div');
            edgeLabels.forEach(label => {
                label.style.fontSize = edgeFontSize + 'px';
            });
            
            // Обновляем цифры в A2
            const snailLabels = mapContainer.querySelectorAll('.snail-label-div div');
            snailLabels.forEach(label => {
                label.style.fontSize = snailFontSize + 'px';
            });
        }
    }
    
    addEdgeLabelsToPreview(squares, gridBounds) {
        if (!this.printPreviewMap || !gridBounds || !squares || squares.length === 0) return;
        
        const rows = [...new Set(squares.map(s => s.row))].sort((a, b) => a - b);
        const cols = [...new Set(squares.map(s => s.col))].sort((a, b) => a - b);
        
        // Вычисляем смещение меток от края сетки на основе размера сетки
        const sizeDegLat = this.gridSize / 111320;
        const centerLat = gridBounds.getCenter().lat;
        const sizeDegLng = this.gridSize / (111320 * Math.cos(centerLat * Math.PI / 180));
        // Смещаем метки на 8% от размера квадрата, чтобы они не наезжали на сетку
        const offsetLat = sizeDegLat * 0.08;
        const offsetLng = sizeDegLng * 0.08;
        
        // Буквы слева
        if (this.showEdgeLeft) {
            rows.forEach(row => {
                const square = squares.find(s => s.row === row && s.col === cols[0]);
                if (!square) return;
                const normalizedRow = row >= 0 ? row : 26 + (row % 26);
                const letter = String.fromCharCode(65 + (normalizedRow % 26));
                
                const label = L.divIcon({
                    className: 'edge-label-left',
                    html: `<div style="
                        background: transparent;
                        padding: 0;
                        font-size: 12px;
                        font-weight: bold;
                        color: white;
                        pointer-events: none;
                        user-select: none;
                        text-align: center;
                        white-space: nowrap;
                    ">${letter}</div>`,
                    iconSize: [20, 16],
                    iconAnchor: [20, 8]
                });
                
                L.marker([square.center.lat, gridBounds.getWest() - offsetLng], {
                    icon: label,
                    interactive: false,
                    zIndexOffset: 2000
                }).addTo(this.printPreviewMap);
            });
        }
        
        // Буквы справа
        if (this.showEdgeRight) {
            rows.forEach(row => {
                const square = squares.find(s => s.row === row && s.col === cols[cols.length - 1]);
                if (!square) return;
                const normalizedRow = row >= 0 ? row : 26 + (row % 26);
                const letter = String.fromCharCode(65 + (normalizedRow % 26));
                
                const label = L.divIcon({
                    className: 'edge-label-right',
                    html: `<div style="
                        background: transparent;
                        padding: 0;
                        font-size: 12px;
                        font-weight: bold;
                        color: white;
                        pointer-events: none;
                        user-select: none;
                        text-align: center;
                        white-space: nowrap;
                    ">${letter}</div>`,
                    iconSize: [20, 16],
                    iconAnchor: [0, 8]
                });
                
                L.marker([square.center.lat, gridBounds.getEast() + offsetLng], {
                    icon: label,
                    interactive: false,
                    zIndexOffset: 2000
                }).addTo(this.printPreviewMap);
            });
        }
        
        // Цифры сверху
        if (this.showEdgeTop) {
            cols.forEach(col => {
                const square = squares.find(s => s.col === col && s.row === rows[0]);
                if (!square) return;
                const normalizedCol = col >= 0 ? col : Math.abs(col);
                const number = normalizedCol + 1;
                
                const label = L.divIcon({
                    className: 'edge-label-top',
                    html: `<div style="
                        background: transparent;
                        padding: 0;
                        font-size: 12px;
                        font-weight: bold;
                        color: white;
                        pointer-events: none;
                        user-select: none;
                        text-align: center;
                        white-space: nowrap;
                    ">${number}</div>`,
                    iconSize: [20, 16],
                    iconAnchor: [10, 16]
                });
                
                L.marker([gridBounds.getNorth() + offsetLat, square.center.lng], {
                    icon: label,
                    interactive: false,
                    zIndexOffset: 2000
                }).addTo(this.printPreviewMap);
            });
        }
        
        // Цифры снизу
        if (this.showEdgeBottom) {
            cols.forEach(col => {
                const square = squares.find(s => s.col === col && s.row === rows[rows.length - 1]);
                if (!square) return;
                const normalizedCol = col >= 0 ? col : Math.abs(col);
                const number = normalizedCol + 1;
                
                const label = L.divIcon({
                    className: 'edge-label-bottom',
                    html: `<div style="
                        background: transparent;
                        padding: 0;
                        font-size: 12px;
                        font-weight: bold;
                        color: white;
                        pointer-events: none;
                        user-select: none;
                        text-align: center;
                        white-space: nowrap;
                    ">${number}</div>`,
                    iconSize: [20, 16],
                    iconAnchor: [10, 0]
                });
                
                L.marker([gridBounds.getSouth() - offsetLat, square.center.lng], {
                    icon: label,
                    interactive: false,
                    zIndexOffset: 2000
                }).addTo(this.printPreviewMap);
            });
        }
    }
    
    getSquareName(row, col) {
        // Буквенное обозначение для строк (вертикально, слева): A, B, C...
        // row может быть отрицательным, поэтому нормализуем
        const normalizedRow = row >= 0 ? row : 26 + (row % 26);
        const letter = String.fromCharCode(65 + (normalizedRow % 26));
        
        // Цифровое обозначение для столбцов (горизонтально, сверху/снизу): 1, 2, 3...
        // col может быть отрицательным, нормализуем
        const normalizedCol = col >= 0 ? col : Math.abs(col);
        const number = normalizedCol + 1;
        
        return `${letter}${number}`;
    }
    
    getDistance(point1, lat2, lng2) {
        const R = 6371000; // Радиус Земли в метрах
        const dLat = (lat2 - point1.lat) * Math.PI / 180;
        const dLng = (lng2 - point1.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(point1.lat * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    
    clearGrid() {
        if (this.gridSquares.length > 0) {
            this.gridSquares.forEach(square => {
                if (square.polygon) {
                    this.map.removeLayer(square.polygon);
                }
                if (square.snailLines) {
                    square.snailLines.forEach(line => {
                        if (this.map.hasLayer(line)) {
                            this.map.removeLayer(line);
                        }
                    });
                }
                if (square.snailLabels) {
                    square.snailLabels.forEach(label => {
                        if (this.map.hasLayer(label)) {
                            this.map.removeLayer(label);
                        }
                    });
                }
                if (square.label) {
                    this.map.removeLayer(square.label);
                }
            });
        }
        
        // Удаляем краевые метки
        if (this.edgeLabels) {
            this.edgeLabels.forEach(label => {
                this.map.removeLayer(label);
            });
            this.edgeLabels = [];
        }
        
        if (this.gridLayer) {
            this.map.removeLayer(this.gridLayer);
        }
        
        this.gridSquares = [];
        this.gridLayer = null;
        this.gridBounds = null;
        this.map.off('zoomend moveend');
    }
    
    addMarker(latlng) {
        const markerType = document.getElementById('marker-type').value;
        const description = document.getElementById('marker-description').value || '';
        
        const iconColors = {
            'default': '#3388ff',
            'warning': '#ffc107',
            'danger': '#dc3545',
            'info': '#17a2b8',
            'checkpoint': '#28a745'
        };
        
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${iconColors[markerType]}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        const marker = L.marker(latlng, { 
            icon: icon,
            draggable: true // Делаем метку перетаскиваемой
        });
        marker.addTo(this.map);
        
        const markerData = {
            id: Date.now(),
            latlng: latlng,
            type: markerType,
            description: description,
            marker: marker
        };
        
        this.markers.push(markerData);
        
        // Обработчик перемещения метки
        marker.on('dragend', (e) => {
            const newLatLng = marker.getLatLng();
            markerData.latlng = newLatLng;
            this.updateMarkersList();
        });
        
        // Обработчик клика для редактирования описания
        marker.on('click', (e) => {
            if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
                // Ctrl+Click открывает редактор описания
                this.editMarkerDescription(markerData.id);
            }
        });
        
        this.updateMarkersList();
        
        // Добавляем popup с описанием
        this.updateMarkerPopup(markerData);
    }
    
    getMarkerTypeName(type) {
        const names = {
            'default': 'Стандартная',
            'warning': 'Предупреждение',
            'danger': 'Опасность',
            'info': 'Информация',
            'checkpoint': 'КПП'
        };
        return names[type] || type;
    }
    
    removeMarker(id) {
        const index = this.markers.findIndex(m => m.id === id);
        if (index !== -1) {
            this.map.removeLayer(this.markers[index].marker);
            this.markers.splice(index, 1);
            this.updateMarkersList();
        }
    }
    
    updateMarkersList() {
        const list = document.getElementById('markers-list');
        if (this.markers.length === 0) {
            list.innerHTML = '<div class="empty-state">Метки не добавлены</div>';
            return;
        }
        
        list.innerHTML = this.markers.map(m => `
            <div class="marker-item">
                <div class="marker-item-info">
                    <div class="marker-item-type">${this.getMarkerTypeName(m.type)}</div>
                    <div class="marker-item-desc">${m.description || 'Без описания'}</div>
                    <div class="marker-item-coords" style="font-size: 0.75rem; color: #999; margin-top: 0.2rem;">
                        ${m.latlng.lat.toFixed(6)}, ${m.latlng.lng.toFixed(6)}
                    </div>
                </div>
                <div class="marker-item-actions">
                    <button class="marker-item-btn marker-edit-btn" onclick="app.editMarkerDescription(${m.id})" title="Редактировать описание">✏️</button>
                    <button class="marker-item-btn marker-remove-btn" onclick="app.removeMarker(${m.id})" title="Удалить">🗑️</button>
                </div>
            </div>
        `).join('');
    }
    
    updateMarkerPopup(markerData) {
        const marker = markerData.marker;
        const popupContent = markerData.description 
            ? `<strong>${this.getMarkerTypeName(markerData.type)}</strong><br>${markerData.description}<br><small style="color: #999;">Ctrl+Click для редактирования</small>`
            : `<strong>${this.getMarkerTypeName(markerData.type)}</strong><br><small style="color: #999;">Ctrl+Click для редактирования</small>`;
        marker.bindPopup(popupContent);
    }
    
    editMarkerDescription(id) {
        const markerData = this.markers.find(m => m.id === id);
        if (!markerData) return;
        
        const currentDescription = markerData.description || '';
        const newDescription = prompt('Введите описание метки:', currentDescription);
        
        if (newDescription !== null) { // null означает, что пользователь нажал "Отмена"
            markerData.description = newDescription;
            this.updateMarkerPopup(markerData);
            this.updateMarkersList();
        }
    }
    
    // Сохранение проекта
    saveProject() {
        const projectName = document.getElementById('project-name').value.trim();
        if (!projectName) {
            alert('Введите название проекта');
            return;
        }
        
        // Проверяем, есть ли данные для сохранения
        if (this.markers.length === 0 && this.gridSquares.length === 0) {
            alert('Нет данных для сохранения. Добавьте метки или создайте сетку.');
            return;
        }
        
        // Собираем данные проекта
        const projectData = {
            id: Date.now().toString(),
            name: projectName,
            date: new Date().toLocaleString('ru-RU'),
            timestamp: Date.now(),
            data: {
                // Метки
                markers: this.markers.map(m => ({
                    latlng: { lat: m.latlng.lat, lng: m.latlng.lng },
                    type: m.type,
                    description: m.description
                })),
                
                // Сетка
                gridSquares: this.gridSquares.map(square => ({
                    name: square.name,
                    row: square.row,
                    col: square.col,
                    center: { lat: square.center.lat, lng: square.center.lng },
                    bounds: {
                        north: square.bounds.getNorth(),
                        south: square.bounds.getSouth(),
                        east: square.bounds.getEast(),
                        west: square.bounds.getWest()
                    }
                })),
                gridSize: this.gridSize,
                gridColor: this.gridColor,
                gridWeight: this.gridWeight,
                gridBounds: this.gridBounds ? {
                    north: this.gridBounds.getNorth(),
                    south: this.gridBounds.getSouth(),
                    east: this.gridBounds.getEast(),
                    west: this.gridBounds.getWest()
                } : null,
                
                // Выбранная зона
                selectedZone: this.selectedZone ? {
                    north: this.selectedZone.getNorth(),
                    south: this.selectedZone.getSouth(),
                    east: this.selectedZone.getEast(),
                    west: this.selectedZone.getWest()
                } : null,
                
                // Настройки отображения
                showSquareNames: this.showSquareNames,
                showEdgeLeft: this.showEdgeLeft,
                showEdgeRight: this.showEdgeRight,
                showEdgeTop: this.showEdgeTop,
                showEdgeBottom: this.showEdgeBottom,
                
                // Настройки карты
                mapType: this.currentMapType,
                mapCenter: this.map.getCenter(),
                mapZoom: this.map.getZoom()
            }
        };
        
        // Сохраняем в localStorage
        const savedProjects = this.getSavedProjects();
        savedProjects.push(projectData);
        localStorage.setItem('msrv_map_projects', JSON.stringify(savedProjects));
        
        // Обновляем список проектов
        this.updateProjectsList();
        
        // Очищаем поле названия
        document.getElementById('project-name').value = '';
        
        alert('Проект "' + projectName + '" успешно сохранен!');
    }
    
    // Получение сохраненных проектов
    getSavedProjects() {
        try {
            const projects = localStorage.getItem('msrv_map_projects');
            return projects ? JSON.parse(projects) : [];
        } catch (e) {
            console.error('Ошибка при чтении проектов:', e);
            return [];
        }
    }
    
    // Обновление списка проектов
    updateProjectsList() {
        const projects = this.getSavedProjects();
        const list = document.getElementById('projects-list');
        
        if (!list) return; // Проверяем, существует ли элемент
        
        if (projects.length === 0) {
            list.innerHTML = '<div class="empty-state">Проекты не сохранены</div>';
            return;
        }
        
        // Сортируем по дате (новые сверху)
        projects.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        list.innerHTML = projects.map(project => `
            <div class="project-item">
                <div class="project-item-info">
                    <div class="project-item-name">${project.name}</div>
                    <div class="project-item-date">${project.date}</div>
                </div>
                <div class="project-item-actions">
                    <button class="project-load-btn" onclick="app.loadProject('${project.id}')" title="Загрузить">📂</button>
                    <button class="project-delete-btn" onclick="app.deleteProject('${project.id}')" title="Удалить">🗑️</button>
                </div>
            </div>
        `).join('');
    }
    
    // Загрузка проекта
    loadProject(projectId) {
        const projects = this.getSavedProjects();
        const project = projects.find(p => p.id === projectId);
        
        if (!project) {
            alert('Проект не найден');
            return;
        }
        
        if (!confirm(`Загрузить проект "${project.name}"? Текущие данные будут заменены.`)) {
            return;
        }
        
        try {
            // Очищаем текущие данные
            this.clearAll();
            
            const data = project.data;
            
            // Восстанавливаем настройки карты
            if (data.mapType && data.mapType !== this.currentMapType) {
                this.loadMapType(data.mapType);
                this.currentMapType = data.mapType;
            }
            
            // Восстанавливаем позицию карты
            if (data.mapCenter && data.mapZoom) {
                setTimeout(() => {
                    this.map.setView([data.mapCenter.lat, data.mapCenter.lng], data.mapZoom);
                }, 100);
            }
            
            // Восстанавливаем выбранную зону
            if (data.selectedZone) {
                const bounds = L.latLngBounds(
                    [data.selectedZone.south, data.selectedZone.west],
                    [data.selectedZone.north, data.selectedZone.east]
                );
                this.selectedZone = bounds;
                this.zoneRectangle = L.rectangle(bounds, {
                    color: '#3388ff',
                    weight: 3,
                    fill: true,
                    fillOpacity: 0.1,
                    fillColor: '#3388ff',
                    interactive: false
                }).addTo(this.map);
            }
            
            // Восстанавливаем сетку
            if (data.gridSquares && data.gridSquares.length > 0) {
                this.gridSize = data.gridSize || 100;
                this.gridColor = data.gridColor || '#667eea';
                this.gridWeight = data.gridWeight || 2;
                this.showSquareNames = data.showSquareNames !== undefined ? data.showSquareNames : true;
                this.showEdgeLeft = data.showEdgeLeft !== undefined ? data.showEdgeLeft : true;
                this.showEdgeRight = data.showEdgeRight !== undefined ? data.showEdgeRight : false;
                this.showEdgeTop = data.showEdgeTop !== undefined ? data.showEdgeTop : true;
                this.showEdgeBottom = data.showEdgeBottom !== undefined ? data.showEdgeBottom : true;
                
                // Обновляем UI
                document.getElementById('grid-size').value = this.gridSize;
                document.getElementById('grid-color').value = this.gridColor;
                document.getElementById('grid-weight').value = this.gridWeight;
                document.getElementById('show-square-names').checked = this.showSquareNames;
                document.getElementById('show-edge-left').checked = this.showEdgeLeft;
                document.getElementById('show-edge-right').checked = this.showEdgeRight;
                document.getElementById('show-edge-top').checked = this.showEdgeTop;
                document.getElementById('show-edge-bottom').checked = this.showEdgeBottom;
                
                // Восстанавливаем границы сетки
                if (data.gridBounds) {
                    this.gridBounds = L.latLngBounds(
                        [data.gridBounds.south, data.gridBounds.west],
                        [data.gridBounds.north, data.gridBounds.east]
                    );
                }
                
                // Восстанавливаем квадраты
                const squares = data.gridSquares.map(squareData => {
                    const bounds = L.latLngBounds(
                        [squareData.bounds.south, squareData.bounds.west],
                        [squareData.bounds.north, squareData.bounds.east]
                    );
                    
                    return {
                        name: squareData.name,
                        row: squareData.row,
                        col: squareData.col,
                        center: L.latLng(squareData.center.lat, squareData.center.lng),
                        bounds: bounds,
                        polygon: null,
                        label: null,
                        snailLines: [],
                        snailLabels: []
                    };
                });
                
                this.gridSquares = squares;
                
                // Воссоздаем сетку на карте
                squares.forEach(square => {
                    const polygon = L.polygon([
                        square.bounds.getNorthWest(),
                        square.bounds.getNorthEast(),
                        square.bounds.getSouthEast(),
                        square.bounds.getSouthWest()
                    ], {
                        color: this.gridColor,
                        weight: this.gridWeight,
                        fill: false,
                        interactive: false
                    });
                    polygon.addTo(this.map);
                    square.polygon = polygon;
                    
                    // Добавляем улитку для A2
                    if (square.name === 'A2') {
                        this.drawSnail(square);
                    }
                    
                    // Добавляем метку квадрата
                    this.drawSquareLabel(square);
                });
                
                // Добавляем краевые метки
                this.addEdgeLabels(squares);
            }
            
            // Восстанавливаем метки
            if (data.markers && data.markers.length > 0) {
                data.markers.forEach(markerData => {
                    const latlng = L.latLng(markerData.latlng.lat, markerData.latlng.lng);
                    // Используем временное значение для типа, потом обновим
                    const tempType = markerData.type || 'default';
                    document.getElementById('marker-type').value = tempType;
                    document.getElementById('marker-description').value = markerData.description || '';
                    
                    this.addMarker(latlng);
                    
                    // Обновляем описание последней добавленной метки
                    if (this.markers.length > 0) {
                        const lastMarker = this.markers[this.markers.length - 1];
                        lastMarker.description = markerData.description || '';
                        lastMarker.type = markerData.type || 'default';
                        this.updateMarkerPopup(lastMarker);
                    }
                });
                
                // Очищаем временные поля
                document.getElementById('marker-type').value = 'default';
                document.getElementById('marker-description').value = '';
            }
            
            alert('Проект "' + project.name + '" успешно загружен!');
        } catch (error) {
            console.error('Ошибка при загрузке проекта:', error);
            alert('Ошибка при загрузке проекта: ' + error.message);
        }
    }
    
    // Удаление проекта
    deleteProject(projectId) {
        const projects = this.getSavedProjects();
        const project = projects.find(p => p.id === projectId);
        
        if (!project) {
            alert('Проект не найден');
            return;
        }
        
        if (!confirm(`Удалить проект "${project.name}"?`)) {
            return;
        }
        
        const filteredProjects = projects.filter(p => p.id !== projectId);
        localStorage.setItem('msrv_map_projects', JSON.stringify(filteredProjects));
        
        this.updateProjectsList();
    }
    
    async exportKMZ() {
        if (this.markers.length === 0 && this.gridSquares.length === 0) {
            alert('Нет данных для экспорта. Добавьте метки или создайте сетку.');
            return;
        }
        
        try {
            // Создаем KML контент
            const kmlContent = this.generateKML();
            
            // Создаем KMZ файл (это ZIP архив с KML файлом)
            const zip = new JSZip();
            zip.file('doc.kml', kmlContent);
            
            // Генерируем и скачиваем файл
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `map_export_${new Date().getTime()}.kmz`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert('KMZ файл успешно создан!');
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            alert('Ошибка при создании KMZ файла: ' + error.message);
        }
    }
    
    exportKML() {
        if (this.markers.length === 0 && this.gridSquares.length === 0) {
            alert('Нет данных для экспорта. Добавьте метки или создайте сетку.');
            return;
        }
        
        try {
            // Создаем KML контент
            const kmlContent = this.generateKML();
            
            // Создаем Blob с KML контентом
            const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `map_export_${new Date().getTime()}.kml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert('KML файл успешно создан!');
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            alert('Ошибка при создании KML файла: ' + error.message);
        }
    }
    
    generateKML() {
        const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
        const kmlHeader = '<kml xmlns="http://www.opengis.net/kml/2.2">';
        const documentStart = '<Document>';
        
        let placemarks = [];
        
        // Добавляем метки
        this.markers.forEach(m => {
            const placemark = `
    <Placemark>
        <name>${this.getMarkerTypeName(m.type)}</name>
        <description><![CDATA[${m.description || ''}]]></description>
        <Point>
            <coordinates>${m.latlng.lng},${m.latlng.lat},0</coordinates>
        </Point>
        <Style>
            <IconStyle>
                <color>${this.getKMLColor(m.type)}</color>
                <scale>1.0</scale>
            </IconStyle>
        </Style>
    </Placemark>`;
            placemarks.push(placemark);
        });
        
        // Добавляем сетку
        if (this.gridSquares.length > 0) {
            this.gridSquares.forEach(square => {
                const bounds = square.bounds;
                const coordinates = `
            ${bounds.getSouthWest().lng},${bounds.getSouthWest().lat},0
            ${bounds.getSouthEast().lng},${bounds.getSouthEast().lat},0
            ${bounds.getNorthEast().lng},${bounds.getNorthEast().lat},0
            ${bounds.getNorthWest().lng},${bounds.getNorthWest().lat},0
            ${bounds.getSouthWest().lng},${bounds.getSouthWest().lat},0`;
                
                // Добавляем полигон квадрата
                const placemark = `
    <Placemark>
        <name>${square.name}</name>
        <Polygon>
            <outerBoundaryIs>
                <LinearRing>
                    <coordinates>${coordinates}</coordinates>
                </LinearRing>
            </outerBoundaryIs>
        </Polygon>
        <Style>
            <LineStyle>
                <color>${this.getKMLColorFromHex(this.gridColor)}</color>
                <width>${this.gridWeight}</width>
            </LineStyle>
            <PolyStyle>
                <color>00000000</color>
            </PolyStyle>
        </Style>
    </Placemark>`;
                placemarks.push(placemark);
                
                // Добавляем текстовую метку для квадрата (кроме A2)
                if (square.name !== 'A2') {
                    const center = square.center;
                    const isA1 = square.name === 'A1';
                    const labelText = isA1 ? `<${this.gridSize} м>` : square.name;
                    
                    // Создаем текстовую метку в центре квадрата
                    const textPlacemark = `
    <Placemark>
        <name><![CDATA[${labelText}]]></name>
        <styleUrl>#textLabelStyle</styleUrl>
        <Point>
            <coordinates>${center.lng},${center.lat},0</coordinates>
        </Point>
        <Style>
            <IconStyle>
                <color>FFFFFFFF</color>
                <scale>0</scale>
            </IconStyle>
            <LabelStyle>
                <color>FFFFFFFF</color>
                <scale>0.4</scale>
            </LabelStyle>
        </Style>
    </Placemark>`;
                    placemarks.push(textPlacemark);
                }
                
                // Для A2 добавляем крест и цифры 1-4
                if (square.name === 'A2') {
                    const bounds = square.bounds;
                    const center = square.center;
                    const nw = bounds.getNorthWest();
                    const ne = bounds.getNorthEast();
                    const se = bounds.getSouthEast();
                    const sw = bounds.getSouthWest();
                    
                    // Крест - вертикальная линия
                    const verticalLine = `
    <Placemark>
        <name>A2 Cross Vertical</name>
        <LineString>
            <coordinates>${center.lng},${bounds.getNorth()},0 ${center.lng},${bounds.getSouth()},0</coordinates>
        </LineString>
        <Style>
            <LineStyle>
                <color>${this.getKMLColorFromHex(this.gridColor)}</color>
                <width>${this.gridWeight}</width>
            </LineStyle>
        </Style>
    </Placemark>`;
                    placemarks.push(verticalLine);
                    
                    // Крест - горизонтальная линия
                    const horizontalLine = `
    <Placemark>
        <name>A2 Cross Horizontal</name>
        <LineString>
            <coordinates>${bounds.getWest()},${center.lat},0 ${bounds.getEast()},${center.lat},0</coordinates>
        </LineString>
        <Style>
            <LineStyle>
                <color>${this.getKMLColorFromHex(this.gridColor)}</color>
                <width>${this.gridWeight}</width>
            </LineStyle>
        </Style>
    </Placemark>`;
                    placemarks.push(horizontalLine);
                    
                    // Цифры 1-4 в центре каждой четверти
                    // 1 - левый верхний угол
                    const part1Center = L.latLng((nw.lat + center.lat) / 2, (nw.lng + center.lng) / 2);
                    const label1 = `
    <Placemark>
        <name><![CDATA[1]]></name>
        <styleUrl>#textLabelStyle</styleUrl>
        <Point>
            <coordinates>${part1Center.lng},${part1Center.lat},0</coordinates>
        </Point>
        <Style>
            <IconStyle>
                <color>FFFFFFFF</color>
                <scale>0</scale>
            </IconStyle>
            <LabelStyle>
                <color>FFFFFFFF</color>
                <scale>0.4</scale>
            </LabelStyle>
        </Style>
    </Placemark>`;
                    placemarks.push(label1);
                    
                    // 2 - правый верхний угол
                    const part2Center = L.latLng((ne.lat + center.lat) / 2, (ne.lng + center.lng) / 2);
                    const label2 = `
    <Placemark>
        <name><![CDATA[2]]></name>
        <styleUrl>#textLabelStyle</styleUrl>
        <Point>
            <coordinates>${part2Center.lng},${part2Center.lat},0</coordinates>
        </Point>
        <Style>
            <IconStyle>
                <color>FFFFFFFF</color>
                <scale>0</scale>
            </IconStyle>
            <LabelStyle>
                <color>FFFFFFFF</color>
                <scale>0.4</scale>
            </LabelStyle>
        </Style>
    </Placemark>`;
                    placemarks.push(label2);
                    
                    // 3 - правый нижний угол
                    const part3Center = L.latLng((se.lat + center.lat) / 2, (se.lng + center.lng) / 2);
                    const label3 = `
    <Placemark>
        <name><![CDATA[3]]></name>
        <styleUrl>#textLabelStyle</styleUrl>
        <Point>
            <coordinates>${part3Center.lng},${part3Center.lat},0</coordinates>
        </Point>
        <Style>
            <IconStyle>
                <color>FFFFFFFF</color>
                <scale>0</scale>
            </IconStyle>
            <LabelStyle>
                <color>FFFFFFFF</color>
                <scale>0.4</scale>
            </LabelStyle>
        </Style>
    </Placemark>`;
                    placemarks.push(label3);
                    
                    // 4 - левый нижний угол
                    const part4Center = L.latLng((sw.lat + center.lat) / 2, (sw.lng + center.lng) / 2);
                    const label4 = `
    <Placemark>
        <name><![CDATA[4]]></name>
        <styleUrl>#textLabelStyle</styleUrl>
        <Point>
            <coordinates>${part4Center.lng},${part4Center.lat},0</coordinates>
        </Point>
        <Style>
            <IconStyle>
                <color>FFFFFFFF</color>
                <scale>0</scale>
            </IconStyle>
            <LabelStyle>
                <color>FFFFFFFF</color>
                <scale>0.4</scale>
            </LabelStyle>
        </Style>
    </Placemark>`;
                    placemarks.push(label4);
                }
            });
        }
        
        // Добавляем краевые метки
        if (this.edgeLabels && this.edgeLabels.length > 0 && this.gridBounds && this.gridSquares.length > 0) {
            const rows = [...new Set(this.gridSquares.map(s => s.row))].sort((a, b) => a - b);
            const cols = [...new Set(this.gridSquares.map(s => s.col))].sort((a, b) => a - b);
            
            // Вычисляем смещение меток от края сетки
            const sizeDegLat = this.gridSize / 111320;
            const centerLat = this.gridBounds.getCenter().lat;
            const sizeDegLng = this.gridSize / (111320 * Math.cos(centerLat * Math.PI / 180));
            const offsetLat = sizeDegLat * 0.08;
            const offsetLng = sizeDegLng * 0.08;
            
            // Буквы слева
            if (this.showEdgeLeft) {
                rows.forEach(row => {
                    const square = this.gridSquares.find(s => s.row === row && s.col === cols[0]);
                    if (square) {
                        const normalizedRow = row >= 0 ? row : 26 + (row % 26);
                        const letter = String.fromCharCode(65 + (normalizedRow % 26));
                        const lat = square.center.lat;
                        const lng = this.gridBounds.getWest() - offsetLng;
                        
                        const edgePlacemark = `
    <Placemark>
        <name><![CDATA[${letter}]]></name>
        <styleUrl>#edgeLabelStyle</styleUrl>
        <Point>
            <coordinates>${lng},${lat},0</coordinates>
        </Point>
        <Style>
            <IconStyle>
                <color>FFFFFFFF</color>
                <scale>0</scale>
            </IconStyle>
            <LabelStyle>
                <color>FFFFFFFF</color>
                <scale>0.4</scale>
            </LabelStyle>
        </Style>
    </Placemark>`;
                        placemarks.push(edgePlacemark);
                    }
                });
            }
            
            // Буквы справа
            if (this.showEdgeRight) {
                rows.forEach(row => {
                    const square = this.gridSquares.find(s => s.row === row && s.col === cols[cols.length - 1]);
                    if (square) {
                        const normalizedRow = row >= 0 ? row : 26 + (row % 26);
                        const letter = String.fromCharCode(65 + (normalizedRow % 26));
                        const lat = square.center.lat;
                        const lng = this.gridBounds.getEast() + offsetLng;
                        
                        const edgePlacemark = `
    <Placemark>
        <name><![CDATA[${letter}]]></name>
        <styleUrl>#edgeLabelStyle</styleUrl>
        <Point>
            <coordinates>${lng},${lat},0</coordinates>
        </Point>
        <Style>
            <IconStyle>
                <color>FFFFFFFF</color>
                <scale>0</scale>
            </IconStyle>
            <LabelStyle>
                <color>FFFFFFFF</color>
                <scale>0.4</scale>
            </LabelStyle>
        </Style>
    </Placemark>`;
                        placemarks.push(edgePlacemark);
                    }
                });
            }
            
            // Цифры сверху
            if (this.showEdgeTop) {
                cols.forEach(col => {
                    const square = this.gridSquares.find(s => s.col === col && s.row === rows[0]);
                    if (square) {
                        const normalizedCol = col >= 0 ? col : Math.abs(col);
                        const number = normalizedCol + 1;
                        const lat = this.gridBounds.getNorth() + offsetLat;
                        const lng = square.center.lng;
                        
                        const edgePlacemark = `
    <Placemark>
        <name><![CDATA[${number}]]></name>
        <styleUrl>#edgeLabelStyle</styleUrl>
        <Point>
            <coordinates>${lng},${lat},0</coordinates>
        </Point>
        <Style>
            <IconStyle>
                <color>FFFFFFFF</color>
                <scale>0</scale>
            </IconStyle>
            <LabelStyle>
                <color>FFFFFFFF</color>
                <scale>0.4</scale>
            </LabelStyle>
        </Style>
    </Placemark>`;
                        placemarks.push(edgePlacemark);
                    }
                });
            }
            
            // Цифры снизу
            if (this.showEdgeBottom) {
                cols.forEach(col => {
                    const square = this.gridSquares.find(s => s.col === col && s.row === rows[rows.length - 1]);
                    if (square) {
                        const normalizedCol = col >= 0 ? col : Math.abs(col);
                        const number = normalizedCol + 1;
                        const lat = this.gridBounds.getSouth() - offsetLat;
                        const lng = square.center.lng;
                        
                        const edgePlacemark = `
    <Placemark>
        <name><![CDATA[${number}]]></name>
        <styleUrl>#edgeLabelStyle</styleUrl>
        <Point>
            <coordinates>${lng},${lat},0</coordinates>
        </Point>
        <Style>
            <IconStyle>
                <color>FFFFFFFF</color>
                <scale>0</scale>
            </IconStyle>
            <LabelStyle>
                <color>FFFFFFFF</color>
                <scale>0.4</scale>
            </LabelStyle>
        </Style>
    </Placemark>`;
                        placemarks.push(edgePlacemark);
                    }
                });
            }
        }
        
        // Добавляем стили для текстовых меток
        const labelStyle = `
    <Style id="textLabelStyle">
        <LabelStyle>
            <color>FFFFFFFF</color>
            <scale>0.4</scale>
        </LabelStyle>
        <IconStyle>
            <scale>0</scale>
        </IconStyle>
    </Style>
    <Style id="edgeLabelStyle">
        <LabelStyle>
            <color>FFFFFFFF</color>
            <scale>0.4</scale>
        </LabelStyle>
        <IconStyle>
            <scale>0</scale>
        </IconStyle>
    </Style>`;
        
        const documentEnd = '</Document>';
        const kmlFooter = '</kml>';
        
        return xmlHeader + '\n' + kmlHeader + '\n' + documentStart + '\n' + 
               labelStyle + '\n' + placemarks.join('\n') + '\n' + documentEnd + '\n' + kmlFooter;
    }
    
    async importKMZ(file) {
        try {
            let kmlContent = '';
            const fileName = file.name.toLowerCase();
            
            // Определяем тип файла
            if (fileName.endsWith('.kmz')) {
                // KMZ - это ZIP архив, нужно распаковать
                const arrayBuffer = await file.arrayBuffer();
                const zip = await JSZip.loadAsync(arrayBuffer);
                
                // Ищем KML файл в архиве
                let kmlFile = null;
                zip.forEach((relativePath, file) => {
                    if (relativePath.endsWith('.kml') && !kmlFile) {
                        kmlFile = file;
                    }
                });
                
                if (!kmlFile) {
                    alert('В KMZ архиве не найден KML файл');
                    return;
                }
                
                kmlContent = await kmlFile.async('text');
            } else if (fileName.endsWith('.kml')) {
                // KML - просто текст
                kmlContent = await file.text();
            } else {
                alert('Неподдерживаемый формат файла');
                return;
            }
            
            // Парсим KML
            this.parseKML(kmlContent);
            
        } catch (error) {
            console.error('Ошибка при импорте:', error);
            alert('Ошибка при импорте файла: ' + error.message);
        }
    }
    
    parseKML(kmlContent) {
        try {
            // Создаем DOM парсер
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
            
            // Проверяем на ошибки парсинга
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('Ошибка парсинга XML: ' + parseError.textContent);
            }
            
            // Очищаем текущие данные (опционально - можно спросить у пользователя)
            if (confirm('Импортировать данные? Существующие метки и сетка будут удалены.')) {
                this.clearAll();
            } else {
                return;
            }
            
            // Парсим Placemarks
            const placemarks = xmlDoc.querySelectorAll('Placemark');
            
            // Сначала собираем все квадраты сетки
            const gridSquaresMap = new Map();
            
            placemarks.forEach(placemark => {
                const name = placemark.querySelector('name')?.textContent || '';
                const polygon = placemark.querySelector('Polygon');
                
                if (polygon) {
                    // Это полигон (квадрат сетки)
                    const coordsText = polygon.querySelector('coordinates')?.textContent || '';
                    const coordsLines = coordsText.trim().split('\n').filter(line => line.trim());
                    
                    if (coordsLines.length >= 4) {
                        // Парсим координаты углов
                        const points = coordsLines.map(line => {
                            const parts = line.trim().split(',');
                            return L.latLng(parseFloat(parts[1]), parseFloat(parts[0]));
                        });
                        
                        // Определяем границы квадрата
                        const bounds = L.latLngBounds(points);
                        
                        // Если это название квадрата сетки (например A1, B2)
                        if (/^[A-Z]\d+$/.test(name)) {
                            gridSquaresMap.set(name, bounds);
                            this.addGridSquareFromImport(bounds, name);
                        }
                    }
                }
            });
            
            // Теперь обрабатываем метки (Point), но игнорируем те, что являются подписями квадратов
            placemarks.forEach(placemark => {
                const name = placemark.querySelector('name')?.textContent || '';
                const description = placemark.querySelector('description')?.textContent || '';
                const point = placemark.querySelector('Point');
                
                if (point) {
                    const coordsText = point.querySelector('coordinates')?.textContent || '';
                    const coords = coordsText.trim().split(',');
                    if (coords.length >= 2) {
                        const lng = parseFloat(coords[0]);
                        const lat = parseFloat(coords[1]);
                        const pointLatLng = L.latLng(lat, lng);
                        
                        // Проверяем, не является ли это метка подписи квадрата сетки
                        let isGridLabel = false;
                        
                        // Проверка 1: название совпадает с названием квадрата (A1, B2, и т.д.)
                        if (/^[A-Z]\d+$/.test(name) && gridSquaresMap.has(name)) {
                            const squareBounds = gridSquaresMap.get(name);
                            // Проверяем, находится ли точка внутри квадрата
                            if (squareBounds.contains(pointLatLng)) {
                                isGridLabel = true;
                            }
                        }
                        
                        // Проверка 2: название содержит масштаб в формате <...м>
                        if (/^<.*м>$/.test(name)) {
                            // Проверяем, находится ли точка внутри какого-либо квадрата
                            for (const [squareName, squareBounds] of gridSquaresMap) {
                                if (squareBounds.contains(pointLatLng)) {
                                    isGridLabel = true;
                                    break;
                                }
                            }
                        }
                        
                        // Пропускаем метки, которые являются подписями квадратов
                        if (isGridLabel) {
                            return;
                        }
                        
                        // Это настоящая метка
                        // Определяем тип метки по названию или используем стандартный
                        let markerType = 'default';
                        const typeName = name.toLowerCase();
                        if (typeName.includes('предупреждение') || typeName.includes('warning')) {
                            markerType = 'warning';
                        } else if (typeName.includes('опасность') || typeName.includes('danger')) {
                            markerType = 'danger';
                        } else if (typeName.includes('информация') || typeName.includes('info')) {
                            markerType = 'info';
                        } else if (typeName.includes('кпп') || typeName.includes('checkpoint')) {
                            markerType = 'checkpoint';
                        }
                        
                        this.addMarkerFromImport(pointLatLng, markerType, description);
                    }
                }
            });
            
            // После импорта меток обновляем список
            this.updateMarkersList();
            
            alert('Импорт завершен!');
            
        } catch (error) {
            console.error('Ошибка при парсинге KML:', error);
            alert('Ошибка при парсинге KML: ' + error.message);
        }
    }
    
    addMarkerFromImport(latlng, type, description) {
        const iconColors = {
            'default': '#3388ff',
            'warning': '#ffc107',
            'danger': '#dc3545',
            'info': '#17a2b8',
            'checkpoint': '#28a745'
        };
        
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                background-color: ${iconColors[type]};
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        
        const marker = L.marker(latlng, { 
            icon: icon,
            draggable: true // Делаем метку перетаскиваемой
        });
        marker.addTo(this.map);
        
        const markerData = {
            id: Date.now() + Math.random(),
            latlng: latlng,
            type: type,
            description: description || '',
            marker: marker
        };
        
        // Обработчик перемещения метки
        marker.on('dragend', (e) => {
            const newLatLng = marker.getLatLng();
            markerData.latlng = newLatLng;
            this.updateMarkersList();
        });
        
        // Обработчик клика для редактирования описания
        marker.on('click', (e) => {
            if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
                // Ctrl+Click открывает редактор описания
                this.editMarkerDescription(markerData.id);
            }
        });
        
        this.markers.push(markerData);
        this.updateMarkerPopup(markerData);
        
        if (description) {
            marker.bindPopup(`<strong>${this.getMarkerTypeName(type)}</strong><br>${description}`);
        }
    }
    
    addGridSquareFromImport(bounds, name) {
        // Создаем полигон квадрата
        const polygon = L.polygon([
            bounds.getNorthWest(),
            bounds.getNorthEast(),
            bounds.getSouthEast(),
            bounds.getSouthWest()
        ], {
            color: this.gridColor,
            weight: this.gridWeight,
            fill: false,
            interactive: false,
            pane: 'overlayPane'
        });
        
        polygon.addTo(this.map);
        
        // Определяем row и col из названия (A1 = row 0, col 0)
        const match = name.match(/^([A-Z])(\d+)$/);
        if (match) {
            const letter = match[1];
            const number = parseInt(match[2]) - 1;
            const row = letter.charCodeAt(0) - 65;
            const col = number;
            
            const square = {
                row: row,
                col: col,
                center: bounds.getCenter(),
                bounds: bounds,
                name: name,
                polygon: polygon
            };
            
            if (!this.gridSquares) {
                this.gridSquares = [];
            }
            this.gridSquares.push(square);
            
            // Добавляем метку для квадрата
            this.drawSquareLabel(square);
        }
    }
    
    getKMLColor(type) {
        const colors = {
            'default': 'FF3388FF',
            'warning': 'FFFFC107',
            'danger': 'FFDC3545',
            'info': 'FF17A2B8',
            'checkpoint': 'FF28A745'
        };
        return colors[type] || 'FF3388FF';
    }
    
    getKMLColorFromHex(hex) {
        // Конвертируем hex в KML формат (AABBGGRR)
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        // KML использует формат AABBGGRR
        return 'FF' + 
               ('0' + b.toString(16)).slice(-2).toUpperCase() + 
               ('0' + g.toString(16)).slice(-2).toUpperCase() + 
               ('0' + r.toString(16)).slice(-2).toUpperCase();
    }
    
    clearAll() {
        this.clearGrid();
        this.clearSelectedZone();
        this.markers.forEach(m => {
            this.map.removeLayer(m.marker);
        });
        this.markers = [];
        this.updateMarkersList();
    }
    
    showPrintPreview() {
        const modal = document.getElementById('print-preview-modal');
        modal.style.display = 'flex';
        
        // Создаем предпросмотр
        this.updatePrintPreview();
    }
    
    hidePrintPreview() {
        const modal = document.getElementById('print-preview-modal');
        modal.style.display = 'none';
        
        // Удаляем карту предпросмотра
        if (this.printPreviewMap) {
            this.printPreviewMap.remove();
            this.printPreviewMap = null;
        }
    }
    
    updatePrintPreview() {
        console.log('updatePrintPreview вызван');
        const container = document.getElementById('print-preview-container');
        
        if (!container) {
            console.error('Контейнер print-preview-container не найден!');
            return;
        }
        
        const paperSize = document.getElementById('paper-size').value;
        const orientation = document.getElementById('orientation').value;
        
        console.log('Текущее состояние:', {
            gridSquares: this.gridSquares?.length || 0,
            gridBounds: !!this.gridBounds,
            selectedZone: !!this.selectedZone,
            markers: this.markers?.length || 0
        });
        
        // Очищаем контейнер и удаляем старую карту
        if (this.printPreviewMap) {
            try {
                this.printPreviewMap.remove();
            } catch (e) {
                console.warn('Ошибка при удалении старой карты:', e);
            }
            this.printPreviewMap = null;
        }
        
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #666;">Загрузка предпросмотра...</div>';
        
        // Используем границы сетки если есть, иначе выбранную зону
        const previewBounds = this.gridBounds || this.selectedZone || this.map.getBounds();
        if (!previewBounds) {
            container.innerHTML = '<p style="padding: 2rem; color: #999; text-align: center;">Выберите зону для печати или создайте сетку</p>';
            return;
        }
        
        if (!this.gridSquares || this.gridSquares.length === 0) {
            container.innerHTML = '<p style="padding: 2rem; color: #999; text-align: center;">Сначала создайте сетку</p>';
            return;
        }
        
        console.log('Границы предпросмотра:', previewBounds);
        
        // Создаем контейнер для карты
        const mapDiv = document.createElement('div');
        mapDiv.id = 'print-preview-map';
        mapDiv.className = `print-preview-map ${paperSize}-${orientation}`;
        mapDiv.style.width = '100%';
        mapDiv.style.height = '600px';
        mapDiv.style.minHeight = '600px';
        mapDiv.style.backgroundColor = '#f0f0f0';
        container.appendChild(mapDiv);
        
        console.log('Контейнер карты создан, ожидаем DOM...');
        
        // Небольшая задержка для гарантии, что элемент добавлен в DOM
        setTimeout(() => {
            try {
                const mapElement = document.getElementById('print-preview-map');
                if (!mapElement) {
                    console.error('Элемент print-preview-map не найден');
                    container.innerHTML = '<p style="padding: 2rem; color: #dc3545; text-align: center;">Ошибка: контейнер карты не найден</p>';
                    return;
                }
                
                console.log('Элемент карты найден, создаем карту Leaflet...');
                
                // Устанавливаем размер контейнера явно
                mapElement.style.width = '100%';
                mapElement.style.height = '600px';
                mapElement.style.minHeight = '600px';
                mapElement.style.display = 'block';
                
                // Создаем новую карту для предпросмотра
                this.printPreviewMap = L.map('print-preview-map', {
                    crs: L.CRS.EPSG3857,
                    zoomControl: false,
                    attributionControl: false,
                    dragging: true,
                    touchZoom: true,
                    doubleClickZoom: true,
                    scrollWheelZoom: true,
                    boxZoom: false,
                    keyboard: false,
                    preferCanvas: false
                });
        
                console.log('Карта Leaflet создана');
                
                // Добавляем тот же тип подложки, что и на основной карте
                let tileLayer;
                if (this.currentMapType === 'satellite') {
                    tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        attribution: '© Esri',
                        maxZoom: 19,
                        minZoom: 1
                    });
                    tileLayer.addTo(this.printPreviewMap);
                    console.log('Тайлы спутника добавлены');
                } else if (this.currentMapType === 'topographic') {
                    tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors',
                        maxZoom: 19,
                        minZoom: 1,
                        subdomains: ['a', 'b', 'c']
                    });
                    tileLayer.addTo(this.printPreviewMap);
                    console.log('Тайлы топографии добавлены');
                } else if (this.currentMapType === 'elevation') {
                    tileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a>',
                        maxZoom: 17,
                        minZoom: 1,
                        subdomains: ['a', 'b', 'c']
                    });
                    tileLayer.addTo(this.printPreviewMap);
                    console.log('Тайлы с высотами добавлены');
                } else {
                    console.error('Неизвестный тип карты:', this.currentMapType);
                }
                
                // Устанавливаем границы и добавляем элементы через небольшую задержку
                setTimeout(() => {
                    if (!this.printPreviewMap) {
                        console.error('Карта предпросмотра была удалена');
                        return;
                    }
                    
                    try {
                        // Обновляем размер карты и границы
                        this.printPreviewMap.invalidateSize();
                        this.printPreviewMap.fitBounds(previewBounds, { padding: [20, 20] });
                        
                        // Настраиваем ползунок масштаба
                        const zoomSlider = document.getElementById('preview-zoom');
                        const zoomValue = document.getElementById('preview-zoom-value');
                        if (zoomSlider && zoomValue) {
                            const currentZoom = this.printPreviewMap.getZoom();
                            const minZoom = this.printPreviewMap.getMinZoom();
                            const maxZoom = this.printPreviewMap.getMaxZoom();
                            
                            zoomSlider.min = String(minZoom);
                            zoomSlider.max = String(maxZoom);
                            zoomSlider.value = String(currentZoom);
                            zoomValue.textContent = currentZoom.toFixed(1);
                            
                            zoomSlider.oninput = (e) => {
                                const z = parseFloat(e.target.value);
                                this.printPreviewMap.setZoom(z);
                                zoomValue.textContent = z.toFixed(1);
                                // Обновляем размер шрифта при изменении масштаба ползунком
                                setTimeout(() => this.updatePreviewFontSizes(), 50);
                            };
                            
                            this.printPreviewMap.on('zoomend', () => {
                                const z = this.printPreviewMap.getZoom();
                                zoomSlider.value = String(z);
                                zoomValue.textContent = z.toFixed(1);
                                // Обновляем размер шрифта при изменении масштаба
                                this.updatePreviewFontSizes();
                            });
                            
                            // Обновляем размер шрифта при перетаскивании карты (zoom изменяется плавно)
                            this.printPreviewMap.on('zoom', () => {
                                this.updatePreviewFontSizes();
                            });
                        }
                        
                        console.log('Границы установлены, добавляем элементы...');
                            
                            console.log('Добавляем квадраты сетки:', this.gridSquares.length);
                            
                        // Клонируем все элементы с основной карты
                        // Квадраты сетки
                        if (this.gridSquares && this.gridSquares.length > 0) {
                            this.gridSquares.forEach(square => {
                                if (square.bounds) {
                                    const bounds = square.bounds;
                                    const polygon = L.polygon([
                                        bounds.getNorthWest(),
                                        bounds.getNorthEast(),
                                        bounds.getSouthEast(),
                                        bounds.getSouthWest()
                                    ], {
                                        color: this.gridColor,
                                        weight: this.gridWeight,
                                        fill: false,
                                        interactive: false
                                    });
                                    polygon.addTo(this.printPreviewMap);
                                    
                                    // Название квадрата (для A1 - масштаб, для остальных - название, A2 не показываем)
                                    if (this.showSquareNames && square.name !== 'A2') {
                                        const isA1 = square.name === 'A1';
                                        const labelText = isA1 ? `<${this.gridSize} м>` : square.name;
                                        
                                        // Совпадающая логика позиции с основной картой
                                        const se = bounds.getSouthEast();
                                        const sizeDegLat = this.gridSize / 111320;
                                        const sizeDegLng = this.gridSize / (111320 * Math.cos(bounds.getCenter().lat * Math.PI / 180));
                                        const offsetLat = sizeDegLat * 0.05;
                                        const offsetLng = sizeDegLng * 0.05;
                                        
                                        const labelPos = isA1
                                            ? square.center
                                            : L.latLng(se.lat + offsetLat, se.lng - offsetLng);
                                        
                                        const labelIcon = L.divIcon({
                                            className: 'square-label-div',
                                            html: `<div style="
                                                background: transparent;
                                                padding: 0;
                                                font-size: 11px;
                                                font-weight: bold;
                                                color: white;
                                                pointer-events: none;
                                                user-select: none;
                                                white-space: nowrap;
                                                text-align: ${isA1 ? 'center' : 'right'};
                                            ">${labelText}</div>`,
                                            iconSize: isA1 ? [80, 18] : [60, 16],
                                            iconAnchor: isA1 ? [40, 9] : [60, 16]
                                        });
                                        const label = L.marker(labelPos, {
                                            icon: labelIcon,
                                            interactive: false
                                        });
                                        label.addTo(this.printPreviewMap);
                                    }
                                    
                                        // Улитка только для A2 (крест и цифры)
                                        if (square.name === 'A2') {
                                            const center = square.center;
                                            
                                            // Рисуем крест в предпросмотре
                                            // Вертикальная линия
                                            const verticalLine = L.polyline([
                                                [bounds.getNorth(), center.lng],
                                                [bounds.getSouth(), center.lng]
                                            ], {
                                                color: this.gridColor,
                                                weight: this.gridWeight,
                                                opacity: 0.8,
                                                interactive: false
                                            });
                                            verticalLine.addTo(this.printPreviewMap);
                                            
                                            // Горизонтальная линия
                                            const horizontalLine = L.polyline([
                                                [center.lat, bounds.getWest()],
                                                [center.lat, bounds.getEast()]
                                            ], {
                                                color: this.gridColor,
                                                weight: this.gridWeight,
                                                opacity: 0.8,
                                                interactive: false
                                            });
                                            horizontalLine.addTo(this.printPreviewMap);
                                            
                                            // Добавляем цифры
                                            if (square.snailLabels) {
                                                const nw = bounds.getNorthWest();
                                                const ne = bounds.getNorthEast();
                                                const se = bounds.getSouthEast();
                                                const sw = bounds.getSouthWest();
                                                
                                                const parts = [
                                                    { number: 1, center: L.latLng((nw.lat + center.lat) / 2, (nw.lng + center.lng) / 2) },
                                                    { number: 2, center: L.latLng((ne.lat + center.lat) / 2, (ne.lng + center.lng) / 2) },
                                                    { number: 3, center: L.latLng((se.lat + center.lat) / 2, (se.lng + center.lng) / 2) },
                                                    { number: 4, center: L.latLng((sw.lat + center.lat) / 2, (sw.lng + center.lng) / 2) }
                                                ];
                                                
                                                parts.forEach(part => {
                                                    const labelIcon = L.divIcon({
                                                        className: 'snail-label-div',
                                                        html: `<div style="
                                                            background: transparent;
                                                            border: none;
                                                            padding: 0;
                                                            font-size: 16px;
                                                            font-weight: bold;
                                                            color: white;
                                                            pointer-events: none;
                                                            user-select: none;
                                                            text-align: center;
                                                            line-height: 1;
                                                            font-family: Arial, sans-serif;
                                                        ">${part.number}</div>`,
                                                        iconSize: [24, 24],
                                                        iconAnchor: [12, 12]
                                                    });
                                                    
                                                    const marker = L.marker(part.center, {
                                                        icon: labelIcon,
                                                        interactive: false
                                                    });
                                                    marker.addTo(this.printPreviewMap);
                                                });
                                            }
                                        }
                                }
                            });
                        }
                            
                        // Метки
                        if (this.markers && this.markers.length > 0) {
                            this.markers.forEach(m => {
                                const marker = L.marker(m.latlng, {
                                    icon: m.marker.options.icon,
                                    interactive: false
                                });
                                marker.addTo(this.printPreviewMap);
                            });
                        }
                        
                        // Краевые метки
                        if (this.gridSquares && this.gridSquares.length > 0 && this.gridBounds) {
                            this.addEdgeLabelsToPreview(this.gridSquares, this.gridBounds);
                        }
                        
                        // Инициализируем размер шрифта
                        this.updatePreviewFontSizes();
                        
                        console.log('Элементы добавлены на карту предпросмотра');
                        } catch (error) {
                            console.error('Ошибка при добавлении элементов:', error);
                            container.innerHTML = '<p style="padding: 2rem; color: #dc3545; text-align: center;">Ошибка при добавлении элементов: ' + error.message + '</p>';
                        }
                }, 500);
                
                // Также используем whenReady как резервный вариант
                this.printPreviewMap.whenReady(() => {
                    console.log('Карта готова (whenReady callback)');
                    if (this.printPreviewMap) {
                        this.printPreviewMap.invalidateSize();
                    }
                });
            } catch (error) {
                console.error('Ошибка при создании карты предпросмотра:', error);
                container.innerHTML = '<p style="padding: 2rem; color: #dc3545; text-align: center;">Ошибка при создании предпросмотра: ' + error.message + '</p>';
            }
        }, 300);
    }
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new KMZGenerator();
});

