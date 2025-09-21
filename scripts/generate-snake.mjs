// scripts/generate-snake.mjs
// Custom 2-phase SVG snake for GitHub README (Node 18+)

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ========= Config =========
const GRID_COLS = 52;
const GRID_ROWS = 12;
const CELL = 12;
const GAP = 2;
const MARGIN = 16;

// Faz-1: yeme hızı ve yılan uzunluğu
const STEP_MS = 50;                 // daha yavaş = daha büyük
const SNAKE_SEGMENT = 5;
const SNAKE_FLASH_MS = STEP_MS * SNAKE_SEGMENT;

// Renkler (GitHub koyu tema yeşillerine yakın)
const BG = "#0f172a";
const DOT_BG = "#0b1220";
const DOT1 = "#0e4429";
const DOT2 = "#006d32";
const DOT3 = "#26a641";
const DOT4 = "#39d353";
const TEXT_COLOR = "#003d1f";        // “ByDolor” daha koyu yeşil
const SNAKE_COLOR = "#7e22ce";       // mor

// Progress bar (sadece Faz-1’de)
const BAR_BG = "#134e4a";
const BAR_FG = "#10b981";

// Faz-2 alt sıra yılanı (sol<->sağ ping-pong)
const BOTTOM_ROW = GRID_ROWS - 1;
const PHASE2_DUR_MS = 6000;          // bir gidiş-dönüş süresi

// 5x7 font
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

// ========= Helpers =========
const cellX = (c) => MARGIN + c * (CELL + GAP);
const cellY = (r) => MARGIN + r * (CELL + GAP);

function buildTextMask() {
  const totalW = TEXT_CHARS.length * CHAR_W + (TEXT_CHARS.length - 1) * CHAR_SPACE;
  const startX = Math.floor((GRID_COLS - totalW) / 2);
  const startY = Math.floor((GRID_ROWS - CHAR_H) / 2);
  const mask = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
  let x = startX;
  for (const ch of TEXT_CHARS) {
    const pat = FONT[ch];
    for (let r = 0; r < CHAR_H; r++) {
      for (let c = 0; c < CHAR_W; c++) {
        if (pat[r][c] === "#") {
          const gx = x + c, gy = startY + r;
          if (gx>=0 && gx<GRID_COLS && gy>=0 && gy<GRID_ROWS) mask[gy][gx] = true;
        }
      }
    }
    x += CHAR_W + CHAR_SPACE;
  }
  return mask;
}

function pickDotColor(c, r, textMask) {
  if (textMask[r][c]) return TEXT_COLOR;     // ByDolor koyu yeşil
  const mix = (c * 131 + r * 29) % 4;
  return [DOT1, DOT2, DOT3, DOT4][mix];
}

// Faz-1 için: önce yazı dışı, sonra yazı; diyagonal (r+c) sıralı
function buildEatOrder(textMask) {
  const nonText = [], text = [];
  for (let r=0;r<GRID_ROWS;r++)
    for (let c=0;c<GRID_COLS;c++)
      (textMask[r][c] ? text : nonText).push({r,c});
  const diag = (a,b)=>(a.r+a.c)-(b.r+b.c);
  nonText.sort(diag);
  text.sort(diag);
  return [...nonText, ...text];
}

