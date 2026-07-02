# Divix — Этап 2: воркспейс DIFUSO (порт DITHR)

**Дата:** 2026-07-02
**Статус:** утверждён

## Цель

Портировать второй ручной p5.js-инструмент, DITHR (dithering/effects tool), в воркспейс **DIFUSO** внутри Divix, по образцу того, как был портирован SPLITX → DIVIX в Этапе 1. Старое имя DITHR нигде не фигурирует в новом коде.

## Область охвата (Срез 1)

Первый срез DIFUSO покрывает **изображения и видео** как источник текстуры для dithering-эффектов. Явно вне рамок этого среза:

- **3D-модели** (`.obj`/`.stl` загрузка, WebGL-камера, освещение, вращение) — отдельный будущий этап, аналогично тому как auth/paywall был вынесен из первого среза divix в целом.
- **Poster-оверлей** (`posterGraphics()` в оригинале — брендовый текст "DITHR TOOL"/"ANTLII.WORK"/версия/размер экспорта по углам канваса) — выкидывается полностью, это брендинг оригинала, не переносится (аналогично удалению license/watermark в SPLITX → DIVIX).
- **SVG-экспорт** — в DITHR его не было, соответственно и в DIFUSO не появится (только PNG/MP4).

## Версия p5.js — исключение из общего правила

DIFUSO — единственный воркспейс Divix, использующий **p5 2.2.3**, а не 1.11.2 (как весь остальной divix). Причина: WebGL-шейдеры оригинала (`ditherShader`, `asciiShader`, halftone/gradient-шейдеры) написаны и проверены под p5 2.x; риск скрытой несовместимости API при насильном даунгрейде на 1.x выше, чем риск изоляции второй версии p5.

