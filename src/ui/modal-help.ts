import { $ } from '../utils/dom';

let modalVisible = false;

export function showHelpModal(): void {
  if (modalVisible) return;
  modalVisible = true;

  const overlay = $<HTMLDivElement>('#modal-overlay');
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="modal modal--help">
      <div class="modal__header">
        <span class="modal__title">Как пользоваться</span>
        <button class="modal__close" id="btn-close-help" aria-label="Закрыть">&times;</button>
      </div>
      <div class="modal__body">
        <section class="help-section">
          <h3 class="help-section__title">🗺️ Карта</h3>
          <p>Во вкладке <b>Карта</b> выберите тип подложки: спутниковый снимок, топографическая карта или рельеф.</p>
          <p>Перемещение — левой кнопкой мыши, масштаб — колёсиком или <b>+/−</b> в углу.</p>
        </section>

        <section class="help-section">
          <h3 class="help-section__title">📐 Сетка</h3>
          <ol>
            <li><b>Выбрать зону</b> — нажмите кнопку и обведите прямоугольник на карте.</li>
            <li>Задайте <b>размер ячейки</b> (в метрах) и <b>начальную букву</b>.</li>
            <li>Нажмите <b>Создать сетку</b>.</li>
            <li>Сдвиг сетки — стрелками в секции <b>Сдвиг</b>, шаг задаётся отдельно.</li>
            <li>В <b>Оформлении</b> настраиваются цвет и толщина линий, шрифты, цвет подписей, обводка, положение меток квадратов.</li>
            <li>В <b>Краевых метках</b> включите нужные стороны (буквы слева/справа, цифры сверху/снизу).</li>
          </ol>
          <p><b>A1</b> — квадрат масштабной легенды (<code>&lt;размер м&gt;</code>), <b>A2</b> — «улитка» для ориентирования.</p>
        </section>

        <section class="help-section">
          <h3 class="help-section__title">📍 Метки</h3>
          <p>Во вкладке <b>Метки</b> выберите тип (обычная, внимание, опасность, инфо, КПП), включите режим добавления и кликайте по карте.</p>
          <p>У каждой метки можно задать <b>название</b> и <b>описание</b>.</p>
          <p><b>Редактирование метки:</b></p>
          <ul>
            <li>Открыть редактор — нажать <b>✏️</b> в списке меток или <b>Ctrl+Click</b> (<b>⌘+Click</b> на Mac) по метке на карте.</li>
            <li>В редакторе доступны: <b>тип</b>, <b>цвет кружка</b>, <b>иконка</b> (из набора или свой URL), подпись и описание.</li>
            <li>Цвет и иконка взаимоисключающие: если выбрана иконка — цвет игнорируется (поле становится неактивным).</li>
            <li>Кнопка <b>«Без иконки»</b> (✖ в сетке) возвращает обычный цветной кружок.</li>
            <li><b>Сохранить</b> применяет изменения, <b>Отмена</b> — нет. Переместить метку можно перетаскиванием прямо на карте.</li>
          </ul>
        </section>

        <section class="help-section">
          <h3 class="help-section__title">💾 Проекты и импорт</h3>
          <p>Во вкладке <b>Файл</b>:</p>
          <ul>
            <li><b>Сохранить проект</b> — всё сохраняется в браузере. При загрузке карта центрируется на сетке, настройки оформления подтягиваются автоматически.</li>
            <li><b>Импорт KMZ/KML</b> — загружает метки (и сетку, если она хранится в KMZ как overlay). Текущие данные заменяются.</li>
            <li>Кнопки очистки удаляют сетку, метки или всё сразу.</li>
          </ul>
        </section>

        <section class="help-section">
          <h3 class="help-section__title">📤 Экспорт</h3>
          <ul>
            <li><b>PNG</b> — высокое разрешение с подложкой, сеткой и метками. В окне предпросмотра можно выбрать зону и масштаб.</li>
            <li><b>KML</b> — только точки (метки), без полигонов сетки. Подходит для MapsPlus, AlpineQuest и т.п.</li>
            <li><b>KMZ</b> — точки + сетка как полупрозрачное изображение поверх карты (GroundOverlay).</li>
          </ul>
        </section>

        <section class="help-section">
          <h3 class="help-section__title">🔁 Конвертер</h3>
          <p>В шапке есть ссылка на отдельную страницу конвертера — преобразование форматов между собой.</p>
        </section>
      </div>
      <div class="modal__footer">
        <button class="btn btn--primary" id="btn-help-ok">Понятно</button>
      </div>
    </div>
  `;

  function close() {
    modalVisible = false;
    overlay.style.display = 'none';
    overlay.innerHTML = '';
    document.removeEventListener('keydown', onKey);
  }

  $<HTMLButtonElement>('#btn-close-help').addEventListener('click', close);
  $<HTMLButtonElement>('#btn-help-ok').addEventListener('click', close);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
}