// ========= SVG Generation =========
function generateSVG() {
  const textMask = buildTextMask();
  const order = buildEatOrder(textMask);
  const totalSteps = order.length;

  const W = MARGIN*2 + GRID_COLS*CELL + (GRID_COLS-1)*GAP;
  const H = MARGIN*2 + GRID_ROWS*CELL + (GRID_ROWS-1)*GAP + 40;

  // Faz-1 toplam süre
  const totalDur1 = totalSteps * STEP_MS + SNAKE_FLASH_MS + 200;

  // TL1: Faz-1 master timeline (bir kez çalışır)
  // TL2: Faz-2 master timeline (sonsuz döngü)
  const timelines = `
    <rect x="-10" y="-10" width="1" height="1" fill="none" opacity="0">
      <animate id="tl1" attributeName="opacity" from="0" to="0" dur="${totalDur1}ms" begin="0s" />
    </rect>
    <rect x="-10" y="-10" width="1" height="1" fill="none" opacity="0">
      <animate id="tl2" attributeName="opacity" from="0" to="0" dur="${PHASE2_DUR_MS}ms" begin="tl1.end;tl2.end" />
    </rect>
  `;

  // Hücreler + Faz-1 animasyonları + Faz-2 reset
  let rects = "";
  for (let r=0;r<GRID_ROWS;r++) {
    for (let c=0;c<GRID_COLS;c++) {
      const x = cellX(c), y = cellY(r);
      const baseColor = pickDotColor(c, r, textMask);
      const idx = order.findIndex(k => k.r===r && k.c===c);
      const begin = idx<0 ? 0 : idx*STEP_MS;
      const flashEnd = begin + SNAKE_FLASH_MS;

      // Faz-1: mor -> koyu (yenmiş)
      const animFlash = idx>=0 ? `<animate attributeName="fill" values="${baseColor};${SNAKE_COLOR}"
                                  begin="tl1.begin+${begin}ms" dur="${SNAKE_FLASH_MS}ms" fill="freeze" />` : "";
      const animDark  = idx>=0 ? `<animate attributeName="fill" values="${SNAKE_COLOR};${DOT_BG}"
                                  begin="tl1.begin+${flashEnd}ms" dur="${Math.max(1, STEP_MS)}ms" fill="freeze" />` : "";

      // Faz-2 başında: ekranda sadece yazı kalsın
      const phase2Fill = textMask[r][c] ? TEXT_COLOR : DOT_BG;
      const animReset2 = `<animate attributeName="fill" to="${phase2Fill}"
                                begin="tl2.begin" dur="1ms" fill="freeze" />`;

      rects += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" ry="3" fill="${baseColor}">
        ${animFlash}${animDark}${animReset2}
      </rect>\n`;
    }
  }

  // Faz-1 progress bar (isteğe bağlı görsel)
  const barX = MARGIN, barY = H - 28, barW = W - MARGIN*2, barH = 12;
  const barPhase1 = `
    <g>
      <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" fill="${BAR_BG}" rx="6" ry="6"/>
      <rect x="${barX}" y="${barY}" width="0" height="${barH}" fill="${BAR_FG}" rx="6" ry="6">
        <animate attributeName="width" from="0" to="${barW}" begin="tl1.begin" dur="${totalDur1}ms" fill="freeze"/>
      </rect>
    </g>
  `;

  // Faz-2: altta 5 mor blok – YALNIZCA FAZ-1 BİTİNCE görünür, sonra ping-pong loop
  const leftX = cellX(0);
  const rightX = cellX(GRID_COLS - 5); // 5'lik trenin sığacağı en sağ konum
  const yBottom = cellY(BOTTOM_ROW);

  let phase2Snake = `<g id="phase2-snake" opacity="0" transform="translate(0,0)">
    <!-- Faz-1 bittiğinde görünür -->
    <animate attributeName="opacity" from="0" to="1" begin="tl1.end" dur="1ms" fill="freeze"/>
  `;
  // 5 ardışık blok (tren)
  for (let i=0;i<5;i++) {
    const bx = leftX + i * (CELL + GAP);
    phase2Snake += `<rect x="${bx}" y="${yBottom}" width="${CELL}" height="${CELL}" rx="3" ry="3" fill="${SNAKE_COLOR}"/>`;
  }
  // Grubu yatayda ping-pong hareket ettir
  const dx = rightX - leftX;
  phase2Snake += `
    <animateTransform attributeName="transform" attributeType="XML" type="translate"
                      values="0 0; ${dx} 0; 0 0" keyTimes="0;0.5;1"
                      begin="tl2.begin" dur="${PHASE2_DUR_MS}ms" repeatCount="indefinite"/>
  </g>`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="${BG}"/>
  ${timelines}
  ${rects}
  ${barPhase1}
  ${phase2Snake}
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