**Механизм изоляции:** `index.html` продолжает грузить `window.p5` 1.11.2 глобально для остальных пяти воркспейсов (без изменений). p5 2.2.3 ставится через npm (`package.json` dependency) и импортируется как ES-модуль **только** внутри `src/difuso/js/app.js` (`import p5 from 'p5'`). Vite код-сплиттинг уже изолирует чанки по воркспейсам (см. `src/js/main.js`'s `load()` per workspace), поэтому p5 2.x никогда не достигает глобальной области видимости и не конфликтует с `window.p5` 1.11.2 или `main.js`'s `new p5(sketch, container)` вызовом для остальных воркспейсов. `src/js/main.js`'s registry-запись для difuso не меняет общий паттерн (`load`/`containerId`/`animated`), но её собранный чанк несёт свою собственную копию p5 2.x.

## Архитектура рендер-пайплайна — декомпозиция по режимам эффекта

Модули раскладываются **по типу эффекта**, зеркаля уже проверенную структуру reference-файлов (`reference/dithr/scripts/shader.js`, `ascii.js`, `gradient.js` уже разделены в оригинале аналогично) — это снижает риск при переносе по сравнению с абстрактным разбиением по слоям пайплайна (source/shader-runner/composite/export), которое пришлось бы выдумывать заново.

- **`src/difuso/js/source.js`** — загрузка и подготовка исходной текстуры: изображение (upload/drag-drop/дефолтное divix-изображение вместо `antlii.github.io`-дефолта), видео (upload, HTML5 `<video>`-элемент как p5-текстура, покадровое чтение).
- **`src/difuso/js/dither.js`** — bayer/matrix/noise dithering через общий `ditherShader`, разные uniform’ы по `dither.matrix`/`dither.noise` типу.
- **`src/difuso/js/ascii.js`** — ASCII-текстура (глиф-атлас из TTF-шрифта) + шейдер рендеринга символов.
- **`src/difuso/js/halftone.js`** — halftone-шейдер (растровые точки, CMYK/neon/candy цветовые режимы).
- **`src/difuso/js/gradient.js`** — постобработка палитровым градиентом поверх результата dither/ascii/halftone-стадии.
- **`src/difuso/js/controls.js`** — декларативные SECTIONS для panelBuilder (dither type/matrix/noise/contrast/brightness/scale, ascii cols/rows/color-mode/font, halftone scale/smooth, gradient palette/saturation/reverse/use, canvas ratio/density, экспорт).
- **`src/difuso/js/app.js`** — сборка: `import p5 from 'p5'` (2.x), WEBGL-канвас, source-загрузка (image/video), per-frame выбор нужного шейдерного модуля по `dither.type`/`gradient.type`, композит, PNG/MP4-экспорт через существующий `shared/utils/exportMedia.js`, persistence.

Каждый шейдерный модуль — фабрика, принимающая `{ p, state }` (как `createForm`/`createRandomize` и т.д. в DIVIX), возвращающая функцию применения эффекта к текущему кадру. Прямых глобалей быть не должно — тот же принцип, что в Этапе 1.

## Состояние

`state.js` переносит: `cnv` (canvas ratio/density/scale/sens — без `poster`-конфига), `dither`, `gradient`, `rec` (без `object`-специфичных полей типа `obj.model`), `ratioTypes`/`resolutions`, `fontTypes` (15 шрифтов), словари опций для UI-выпадающих списков. НЕ переносится: `license`, `tool`, `obj`-блок (3D-модель — весь блок целиком, включая rotation/translate/scale/light-поля, откладывается вместе с 3D-этапом), `watermarkImageUrl`, poster-конфиг внутри `cnv.poster`.

## Пресеты, шрифты, ассеты

23 встроенных пресета (без ключа `** User Preset **`, добавляется динамически в app.js — тот же паттерн, что и `PRESET_TYPES` в DIVIX): 4×ASCII8, 3×ASCII16, 1×ASCII20, 5×Halftone, 3×Bayer, 3×Matrix, 5×Noise. Конвертируются тем же паттерном, что в задаче 6 Этапа 1: одноразовый, но воспроизводимый vm-скрипт `scripts/convert-difuso-presets.mjs`, читающий `reference/dithr/scripts/allpresets.js` (6263 строки) в изолированном node:vm-контексте, собирающий пресеты в `public/assets/difuso/presets.json` по именам из `PRESET_TYPES`.

15 TTF-шрифтов для ASCII-режима переносятся как статичные ассеты в `public/assets/difuso/fonts/*.ttf` (скачиваются с `antlii.github.io/assets/font/...`).

Дефолтное изображение — не используем `antlii.github.io/assets/images/default-image.webp` напрямую в проде; переносим тот же файл в `public/assets/difuso/default-image.webp` (аналогично тому, как в ritmo `refrac/default-image.webp` — свой локальный ассет, не внешняя ссылка на antlii.github.io).

## Экспорт

PNG/MP4 через уже существующие `shared/utils/exportMedia.js`-утилиты (`exportPNG`, `exportMP4`) — тот же паттерн, что в DIVIX. SVG-экспорта нет (в оригинале отсутствует).

## Порядок реализации

1. **state.js** — перенос state-объектов и словарей опций (см. раздел "Состояние").
2. **Пресеты и шрифты** — конвертер `scripts/convert-difuso-presets.mjs`, скачивание 15 TTF в `public/assets/difuso/fonts/`, дефолтное изображение в `public/assets/difuso/`.
3. **source.js** — загрузка изображения (upload/drag-drop/дефолт) и видео (upload, `<video>`-текстура).
4. **dither.js / ascii.js / halftone.js / gradient.js** — по одному модулю за раз, каждый со своим GLSL-шейдером, портированным из `reference/dithr/scripts/shader.js`/`ascii.js`/`gradient.js`. Шейдерный код (GLSL vertex/fragment) переносится как строковые константы внутри модуля (или отдельные `.glsl`-импорты, если Vite это поддерживает без доп. настройки — решается по ходу реализации, не блокирует дизайн).
5. **controls.js** — SECTIONS-панель, тот же паттерн, что в задаче 9 Этапа 1 (сверка диапазонов min/max/step по факту из `reference/dithr/scripts/ui.js`, а не предположения).
6. **app.js** — сборка воркспейса: `import p5 from 'p5'`, WEBGL-инициализация, source-загрузка, per-frame рендер-диспетчер, композит, экспорт, persistence, панель.
7. **Визуальная сверка** — против живого https://antlii.github.io/dithr-tool/, все 23 пресета + отдельно видео-режим на реальном видеофайле.
8. **README** — обновление секции DIFUSO с "shipped" вместо "Coming soon"; явно упомянуть, что 3D-режим отложен на будущий этап.

## Известные риски, требующие внимания при реализации

- **GLSL-шейдеры p5 1.x vs 2.x** — синтаксис/встроенные uniform-переменные/атрибуты могли измениться между мажорными версиями p5; шейдерный код переносится с построчной проверкой на совместимость с p5 2.2.3, не слепым копированием. Визуальная сверка (шаг 7) — финальная проверка на реальные расхождения.
- **API загрузки шрифтов** — `loadFont()` в p5 1.x — колбэк-стиль; в p5 2.x API мог измениться (возможно promise-based) — сверяется по официальной документации/changelog p5 2.x на моменте реализации source.js/ascii.js, не предполагается заранее.
- **Видео-текстуры в WEBGL-режиме** — `dithBuffer.shader(...)` + `gImg.texture(rec.video)`-паттерн завязан на `createGraphics(w, h, WEBGL)`; нужно подтвердить идентичное поведение в p5 2.x при реализации source.js.

## Критерии успеха

- DIFUSO визуально воспроизводит поведение оригинала DITHR для изображений и видео (сравнение с живым antlii.github.io/dithr-tool/), в рамках среза 1 (без 3D).
- Все 23 встроенных пресета перенесены и работают корректно.
- PNG/MP4 экспорт работает.
- p5 2.2.3 изолирован внутри DIFUSO-чанка, не затрагивает остальные пять воркспейсов и не ломает их сборку/рантайм.
- Сборка, линт и тесты проходят чисто.
