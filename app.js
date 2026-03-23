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
        this.previewReadyPromise = null;
        this.resolvePreviewReady = null;
        this.gridBounds = null; // Границы сетки для позиционирования краевых меток
        this.showEdgeLeft = true;
        this.showEdgeRight = false;
        this.showEdgeTop = true;
        this.showEdgeBottom = true;
        this.showPointLabels = true;
        this.labelFontFamily = 'Arial, sans-serif';
        this.squareLabelFontSize = 11;
        this.edgeLabelFontSize = 12;
        this.pointLabelFontSize = 12;
        this.gridShiftStepMeters = 10;
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
        
        // Шаг сдвига сетки
        document.getElementById('grid-shift-step').addEventListener('change', (e) => {
            this.gridShiftStepMeters = Math.max(1, parseInt(e.target.value, 10) || 10);
            e.target.value = this.gridShiftStepMeters;
        });
        
        // Сдвиг сетки
        document.getElementById('shift-grid-up').addEventListener('click', () => this.shiftGrid('up'));
        document.getElementById('shift-grid-down').addEventListener('click', () => this.shiftGrid('down'));
        document.getElementById('shift-grid-left').addEventListener('click', () => this.shiftGrid('left'));
        document.getElementById('shift-grid-right').addEventListener('click', () => this.shiftGrid('right'));
        document.getElementById('shift-grid-center').addEventListener('click', () => this.rebuildGridVisuals());
        
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
        
        document.getElementById('show-point-labels').addEventListener('change', (e) => {
            this.showPointLabels = e.target.checked;
            this.updateMarkerLabels();
        });
        
        document.getElementById('label-font-family').addEventListener('change', (e) => {
            this.labelFontFamily = e.target.value || 'Arial, sans-serif';
            this.refreshLabelStyles();
        });
        
        document.getElementById('square-font-size').addEventListener('change', (e) => {
            this.squareLabelFontSize = parseInt(e.target.value, 10) || 11;
            this.refreshLabelStyles();
        });
        
        document.getElementById('edge-font-size').addEventListener('change', (e) => {
            this.edgeLabelFontSize = parseInt(e.target.value, 10) || 12;
            this.refreshLabelStyles();
        });
        
        document.getElementById('point-font-size').addEventListener('change', (e) => {
            this.pointLabelFontSize = parseInt(e.target.value, 10) || 12;
            this.updateMarkerLabels();
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
        
        document.getElementById('export-zone-mode').addEventListener('change', () => {
            this.updatePrintPreview();
        });
        
        // Печать (экспорт в высоком разрешении)
        document.getElementById('print-btn').addEventListener('click', () => {
            if (!this.printPreviewMap) {
                alert('Дождитесь загрузки карты в предпросмотре');
                return;
            }
            this.exportPrintImage('pdf');
        });
        
        document.getElementById('export-png-btn').addEventListener('click', () => {
            if (!this.printPreviewMap) {
                alert('Дождитесь загрузки карты в предпросмотре');
                return;
            }
            this.exportPrintImage('png');
        });
        
        // Экспорт KMZ
        document.getElementById('export-kmz').addEventListener('click', () => {
            this.exportKMZ();
        });
        
        // Экспорт KML
        document.getElementById('export-kml').addEventListener('click', () => {
            this.exportKML();
        });
        
        document.getElementById('export-hires-png').addEventListener('click', async () => {
            if (!this.gridBounds || this.gridSquares.length === 0) {
                alert('Сначала создайте сетку, чтобы экспортировать PNG.');
                return;
            }
            this.showPrintPreview();
            const isReady = await this.waitForPreviewReady(6000);
            if (!isReady) {
                alert('Предпросмотр не успел загрузиться. Попробуйте еще раз.');
                return;
            }
            if (!this.printPreviewMap) {
                alert('Не удалось подготовить карту предпросмотра.');
                return;
            }
            this.exportPrintImage('png');
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
                            font-size: ${this.edgeLabelFontSize}px;
                            font-weight: bold;
                            color: white;
                            pointer-events: none;
                            user-select: none;
                            text-align: center;
                            white-space: nowrap;
                            font-family: ${this.labelFontFamily};
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
                            font-size: ${this.edgeLabelFontSize}px;
                            font-weight: bold;
                            color: white;
                            pointer-events: none;
                            user-select: none;
                            text-align: center;
                            white-space: nowrap;
                            font-family: ${this.labelFontFamily};
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
                            font-size: ${this.edgeLabelFontSize}px;
                            font-weight: bold;
                            color: white;
                            pointer-events: none;
                            user-select: none;
                            text-align: center;
                            white-space: nowrap;
                            font-family: ${this.labelFontFamily};
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
                            font-size: ${this.edgeLabelFontSize}px;
                            font-weight: bold;
                            color: white;
                            pointer-events: none;
                            user-select: none;
                            text-align: center;
                            white-space: nowrap;
                            font-family: ${this.labelFontFamily};
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
                        font-size: ${this.squareLabelFontSize + 5}px;
                        font-weight: bold;
                        color: white;
                        pointer-events: none;
                        user-select: none;
                        text-align: center;
                        line-height: 1;
                        font-family: ${this.labelFontFamily};
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
                    font-size: ${this.squareLabelFontSize}px;
                    font-weight: bold;
                    color: white;
                    pointer-events: none;
                    user-select: none;
                    white-space: nowrap;
                    text-align: ${isA1 ? 'center' : 'right'};
                    font-family: ${this.labelFontFamily};
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
        const baseFontSize = this.squareLabelFontSize;
        const baseEdgeFontSize = this.edgeLabelFontSize;
        const baseSnailFontSize = this.squareLabelFontSize + 5;
        
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
                label.style.fontFamily = this.labelFontFamily;
            });
            
            // Обновляем краевые метки
            const edgeLabels = mapContainer.querySelectorAll('.edge-label-left div, .edge-label-right div, .edge-label-top div, .edge-label-bottom div');
            edgeLabels.forEach(label => {
                label.style.fontSize = edgeFontSize + 'px';
                label.style.fontFamily = this.labelFontFamily;
            });
            
            // Обновляем цифры в A2
            const snailLabels = mapContainer.querySelectorAll('.snail-label-div div');
            snailLabels.forEach(label => {
                label.style.fontSize = snailFontSize + 'px';
                label.style.fontFamily = this.labelFontFamily;
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
                        font-size: ${this.edgeLabelFontSize}px;
                        font-weight: bold;
                        color: white;
                        pointer-events: none;
                        user-select: none;
                        text-align: center;
                        white-space: nowrap;
                        font-family: ${this.labelFontFamily};
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
                        font-size: ${this.edgeLabelFontSize}px;
                        font-weight: bold;
                        color: white;
                        pointer-events: none;
                        user-select: none;
                        text-align: center;
                        white-space: nowrap;
                        font-family: ${this.labelFontFamily};
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
                        font-size: ${this.edgeLabelFontSize}px;
                        font-weight: bold;
                        color: white;
                        pointer-events: none;
                        user-select: none;
                        text-align: center;
                        white-space: nowrap;
                        font-family: ${this.labelFontFamily};
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
                        font-size: ${this.edgeLabelFontSize}px;
                        font-weight: bold;
                        color: white;
                        pointer-events: none;
                        user-select: none;
                        text-align: center;
                        white-space: nowrap;
                        font-family: ${this.labelFontFamily};
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
        const markerNameInput = document.getElementById('marker-name');
        const markerName = markerNameInput ? markerNameInput.value.trim() : '';
        
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
            name: markerName,
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
        this.updateMarkerLabel(markerData);
        
        if (markerNameInput) {
            markerNameInput.value = '';
        }
    }
    
    updateMarkerLabel(markerData) {
        if (!markerData || !markerData.marker) return;
        
        markerData.marker.unbindTooltip();
        
        if (!this.showPointLabels || !markerData.name) return;
        
        const safeName = this.escapeHtml(markerData.name);
        markerData.marker.bindTooltip(
            `<span style="font-size:${this.pointLabelFontSize}px;font-weight:600;font-family:${this.labelFontFamily};color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;">${safeName}</span>`,
            {
                permanent: true,
                direction: 'top',
                offset: [0, -12],
                className: 'marker-name-tooltip',
                interactive: false
            }
        );
    }
    
    updateMarkerLabels() {
        this.markers.forEach(markerData => this.updateMarkerLabel(markerData));
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
                    ${m.name ? `<div class="marker-item-name" style="font-size: 0.8rem; color: #666; margin-top: 0.15rem;">${m.name}</div>` : ''}
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
        const markerName = markerData.name ? `<div>${markerData.name}</div>` : '';
        const markerDescription = markerData.description ? `<div>${markerData.description}</div>` : '';
        const popupContent = `<strong>${this.getMarkerTypeName(markerData.type)}</strong><br>${markerName}${markerDescription}<small style="color: #999;">Ctrl+Click для редактирования</small>`;
        marker.bindPopup(popupContent);
    }
    
    editMarkerDescription(id) {
        const markerData = this.markers.find(m => m.id === id);
        if (!markerData) return;
        
        const currentDescription = markerData.description || '';
        const newDescription = prompt('Введите описание метки:', currentDescription);
        
        if (newDescription !== null) { // null означает, что пользователь нажал "Отмена"
            markerData.description = newDescription;
            const newName = prompt('Введите подпись точки:', markerData.name || '');
            if (newName !== null) {
                markerData.name = newName.trim();
            }
            this.updateMarkerPopup(markerData);
            this.updateMarkerLabel(markerData);
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
                    name: m.name || '',
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
                showPointLabels: this.showPointLabels,
                labelFontFamily: this.labelFontFamily,
                squareLabelFontSize: this.squareLabelFontSize,
                edgeLabelFontSize: this.edgeLabelFontSize,
                pointLabelFontSize: this.pointLabelFontSize,
                gridShiftStepMeters: this.gridShiftStepMeters,
                
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
            
            // Восстанавливаем настройки подписей и шрифтов
            this.showPointLabels = data.showPointLabels !== undefined ? data.showPointLabels : true;
            this.labelFontFamily = data.labelFontFamily || 'Arial, sans-serif';
            this.squareLabelFontSize = data.squareLabelFontSize || 11;
            this.edgeLabelFontSize = data.edgeLabelFontSize || 12;
            this.pointLabelFontSize = data.pointLabelFontSize || 12;
            this.gridShiftStepMeters = data.gridShiftStepMeters || 10;
            document.getElementById('show-point-labels').checked = this.showPointLabels;
            document.getElementById('label-font-family').value = this.labelFontFamily;
            document.getElementById('square-font-size').value = this.squareLabelFontSize;
            document.getElementById('edge-font-size').value = this.edgeLabelFontSize;
            document.getElementById('point-font-size').value = this.pointLabelFontSize;
            document.getElementById('grid-shift-step').value = this.gridShiftStepMeters;
            
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
                this.showPointLabels = data.showPointLabels !== undefined ? data.showPointLabels : true;
                this.labelFontFamily = data.labelFontFamily || 'Arial, sans-serif';
                this.squareLabelFontSize = data.squareLabelFontSize || 11;
                this.edgeLabelFontSize = data.edgeLabelFontSize || 12;
                this.pointLabelFontSize = data.pointLabelFontSize || 12;
                
                // Обновляем UI
                document.getElementById('grid-size').value = this.gridSize;
                document.getElementById('grid-color').value = this.gridColor;
                document.getElementById('grid-weight').value = this.gridWeight;
                document.getElementById('show-square-names').checked = this.showSquareNames;
                document.getElementById('show-edge-left').checked = this.showEdgeLeft;
                document.getElementById('show-edge-right').checked = this.showEdgeRight;
                document.getElementById('show-edge-top').checked = this.showEdgeTop;
                document.getElementById('show-edge-bottom').checked = this.showEdgeBottom;
                document.getElementById('show-point-labels').checked = this.showPointLabels;
                document.getElementById('label-font-family').value = this.labelFontFamily;
                document.getElementById('square-font-size').value = this.squareLabelFontSize;
                document.getElementById('edge-font-size').value = this.edgeLabelFontSize;
                document.getElementById('point-font-size').value = this.pointLabelFontSize;
                
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
                        lastMarker.name = markerData.name || '';
                        this.updateMarkerPopup(lastMarker);
                    }
                });
                
                // Очищаем временные поля
                document.getElementById('marker-type').value = 'default';
                document.getElementById('marker-description').value = '';
                document.getElementById('marker-name').value = '';
            }
            
            this.updateMarkerLabels();
            
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
    
    escapeKMLText(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    
    getKMLMarkerIconHref(type) {
        const iconMap = {
            default: 'http://maps.google.com/mapfiles/kml/paddle/blu-circle.png',
            warning: 'http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png',
            danger: 'http://maps.google.com/mapfiles/kml/paddle/red-circle.png',
            info: 'http://maps.google.com/mapfiles/kml/paddle/purple-circle.png',
            checkpoint: 'http://maps.google.com/mapfiles/kml/paddle/grn-circle.png'
        };
        return iconMap[type] || iconMap.default;
    }
    
    getKMLStyles() {
        const gridColor = this.getKMLColorFromHex(this.gridColor);
        const gridWidth = this.getKMLLineWidth();
        
        return `
    <Style id="gridSquareStyle">
        <LineStyle>
            <color>${gridColor}</color>
            <width>${gridWidth}</width>
        </LineStyle>
        <PolyStyle>
            <color>00000000</color>
            <fill>0</fill>
            <outline>1</outline>
        </PolyStyle>
    </Style>
    <Style id="gridGuideLineStyle">
        <LineStyle>
            <color>${gridColor}</color>
            <width>${gridWidth}</width>
        </LineStyle>
    </Style>
    <Style id="squareLabelStyle">
        <IconStyle>
            <scale>0.35</scale>
            <Icon>
                <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>FFFFFFFF</color>
            <scale>0.75</scale>
        </LabelStyle>
    </Style>
    <Style id="edgeLabelStyle">
        <IconStyle>
            <scale>0.3</scale>
            <Icon>
                <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>FFFFFFFF</color>
            <scale>0.7</scale>
        </LabelStyle>
    </Style>
    <Style id="marker-default-style">
        <IconStyle>
            <scale>1.0</scale>
            <Icon>
                <href>${this.getKMLMarkerIconHref('default')}</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>FFFFFFFF</color>
            <scale>0.8</scale>
        </LabelStyle>
    </Style>
    <Style id="marker-warning-style">
        <IconStyle>
            <scale>1.0</scale>
            <Icon>
                <href>${this.getKMLMarkerIconHref('warning')}</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>FFFFFFFF</color>
            <scale>0.8</scale>
        </LabelStyle>
    </Style>
    <Style id="marker-danger-style">
        <IconStyle>
            <scale>1.0</scale>
            <Icon>
                <href>${this.getKMLMarkerIconHref('danger')}</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>FFFFFFFF</color>
            <scale>0.8</scale>
        </LabelStyle>
    </Style>
    <Style id="marker-info-style">
        <IconStyle>
            <scale>1.0</scale>
            <Icon>
                <href>${this.getKMLMarkerIconHref('info')}</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>FFFFFFFF</color>
            <scale>0.8</scale>
        </LabelStyle>
    </Style>
    <Style id="marker-checkpoint-style">
        <IconStyle>
            <scale>1.0</scale>
            <Icon>
                <href>${this.getKMLMarkerIconHref('checkpoint')}</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>FFFFFFFF</color>
            <scale>0.8</scale>
        </LabelStyle>
    </Style>`;
    }
    
    getKMLMarkerStyleId(type) {
        return `#marker-${type || 'default'}-style`;
    }
    
    formatKMLCoordinate(latlng) {
        return `${latlng.lng},${latlng.lat},0`;
    }
    
    formatKMLCoordinateList(latlngs) {
        return latlngs.map(latlng => this.formatKMLCoordinate(latlng)).join(' ');
    }
    
    createKMLPointPlacemark({ name = '', description = '', styleUrl = '', latlng }) {
        const escapedName = this.escapeKMLText(name);
        const escapedDescription = this.escapeKMLText(description);
        const styleUrlLine = styleUrl ? `\n        <styleUrl>${styleUrl}</styleUrl>` : '';
        const descriptionLine = escapedDescription ? `\n        <description>${escapedDescription}</description>` : '';
        return `
    <Placemark>
        <name>${escapedName}</name>${descriptionLine}${styleUrlLine}
        <Point>
            <coordinates>${this.formatKMLCoordinate(latlng)}</coordinates>
        </Point>
    </Placemark>`;
    }
    
    createKMLLinePlacemark({ name = '', styleUrl = '', latlngs }) {
        const escapedName = this.escapeKMLText(name);
        const styleUrlLine = styleUrl ? `\n        <styleUrl>${styleUrl}</styleUrl>` : '';
        return `
    <Placemark>
        <name>${escapedName}</name>${styleUrlLine}
        <LineString>
            <tessellate>1</tessellate>
            <coordinates>${this.formatKMLCoordinateList(latlngs)}</coordinates>
        </LineString>
    </Placemark>`;
    }
    
    createKMLPolygonPlacemark({ name = '', styleUrl = '', bounds }) {
        const escapedName = this.escapeKMLText(name);
        const styleUrlLine = styleUrl ? `\n        <styleUrl>${styleUrl}</styleUrl>` : '';
        const coordinates = this.formatKMLCoordinateList([
            bounds.getSouthWest(),
            bounds.getSouthEast(),
            bounds.getNorthEast(),
            bounds.getNorthWest(),
            bounds.getSouthWest()
        ]);
        return `
    <Placemark>
        <name>${escapedName}</name>${styleUrlLine}
        <Polygon>
            <outerBoundaryIs>
                <LinearRing>
                    <coordinates>${coordinates}</coordinates>
                </LinearRing>
            </outerBoundaryIs>
        </Polygon>
    </Placemark>`;
    }
    
    buildKMLMarkerDescription(markerData) {
        const parts = [];
        parts.push(`Тип: ${this.getMarkerTypeName(markerData.type)}`);
        if (markerData.name) {
            parts.push(`Название: ${markerData.name}`);
        }
        if (markerData.description) {
            parts.push(`Описание: ${markerData.description}`);
        }
        return parts.join('\n');
    }
    
    generateKML() {
        const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
        const kmlHeader = '<kml xmlns="http://www.opengis.net/kml/2.2">';
        const documentStart = '<Document>';
        const styles = this.getKMLStyles();
        const placemarks = [];
        
        this.markers.forEach(markerData => {
            const markerName = this.showPointLabels
                ? (markerData.name || this.getMarkerTypeName(markerData.type))
                : '';
            placemarks.push(this.createKMLPointPlacemark({
                name: markerName,
                description: this.buildKMLMarkerDescription(markerData),
                styleUrl: this.getKMLMarkerStyleId(markerData.type),
                latlng: markerData.latlng
            }));
        });
        
        if (this.gridSquares.length > 0) {
            this.gridSquares.forEach(square => {
                placemarks.push(this.createKMLPolygonPlacemark({
                    name: square.name,
                    styleUrl: '#gridSquareStyle',
                    bounds: square.bounds
                }));
                
                if (this.showSquareNames && square.name !== 'A2') {
                    const labelText = square.name === 'A1' ? `<${this.gridSize} м>` : square.name;
                    placemarks.push(this.createKMLPointPlacemark({
                        name: labelText,
                        styleUrl: '#squareLabelStyle',
                        latlng: square.center
                    }));
                }
                
                if (square.name === 'A2') {
                    const bounds = square.bounds;
                    const center = square.center;
                    const nw = bounds.getNorthWest();
                    const ne = bounds.getNorthEast();
                    const se = bounds.getSouthEast();
                    const sw = bounds.getSouthWest();
                    
                    placemarks.push(this.createKMLLinePlacemark({
                        name: '',
                        styleUrl: '#gridGuideLineStyle',
                        latlngs: [
                            L.latLng(bounds.getNorth(), center.lng),
                            L.latLng(bounds.getSouth(), center.lng)
                        ]
                    }));
                    placemarks.push(this.createKMLLinePlacemark({
                        name: '',
                        styleUrl: '#gridGuideLineStyle',
                        latlngs: [
                            L.latLng(center.lat, bounds.getWest()),
                            L.latLng(center.lat, bounds.getEast())
                        ]
                    }));
                    
                    const parts = [
                        { number: '1', center: L.latLng((nw.lat + center.lat) / 2, (nw.lng + center.lng) / 2) },
                        { number: '2', center: L.latLng((ne.lat + center.lat) / 2, (ne.lng + center.lng) / 2) },
                        { number: '3', center: L.latLng((se.lat + center.lat) / 2, (se.lng + center.lng) / 2) },
                        { number: '4', center: L.latLng((sw.lat + center.lat) / 2, (sw.lng + center.lng) / 2) }
                    ];
                    parts.forEach(part => {
                        placemarks.push(this.createKMLPointPlacemark({
                            name: part.number,
                            styleUrl: '#squareLabelStyle',
                            latlng: part.center
                        }));
                    });
                }
            });
        }
        
        if (this.gridBounds && this.gridSquares.length > 0) {
            const rows = [...new Set(this.gridSquares.map(square => square.row))].sort((a, b) => a - b);
            const cols = [...new Set(this.gridSquares.map(square => square.col))].sort((a, b) => a - b);
            const sizeDegLat = this.gridSize / 111320;
            const centerLat = this.gridBounds.getCenter().lat;
            const sizeDegLng = this.gridSize / (111320 * Math.cos(centerLat * Math.PI / 180));
            const offsetLat = sizeDegLat * 0.08;
            const offsetLng = sizeDegLng * 0.08;
            
            if (this.showEdgeLeft) {
                rows.forEach(row => {
                    const square = this.gridSquares.find(item => item.row === row && item.col === cols[0]);
                    if (!square) return;
                    const normalizedRow = row >= 0 ? row : 26 + (row % 26);
                    const letter = String.fromCharCode(65 + (normalizedRow % 26));
                    placemarks.push(this.createKMLPointPlacemark({
                        name: letter,
                        styleUrl: '#edgeLabelStyle',
                        latlng: L.latLng(square.center.lat, this.gridBounds.getWest() - offsetLng)
                    }));
                });
            }
            
            if (this.showEdgeRight) {
                rows.forEach(row => {
                    const square = this.gridSquares.find(item => item.row === row && item.col === cols[cols.length - 1]);
                    if (!square) return;
                    const normalizedRow = row >= 0 ? row : 26 + (row % 26);
                    const letter = String.fromCharCode(65 + (normalizedRow % 26));
                    placemarks.push(this.createKMLPointPlacemark({
                        name: letter,
                        styleUrl: '#edgeLabelStyle',
                        latlng: L.latLng(square.center.lat, this.gridBounds.getEast() + offsetLng)
                    }));
                });
            }
            
            if (this.showEdgeTop) {
                cols.forEach(col => {
                    const square = this.gridSquares.find(item => item.col === col && item.row === rows[0]);
                    if (!square) return;
                    const normalizedCol = col >= 0 ? col : Math.abs(col);
                    placemarks.push(this.createKMLPointPlacemark({
                        name: String(normalizedCol + 1),
                        styleUrl: '#edgeLabelStyle',
                        latlng: L.latLng(this.gridBounds.getNorth() + offsetLat, square.center.lng)
                    }));
                });
            }
            
            if (this.showEdgeBottom) {
                cols.forEach(col => {
                    const square = this.gridSquares.find(item => item.col === col && item.row === rows[rows.length - 1]);
                    if (!square) return;
                    const normalizedCol = col >= 0 ? col : Math.abs(col);
                    placemarks.push(this.createKMLPointPlacemark({
                        name: String(normalizedCol + 1),
                        styleUrl: '#edgeLabelStyle',
                        latlng: L.latLng(this.gridBounds.getSouth() - offsetLat, square.center.lng)
                    }));
                });
            }
        }
        
        return [
            xmlHeader,
            kmlHeader,
            documentStart,
            styles,
            placemarks.join('\n'),
            '</Document>',
            '</kml>'
        ].join('\n');
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
            const styleTypeMap = this.buildKMLStyleTypeMap(xmlDoc);
            
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
                const styleUrl = (placemark.querySelector('styleUrl')?.textContent || '').trim();
                
                if (point) {
                    if (styleUrl === '#squareLabelStyle' || styleUrl === '#edgeLabelStyle') {
                        return;
                    }
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
                        const markerType = this.resolveMarkerTypeFromPlacemark(placemark, name, styleTypeMap);
                        this.addMarkerFromImport(pointLatLng, markerType, description, name);
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
    
    inferMarkerTypeByText(text) {
        const value = (text || '').toLowerCase();
        if (value.includes('предупреждение') || value.includes('warning') || value.includes('yellow') || value.includes('ylw') || value.includes('orange')) {
            return 'warning';
        }
        if (value.includes('опасность') || value.includes('danger') || value.includes('red') || value.includes('outer')) {
            return 'danger';
        }
        if (value.includes('информация') || value.includes('info') || value.includes('purple')) {
            return 'info';
        }
        if (value.includes('кпп') || value.includes('checkpoint') || value.includes('green') || value.includes('grn')) {
            return 'checkpoint';
        }
        if (value.includes('стандарт') || value.includes('default') || value.includes('blue') || value.includes('blu') || value.includes('inner')) {
            return 'default';
        }
        return null;
    }

    inferMarkerTypeByColor(colorValue) {
        const value = (colorValue || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
        const colorMap = {
            // AARRGGBB (используется в текущем экспорте приложения)
            'FF3388FF': 'default',
            'FFFFC107': 'warning',
            'FFDC3545': 'danger',
            'FF17A2B8': 'info',
            'FF28A745': 'checkpoint',
            // AABBGGRR (стандарт KML)
            'FFFF8833': 'default',
            'FF07C1FF': 'warning',
            'FF4535DC': 'danger',
            'FFB8A217': 'info',
            'FF45A728': 'checkpoint'
        };
        return colorMap[value] || null;
    }

    buildKMLStyleTypeMap(xmlDoc) {
        const styleTypeMap = new Map();

        xmlDoc.querySelectorAll('Style').forEach(styleNode => {
            const styleId = styleNode.getAttribute('id');
            if (!styleId) return;

            let styleType = null;
            const iconHref = styleNode.querySelector('IconStyle Icon href')?.textContent || '';
            if (iconHref) {
                styleType = this.inferMarkerTypeByText(iconHref);
            }

            if (!styleType) {
                const iconColor = styleNode.querySelector('IconStyle color')?.textContent || '';
                styleType = this.inferMarkerTypeByColor(iconColor);
            }

            if (!styleType) {
                styleType = this.inferMarkerTypeByText(styleId);
            }

            if (styleType) {
                styleTypeMap.set(styleId, styleType);
                styleTypeMap.set(`#${styleId}`, styleType);
            }
        });

        xmlDoc.querySelectorAll('StyleMap').forEach(styleMapNode => {
            const styleMapId = styleMapNode.getAttribute('id');
            if (!styleMapId) return;

            const pairs = styleMapNode.querySelectorAll('Pair');
            for (const pair of pairs) {
                const key = (pair.querySelector('key')?.textContent || '').trim();
                const styleUrl = (pair.querySelector('styleUrl')?.textContent || '').trim();
                if (key !== 'normal' || !styleUrl) continue;

                const styleType = styleTypeMap.get(styleUrl) || styleTypeMap.get(styleUrl.replace(/^#/, ''));
                if (styleType) {
                    styleTypeMap.set(styleMapId, styleType);
                    styleTypeMap.set(`#${styleMapId}`, styleType);
                    break;
                }
            }
        });

        return styleTypeMap;
    }

    resolveMarkerTypeFromPlacemark(placemark, markerName, styleTypeMap) {
        const styleUrl = (placemark.querySelector('styleUrl')?.textContent || '').trim();
        if (styleUrl) {
            const styleByUrl = styleTypeMap.get(styleUrl) || styleTypeMap.get(styleUrl.replace(/^#/, ''));
            if (styleByUrl) {
                return styleByUrl;
            }
        }

        const inlineIconHref = placemark.querySelector('Style IconStyle Icon href')?.textContent || '';
        if (inlineIconHref) {
            const typeByInlineHref = this.inferMarkerTypeByText(inlineIconHref);
            if (typeByInlineHref) {
                return typeByInlineHref;
            }
        }

        const inlineColor = placemark.querySelector('Style IconStyle color')?.textContent || '';
        const inlineColorType = this.inferMarkerTypeByColor(inlineColor);
        if (inlineColorType) {
            return inlineColorType;
        }

        return this.inferMarkerTypeByText(markerName) || 'default';
    }

    addMarkerFromImport(latlng, type, description, name = '') {
        const markerName = (name || '').trim();
        const markerDescription = (description || '').trim();

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
            name: markerName,
            description: markerDescription,
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

    getKMLLineWidth() {
        // Android и iOS KML viewers рендерят толщину по-разному.
        // Нормализуем и ограничиваем значение, чтобы избежать "очень жирных" линий на Android.
        const sourceWeight = Number(this.gridWeight);
        const safeWeight = Number.isFinite(sourceWeight) ? sourceWeight : 2;
        const normalized = safeWeight * 0.6;
        const clamped = Math.max(1, Math.min(3, normalized));
        return clamped.toFixed(1);
    }
    
    escapeHtml(value) {
        if (typeof value !== 'string') return '';
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    refreshLabelStyles() {
        if (this.gridSquares && this.gridSquares.length > 0) {
            this.gridSquares.forEach(square => {
                if (square.label && this.map.hasLayer(square.label)) {
                    this.map.removeLayer(square.label);
                }
                square.label = null;
                this.drawSquareLabel(square);
                if (square.name === 'A2') {
                    this.drawSnail(square);
                }
            });
            this.updateEdgeLabels();
        }
        this.updateMarkerLabels();
        if (this.printPreviewMap) {
            this.updatePrintPreview();
        }
    }
    
    getExportBoundsByMode() {
        const modeElement = document.getElementById('export-zone-mode');
        const mode = modeElement ? modeElement.value : 'grid';
        
        if (mode === 'selected-zone') {
            if (!this.selectedZone) {
                alert('Для этого режима сначала выберите зону на карте.');
                return null;
            }
            return this.selectedZone;
        }
        
        if (mode === 'current-view') {
            return this.map.getBounds();
        }
        
        if (this.gridBounds) {
            return this.gridBounds;
        }
        
        if (this.selectedZone) {
            return this.selectedZone;
        }
        
        return this.map.getBounds();
    }
    
    getBufferedGridBounds(bufferMeters = 30) {
        if (!this.gridBounds) return null;
        const centerLat = this.gridBounds.getCenter().lat;
        const deltaLat = bufferMeters / 111320;
        const deltaLng = bufferMeters / (111320 * Math.cos(centerLat * Math.PI / 180));
        return L.latLngBounds(
            [this.gridBounds.getSouth() - deltaLat, this.gridBounds.getWest() - deltaLng],
            [this.gridBounds.getNorth() + deltaLat, this.gridBounds.getEast() + deltaLng]
        );
    }
    
    getMarkerBounds() {
        if (!this.markers || this.markers.length === 0) return null;
        const points = this.markers
            .map(markerData => markerData?.latlng)
            .filter(Boolean);
        if (points.length === 0) return null;
        return L.latLngBounds(points);
    }
    
    getBoundsSizeMeters(bounds) {
        if (!bounds) {
            return { widthMeters: 1, heightMeters: 1 };
        }
        const centerLat = bounds.getCenter().lat;
        const widthMeters = Math.max(
            1,
            (bounds.getEast() - bounds.getWest()) * 111320 * Math.cos(centerLat * Math.PI / 180)
        );
        const heightMeters = Math.max(
            1,
            (bounds.getNorth() - bounds.getSouth()) * 111320
        );
        return { widthMeters, heightMeters };
    }
    
    getPngExportBounds() {
        const baseBounds = this.getBufferedGridBounds(30) || this.getPreviewBounds();
        if (!baseBounds) return null;
        
        const exportBounds = L.latLngBounds(
            [baseBounds.getSouth(), baseBounds.getWest()],
            [baseBounds.getNorth(), baseBounds.getEast()]
        );
        
        const markerBounds = this.getMarkerBounds();
        if (markerBounds) {
            exportBounds.extend(markerBounds.getSouthWest());
            exportBounds.extend(markerBounds.getNorthEast());
        }
        
        return exportBounds;
    }
    
    getPngExportSize(bounds) {
        const { widthMeters, heightMeters } = this.getBoundsSizeMeters(bounds);
        const aspectRatio = Math.max(0.15, Math.min(6, widthMeters / heightMeters));
        const longSidePx = 5000;
        const minShortSidePx = 1800;
        
        let widthPx;
        let heightPx;
        if (aspectRatio >= 1) {
            widthPx = longSidePx;
            heightPx = Math.round(widthPx / aspectRatio);
        } else {
            heightPx = longSidePx;
            widthPx = Math.round(heightPx * aspectRatio);
        }
        
        if (Math.min(widthPx, heightPx) < minShortSidePx) {
            const scale = minShortSidePx / Math.min(widthPx, heightPx);
            widthPx = Math.round(widthPx * scale);
            heightPx = Math.round(heightPx * scale);
        }
        
        return {
            widthPx: Math.max(1200, widthPx),
            heightPx: Math.max(1200, heightPx)
        };
    }
    
    getPreviewBounds() {
        // Для печати и HighRes PNG приоритет: вся сетка + 30м
        const bufferedGrid = this.getBufferedGridBounds(30);
        if (bufferedGrid) return bufferedGrid;
        
        const selectedMode = document.getElementById('export-zone-mode')?.value;
        if (selectedMode === 'selected-zone' && this.selectedZone) return this.selectedZone;
        if (selectedMode === 'current-view') return this.map.getBounds();
        
        return this.gridBounds || this.selectedZone || this.map.getBounds();
    }
    
    waitForPreviewReady(timeoutMs = 6000) {
        if (!this.previewReadyPromise) {
            return Promise.resolve(!!this.printPreviewMap);
        }
        return Promise.race([
            this.previewReadyPromise.then(() => true).catch(() => false),
            new Promise(resolve => setTimeout(() => resolve(false), timeoutMs))
        ]);
    }
    
    waitForMapMoveEnd(map, timeoutMs = 3000) {
        return new Promise(resolve => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                resolve();
            };
            const timeoutId = setTimeout(finish, timeoutMs);
            map.once('moveend', () => {
                clearTimeout(timeoutId);
                finish();
            });
        });
    }
    
    waitForTilesLoaded(map, timeoutMs = 5000) {
        return new Promise(resolve => {
            const start = Date.now();
            const check = () => {
                if (!map) {
                    resolve();
                    return;
                }
                let pending = 0;
                map.eachLayer(layer => {
                    if (layer instanceof L.TileLayer) {
                        const tiles = layer._tiles || {};
                        Object.values(tiles).forEach(tile => {
                            if (!tile.loaded) {
                                pending += 1;
                            }
                        });
                    }
                });
                
                if (pending === 0 || Date.now() - start > timeoutMs) {
                    resolve();
                    return;
                }
                setTimeout(check, 120);
            };
            check();
        });
    }
    
    async ensurePreviewMapRender(bounds, padding = [40, 40]) {
        if (!this.printPreviewMap || !bounds) return;
        this.printPreviewMap.invalidateSize();
        this.printPreviewMap.fitBounds(bounds, { padding });
        await this.waitForMapMoveEnd(this.printPreviewMap, 3000);
        await this.waitForTilesLoaded(this.printPreviewMap, 5000);
        await new Promise(resolve => setTimeout(resolve, 120));
    }
    
    shiftGrid(direction) {
        if (!this.gridSquares || this.gridSquares.length === 0 || !this.gridBounds) {
            alert('Сначала создайте сетку.');
            return;
        }
        
        const stepMeters = Math.max(1, Number(this.gridShiftStepMeters) || 10);
        const centerLat = this.gridBounds.getCenter().lat;
        const deltaLat = stepMeters / 111320;
        const deltaLng = stepMeters / (111320 * Math.cos(centerLat * Math.PI / 180));
        
        let moveLat = 0;
        let moveLng = 0;
        if (direction === 'up') moveLat = deltaLat;
        if (direction === 'down') moveLat = -deltaLat;
        if (direction === 'left') moveLng = -deltaLng;
        if (direction === 'right') moveLng = deltaLng;
        
        if (moveLat === 0 && moveLng === 0) return;
        
        // Сдвигаем квадраты и их геометрию
        this.gridSquares.forEach(square => {
            const b = square.bounds;
            square.bounds = L.latLngBounds(
                [b.getSouth() + moveLat, b.getWest() + moveLng],
                [b.getNorth() + moveLat, b.getEast() + moveLng]
            );
            square.center = L.latLng(square.center.lat + moveLat, square.center.lng + moveLng);
        });
        
        // Сдвигаем общие границы сетки
        const gb = this.gridBounds;
        this.gridBounds = L.latLngBounds(
            [gb.getSouth() + moveLat, gb.getWest() + moveLng],
            [gb.getNorth() + moveLat, gb.getEast() + moveLng]
        );
        
        // Если есть выбранная зона - сдвигаем и ее, чтобы состояние проекта оставалось консистентным
        if (this.selectedZone) {
            this.selectedZone = L.latLngBounds(
                [this.selectedZone.getSouth() + moveLat, this.selectedZone.getWest() + moveLng],
                [this.selectedZone.getNorth() + moveLat, this.selectedZone.getEast() + moveLng]
            );
        }
        
        if (this.zoneRectangle) {
            this.map.removeLayer(this.zoneRectangle);
            this.zoneRectangle = null;
        }
        
        this.rebuildGridVisuals();
    }
    
    rebuildGridVisuals() {
        if (!this.gridSquares || this.gridSquares.length === 0) return;
        
        this.gridSquares.forEach(square => {
            if (square.polygon && this.map.hasLayer(square.polygon)) {
                this.map.removeLayer(square.polygon);
            }
            if (square.label && this.map.hasLayer(square.label)) {
                this.map.removeLayer(square.label);
            }
            if (square.snailLines) {
                square.snailLines.forEach(line => {
                    if (this.map.hasLayer(line)) this.map.removeLayer(line);
                });
            }
            if (square.snailLabels) {
                square.snailLabels.forEach(label => {
                    if (this.map.hasLayer(label)) this.map.removeLayer(label);
                });
            }
            
            square.polygon = L.polygon([
                square.bounds.getNorthWest(),
                square.bounds.getNorthEast(),
                square.bounds.getSouthEast(),
                square.bounds.getSouthWest()
            ], {
                color: this.gridColor,
                weight: this.gridWeight,
                fill: false,
                interactive: false
            }).addTo(this.map);
            
            square.label = null;
            this.drawSquareLabel(square);
            
            if (square.name === 'A2') {
                this.drawSnail(square);
            }
        });
        
        this.updateEdgeLabels();
        this.updateGridDisplay();
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
        this.previewReadyPromise = new Promise(resolve => {
            this.resolvePreviewReady = resolve;
        });
        
        if (!container) {
            console.error('Контейнер print-preview-container не найден!');
            if (this.resolvePreviewReady) this.resolvePreviewReady(false);
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
        
        // Выбор зоны экспорта (по сетке / по выделенной зоне / текущий экран)
        const previewBounds = this.getPreviewBounds();
        if (!previewBounds) {
            container.innerHTML = '<p style="padding: 2rem; color: #999; text-align: center;">Выберите зону для печати или создайте сетку</p>';
            if (this.resolvePreviewReady) this.resolvePreviewReady(false);
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
                    if (this.resolvePreviewReady) this.resolvePreviewReady(false);
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
                        this.printPreviewMap.fitBounds(previewBounds, { padding: [40, 40] });
                        const fittedZoom = this.printPreviewMap.getZoom();
                        
                        // Настраиваем ползунок масштаба
                        const zoomSlider = document.getElementById('preview-zoom');
                        const zoomValue = document.getElementById('preview-zoom-value');
                        if (zoomSlider && zoomValue) {
                            const minZoom = this.printPreviewMap.getMinZoom();
                            const maxZoom = this.printPreviewMap.getMaxZoom();
                            
                            zoomSlider.min = String(minZoom);
                            zoomSlider.max = String(maxZoom);
                            zoomSlider.value = String(fittedZoom);
                            zoomValue.textContent = fittedZoom.toFixed(1);
                            
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
                                                font-size: ${this.squareLabelFontSize}px;
                                                font-weight: bold;
                                                color: white;
                                                pointer-events: none;
                                                user-select: none;
                                                white-space: nowrap;
                                                text-align: ${isA1 ? 'center' : 'right'};
                                                font-family: ${this.labelFontFamily};
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
                                                            font-size: ${this.squareLabelFontSize + 5}px;
                                                            font-weight: bold;
                                                            color: white;
                                                            pointer-events: none;
                                                            user-select: none;
                                                            text-align: center;
                                                            line-height: 1;
                                                            font-family: ${this.labelFontFamily};
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
                                if (this.showPointLabels && m.name) {
                                    marker.bindTooltip(
                                        `<span style="font-size:${this.pointLabelFontSize}px;font-weight:600;font-family:${this.labelFontFamily};color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;">${this.escapeHtml(m.name)}</span>`,
                                        {
                                            permanent: true,
                                            direction: 'top',
                                            offset: [0, -12],
                                            className: 'marker-name-tooltip',
                                            interactive: false
                                        }
                                    );
                                }
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
                        if (this.resolvePreviewReady) this.resolvePreviewReady(true);
                        } catch (error) {
                            console.error('Ошибка при добавлении элементов:', error);
                            container.innerHTML = '<p style="padding: 2rem; color: #dc3545; text-align: center;">Ошибка при добавлении элементов: ' + error.message + '</p>';
                            if (this.resolvePreviewReady) this.resolvePreviewReady(false);
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
                if (this.resolvePreviewReady) this.resolvePreviewReady(false);
            }
        }, 300);
    }
    
    // Экспорт карты для печати в высоком разрешении
    async exportPrintImage(format = 'pdf') {
        if (!this.printPreviewMap) {
            alert('Карта предпросмотра не готова');
            return;
        }
        
        const paperSize = document.getElementById('paper-size').value;
        const orientation = document.getElementById('orientation').value;
        
        let widthPx, heightPx;
        let exportBounds = null;
        if (format === 'png') {
            exportBounds = this.getPngExportBounds();
            if (!exportBounds) {
                alert('Нет данных для экспорта PNG.');
                return;
            }
            const pngSize = this.getPngExportSize(exportBounds);
            widthPx = pngSize.widthPx;
            heightPx = pngSize.heightPx;
        } else if (paperSize === 'A4') {
            widthPx = orientation === 'portrait' ? 2480 : 3508;
            heightPx = orientation === 'portrait' ? 3508 : 2480;
        } else { // A3
            widthPx = orientation === 'portrait' ? 3508 : 4961;
            heightPx = orientation === 'portrait' ? 4961 : 3508;
        }
        
        let actionBtn = null;
        let originalText = '';
        let mapContainer = null;
        let originalWidth = '';
        let originalHeight = '';
        let originalMinHeight = '';
        let resizedForPng = false;
        
        try {
            // Показываем индикатор загрузки
            actionBtn = format === 'png'
                ? document.getElementById('export-png-btn')
                : document.getElementById('print-btn');
            originalText = actionBtn.textContent;
            actionBtn.textContent = format === 'png' ? 'Создание PNG...' : 'Создание PDF...';
            actionBtn.disabled = true;
            
            // Получаем контейнер карты
            mapContainer = this.printPreviewMap.getContainer();
            const renderBounds = format === 'png' ? exportBounds : this.getPreviewBounds();
            if (!renderBounds) {
                throw new Error('Нет доступных границ для экспорта');
            }
            
            originalWidth = mapContainer.style.width;
            originalHeight = mapContainer.style.height;
            originalMinHeight = mapContainer.style.minHeight;
            
            // PNG рендерим в большом целевом размере, чтобы качество не зависело от текущего окна предпросмотра
            if (format === 'png') {
                mapContainer.style.width = `${widthPx}px`;
                mapContainer.style.height = `${heightPx}px`;
                mapContainer.style.minHeight = `${heightPx}px`;
                resizedForPng = true;
            }
            
            await this.ensurePreviewMapRender(renderBounds, format === 'png' ? [16, 16] : [40, 40]);
            
            // Создаем изображение с высоким разрешением
            const canvas = await html2canvas(mapContainer, {
                scale: format === 'png' ? 1 : 3,
                useCORS: true,
                logging: false,
                width: mapContainer.offsetWidth,
                height: mapContainer.offsetHeight,
                backgroundColor: '#ffffff',
                windowWidth: mapContainer.scrollWidth,
                windowHeight: mapContainer.scrollHeight
            });
            
            if (format === 'png') {
                const a = document.createElement('a');
                a.href = canvas.toDataURL('image/png');
                a.download = `map_hires_${widthPx}x${heightPx}_${new Date().getTime()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                alert('PNG создан: аккуратный кадр по сетке и точкам.');
                return;
            }
            
            // Создаем новый canvas с нужным размером для печати
            const printCanvas = document.createElement('canvas');
            printCanvas.width = widthPx;
            printCanvas.height = heightPx;
            const ctx = printCanvas.getContext('2d');
            
            // Заливаем белым фоном
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, widthPx, heightPx);
            
            // Вычисляем масштаб для вписывания карты в размер листа
            const scaleX = widthPx / canvas.width;
            const scaleY = heightPx / canvas.height;
            const scale = Math.min(scaleX, scaleY);
            
            // Центрируем изображение
            const scaledWidth = canvas.width * scale;
            const scaledHeight = canvas.height * scale;
            const x = (widthPx - scaledWidth) / 2;
            const y = (heightPx - scaledHeight) / 2;
            
            // Рисуем карту на canvas для печати
            ctx.drawImage(canvas, x, y, scaledWidth, scaledHeight);
            
            const imgData = printCanvas.toDataURL('image/png', 1.0);
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
                unit: 'mm',
                format: paperSize.toLowerCase()
            });
            pdf.addImage(imgData, 'PNG', 0, 0, 
                orientation === 'landscape' ? 
                    (paperSize === 'A4' ? 297 : 420) : 
                    (paperSize === 'A4' ? 210 : 297),
                orientation === 'landscape' ? 
                    (paperSize === 'A4' ? 210 : 297) : 
                    (paperSize === 'A4' ? 297 : 420)
            );
            const fileName = `map_print_${paperSize}_${orientation}_${new Date().getTime()}.pdf`;
            pdf.save(fileName);
            alert('PDF файл успешно создан!');
            
        } catch (error) {
            console.error('Ошибка при создании изображения:', error);
            alert('Ошибка при создании файла: ' + error.message);
            
            // Восстанавливаем состояние кнопки в случае ошибки
            const printBtn = document.getElementById('print-btn');
            const pngBtn = document.getElementById('export-png-btn');
            if (printBtn) {
                printBtn.textContent = 'Печать';
                printBtn.disabled = false;
            }
            if (pngBtn) {
                pngBtn.textContent = 'Экспорт HiRes PNG';
                pngBtn.disabled = false;
            }
        } finally {
            if (mapContainer && resizedForPng) {
                mapContainer.style.width = originalWidth;
                mapContainer.style.height = originalHeight;
                mapContainer.style.minHeight = originalMinHeight;
                await this.ensurePreviewMapRender(this.getPreviewBounds(), [40, 40]);
            }
            if (actionBtn) {
                actionBtn.textContent = originalText;
                actionBtn.disabled = false;
            }
        }
    }
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new KMZGenerator();
});

