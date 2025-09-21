// scripts/generate-snake.mjs
// Custom SVG snake generator for GitHub README (Node 18+)

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ========= Config =========
const GRID_COLS = 52;
const GRID_ROWS = 12;
const CELL = 12;
const GAP = 2;
const MARGIN = 16;

const STEP_MS = 110;            // adım süresi (yavaş/hızlı)
const SNAKE_SEGMENT = 5;        // mor segment uzunluğu
const SNAKE_FLASH_MS = STEP_MS * SNAKE_SEGMENT;

const BG = "#0f172a";           // arka plan
const DOT_BG = "#0b1220";       // yenmiş kare rengi

// GitHub koyu paletine yakın yeşiller
const DOT1 = "#0e4429";
const DOT2 = "#006d32";
const DOT3 = "#26a641";
const DOT4 = "#39d353";

// “ByDolor” harfleri için daha koyu yeşil
const TEXT_COLOR = "#003d1f";

const SNAKE_COLOR = "#3e1142";  // mor
const BAR_BG = "#134e4a";
const BAR_FG = "#10b981";

// 5x7 font tanımı
const FONT = {
  B: ["#### ","#   #","#   #","#### ","#   #","#   #","#### "],
  Y: ["#   #","#   #"," # # ","  #  ","  #  ","  #  ","  #  "],
  D: ["###  ","#  # ","#   #","#   #","#   #","#  # ","###  "],
  O: [" ### ","#   #","#   #","#   #","#   #","#   #"," ### "],
  L: ["#    ","#    ","#    ","#    ","#    ","#    ","#####"],
  R: ["#### ","#   #","#   #","#### ","# #  ","#  # ","#   #"],
};

const TEXT_CHARS = ["B","Y","D","O","L","O","R"];
const CHAR_W = 5, CHAR_H = 7, CHAR_SPACE = 2;
// ==========================

function buildTextMask() {
  const totalCharWidth = TEXT_CHARS.length * CHAR_W + (TEXT_CHARS.length - 1) * CHAR_SPACE;
  const startX = Math.floor((GRID_COLS - totalCharWidth) / 2);
  const startY = Math.floor((GRID_ROWS - CHAR_H) / 2);
  const mask = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));

  let x = startX;
  for (const ch of TEXT_CHARS) {
    const pat = FONT[ch];
    for (let r = 0; r < CHAR_H; r++) {
      for (let c = 0; c < CHAR_W; c++) {
        if (pat[r][c] === "#") {
          const gx = x + c, gy = startY + r;
          if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) mask[gy][gx] = true;
        }
      }
    }
    x += CHAR_W + CHAR_SPACE;
  }
  return mask;
}

const cellX = (col) => MARGIN + col * (CELL + GAP);
const cellY = (row) => MARGIN + row * (CELL + GAP);

function pickDotColor(col, row, textMask) {
  if (textMask[row][col]) return TEXT_COLOR;      // “ByDolor” daha koyu
  // Tonları yaymak için hafif deterministik dağıtım
  const mix = (col * 131 + row * 29) % 4;
  return [DOT1, DOT2, DOT3, DOT4][mix];
}

// Diyagonal ilerleme: sol-üst → sağ-alt (istediğin “şekil”)
function buildEatOrder(textMask) {
  const nonText = [], text = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      (textMask[r][c] ? text : nonText).push({ r, c });
    }
  }
  // Diyagonal sıralama: s = r + c artan
  const diagSort = (a, b) => (a.r + a.c) - (b.r + b.c);
  nonText.sort(diagSort);
  text.sort(diagSort); // yazıyı en sona bırakacağız
  return [...nonText, ...text];
}

function generateSVG() {
  const textMask = buildTextMask();
  const order = buildEatOrder(textMask);
  const totalSteps = order.length;

  const W = MARGIN*2 + GRID_COLS*CELL + (GRID_COLS-1)*GAP;
  const H = MARGIN*2 + GRID_ROWS*CELL + (GRID_ROWS-1)*GAP + 40;

  const barX = MARGIN, barY = H - 28, barW = W - MARGIN*2, barH = 12;

  const totalDur = totalSteps * STEP_MS + SNAKE_FLASH_MS + 200;

  // Loop için görünmez timeline
  const timeline = `
    <rect x="-10" y="-10" width="1" height="1" fill="none" opacity="0">
      <animate id="tl" attributeName="opacity" from="0" to="0"
               dur="${totalDur}ms" begin="0s;tl.end" />
    </rect>
  `;

  let rects = "";
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const x = cellX(c), y = cellY(r);
      const baseColor = pickDotColor(c, r, textMask);

      const idx = order.findIndex(k => k.r === r && k.c === c);
      const begin = idx < 0 ? 0 : idx * STEP_MS;
      const flashEnd = begin + SNAKE_FLASH_MS;
      const endFill = DOT_BG;

      const animFlash = idx >= 0
        ? `<animate attributeName="fill" values="${baseColor};${SNAKE_COLOR}"
                    begin="tl.begin+${begin}ms" dur="${SNAKE_FLASH_MS}ms" fill="freeze" />`
        : "";
      const animDark = idx >= 0
        ? `<animate attributeName="fill" values="${SNAKE_COLOR};${endFill}"
                    begin="tl.begin+${flashEnd}ms" dur="${Math.max(1, STEP_MS)}ms" fill="freeze" />`
        : "";

      rects += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" ry="3" fill="${baseColor}">
        ${animFlash}${animDark}
      </rect>\n`;
    }
  }

  const bar = `
    <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" fill="${BAR_BG}" rx="6" ry="6"/>
    <rect x="${barX}" y="${barY}" width="0" height="${barH}" fill="${BAR_FG}" rx="6" ry="6">
      <animate attributeName="width" from="0" to="${barW}" begin="tl.begin" dur="${totalDur}ms" fill="freeze"/>
    </rect>
  `;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="${BG}"/>
  ${timeline}
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
