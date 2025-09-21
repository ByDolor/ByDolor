// scripts/generate-snake.mjs
// Custom SVG snake generator for GitHub README
// No dependencies. Node 18+.
// Produces dist/snake.svg

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ========= Config (oynama noktaları) =========
const GRID_COLS = 52;          // genişlik (contribution grafiği tadında)
const GRID_ROWS = 12;          // yükseklik
const CELL = 12;               // piksel boyu
const GAP = 2;                 // hücre aralığı
const MARGIN = 16;             // kenar boşluk
const STEP_MS = 50;            // her kare kaç ms (hız)
const SNAKE_FLASH_MS = 120;    // mor vurgunun süresi
const BG = "#0f172a";          // arka plan (slate-900 gibi)
const DOT_BG = "#0b1220";      // yenmiş kare rengi (daha koyu)
const DOT1 = "#86efac";        // açık yeşil
const DOT2 = "#22c55e";        // orta yeşil
const DOT3 = "#16a34a";        // koyu yeşil
const DOT4 = "#065f46";        // en koyu yeşil
const TEXT_COLOR = DOT4;       // “ByDolor” yazısının tonu
const SNAKE_COLOR = "#7e22ce"; // mor vurgulama
const BAR_BG = "#134e4a";      // progress arka
const BAR_FG = "#10b981";      // progress dolan

// “ByDolor” yazısını 5x7 piksel font ile çizeceğiz:
const FONT = {
  // 5 sütun x 7 satır, '#' = dolu
  B: [
    "#### ",
    "#   #",
    "#   #",
    "#### ",
    "#   #",
    "#   #",
    "#### ",
  ],
  Y: [
    "#   #",
    "#   #",
    " # # ",
    "  #  ",
    "  #  ",
    "  #  ",
    "  #  ",
  ],
  D: [
    "###  ",
    "#  # ",
    "#   #",
    "#   #",
    "#   #",
    "#  # ",
    "###  ",
  ],
  O: [
    " ### ",
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    " ### ",
  ],
  L: [
    "#    ",
    "#    ",
    "#    ",
    "#    ",
    "#    ",
    "#    ",
    "#####",
  ],
  R: [
    "#### ",
    "#   #",
    "#   #",
    "#### ",
    "# #  ",
    "#  # ",
    "#   #",
  ],
};

// Metin: “ByDolor” (B, Y, D, O, L, O, R)
const TEXT_CHARS = ["B", "Y", "D", "O", "L", "O", "R"];
const CHAR_W = 5, CHAR_H = 7, CHAR_SPACE = 2; // 5x7 font + 2px boşluk

// ============================================

function buildTextMask() {
  // Toplam genişlik
  const totalCharWidth = TEXT_CHARS.length * CHAR_W + (TEXT_CHARS.length - 1) * CHAR_SPACE;
  // Izgara içinde ortala
  const gridW = GRID_COLS, gridH = GRID_ROWS;
  const startX = Math.floor((gridW - totalCharWidth) / 2);
  const startY = Math.floor((gridH - CHAR_H) / 2);

  // Boş maske
  const mask = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));

  // Her harfi sırayla yerleştir
  let cursorX = startX;
  for (const ch of TEXT_CHARS) {
    const pat = FONT[ch];
    if (!pat) { cursorX += CHAR_W + CHAR_SPACE; continue; }
    for (let r = 0; r < CHAR_H; r++) {
      for (let c = 0; c < CHAR_W; c++) {
        if (pat[r][c] === "#") {
          const gx = cursorX + c;
          const gy = startY + r;
          if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
            mask[gy][gx] = true;
          }
        }
      }
    }
    cursorX += CHAR_W + CHAR_SPACE;
  }
  return mask;
}

function cellX(col) {
  return MARGIN + col * (CELL + GAP);
}
function cellY(row) {
  return MARGIN + row * (CELL + GAP);
}

function pickDotColor(col, row, textMask) {
  // Harfler koyu tonda dursun
  if (textMask[row][col]) return TEXT_COLOR;
  // Diğer kareler 4 seviyeden rastgele/tekrarlı dağıtım
  const mix = (col * 131 + row * 29) % 4;
  return [DOT1, DOT2, DOT3, DOT4][mix];
}

function buildEatOrder(textMask) {
  const nonText = [];
  const text = [];
  // “Önce çevre yemleri, sonra yazı” için: dıştan içe tarama
  // Basitçe: satır satır tarayıp önce text=false olanları sıraya koy, sonra text=true olanlar.
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      (textMask[r][c] ? text : nonText).push({ r, c });
    }
  }
  // Non-text’i serpme bir görünüm için “yılan izi” hissi: sağ-sol kırpma düzeni
  const serp = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const rowCells = nonText.filter(k => k.r === r);
    if (r % 2 === 0) rowCells.sort((a, b) => a.c - b.c);
    else rowCells.sort((a, b) => b.c - a.c);
    serp.push(...rowCells);
  }
  const letters = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const rowCells = text.filter(k => k.r === r);
    // Yine serp yapısı
    if (r % 2 === 0) rowCells.sort((a, b) => a.c - b.c);
    else rowCells.sort((a, b) => b.c - a.c);
    letters.push(...rowCells);
  }
  return [...serp, ...letters];
}

function generateSVG() {
  const textMask = buildTextMask();
  const order = buildEatOrder(textMask);
  const totalSteps = order.length;
  const W = MARGIN * 2 + GRID_COLS * CELL + (GRID_COLS - 1) * GAP;
  const H = MARGIN * 2 + GRID_ROWS * CELL + (GRID_ROWS - 1) * GAP + 40; // + progress bar

  const barX = MARGIN;
  const barY = H - 28;
  const barW = W - MARGIN * 2;
  const barH = 12;

  let rects = "";
  // Tüm hücreleri çiz ve animasyon ekle
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const x = cellX(c), y = cellY(r);
      const baseColor = pickDotColor(c, r, textMask);

      // Bu hücre kaçıncı adımda yeniyor?
      const idx = order.findIndex(k => k.r === r && k.c === c);
      const begin = idx < 0 ? 0 : idx * STEP_MS;
      const flashEnd = begin + SNAKE_FLASH_MS;
      const endFill = DOT_BG;

      // İki aşama: mor -> koyu
      const animFlash = idx >= 0
        ? `<animate attributeName="fill" values="${baseColor};${SNAKE_COLOR}" begin="${begin}ms" dur="${SNAKE_FLASH_MS}ms" fill="freeze" />`
        : "";
      const animDark = idx >= 0
        ? `<animate attributeName="fill" values="${SNAKE_COLOR};${endFill}" begin="${flashEnd}ms" dur="${Math.max(1, STEP_MS)}ms" fill="freeze" />`
        : "";

      rects += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${baseColor}">
        ${animFlash}${animDark}
      </rect>\n`;
    }
  }

  // Progress bar (genel zaman çizgisi)
  const totalDur = totalSteps * STEP_MS + SNAKE_FLASH_MS + 200;
  const bar = `
    <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" fill="${BAR_BG}" rx="6" ry="6"/>
    <rect x="${barX}" y="${barY}" width="0" height="${barH}" fill="${BAR_FG}" rx="6" ry="6">
      <animate attributeName="width" from="0" to="${barW}" dur="${totalDur}ms" fill="freeze"/>
    </rect>
  `;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="${BG}"/>
  ${rects}
  ${bar}
</svg>`;

  return svg;
}

function main() {
  const svg = generateSVG();
  const out = "dist/snake.svg";
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg, "utf8");
  console.log(`Wrote ${out}`);
}

main();
