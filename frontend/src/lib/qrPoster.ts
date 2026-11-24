import QRCode from "qrcode";

const INK = "#0E1B2C";
const BLUE = "#C73E00";
const YELLOW = "#F6B40E";
export const POSTER_W = 1080;
export const POSTER_H = 1528;

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Parte el texto en renglones que entren en `max` px (para nombres largos). */
function wrap(c: CanvasRenderingContext2D, text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    const t = cur ? `${cur} ${w}` : w;
    if (c.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  if (out.length > lines) { const keep = out.slice(0, lines); keep[lines - 1] = `${keep[lines - 1]}…`; return keep; }
  return out;
}

/** Carga una imagen de /public; si falla, el cartel se arma igual con texto. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src; });
}

/** Dibuja el cartel con la identidad de MiShowo y devuelve un PNG (data URL). Solo corre en el navegador. */
export async function renderQrPoster(opts: { url: string; name: string; display: string }): Promise<string> {
  const { url, name, display } = opts;
  const cv = document.createElement("canvas");
  cv.width = POSTER_W; cv.height = POSTER_H;
  const c = cv.getContext("2d")!;
  const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // Fondo: celeste de marca con brillos
  const bg = c.createLinearGradient(0, 0, POSTER_W, POSTER_H);
  bg.addColorStop(0, "#FFE2D0"); bg.addColorStop(0.55, "#FFF7F1"); bg.addColorStop(1, "#FAC9A8");
  c.fillStyle = bg; c.fillRect(0, 0, POSTER_W, POSTER_H);
  for (const [x, y, r, a] of [[0, 0, 520, 0.5], [POSTER_W, POSTER_H, 600, 0.42]] as const) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(116,172,223,${a})`); g.addColorStop(1, "rgba(116,172,223,0)");
    c.fillStyle = g; c.fillRect(0, 0, POSTER_W, POSTER_H);
  }

  // Cabecera con el logo de MiShowo
  const [logo, isotipo] = await Promise.all([loadImage("/brand/logo.png"), loadImage("/brand/isotipo.png")]);
  c.textBaseline = "alphabetic";
  if (logo) { const h = 64; c.drawImage(logo, 72, 62, (logo.width / logo.height) * h, h); }
  else { c.fillStyle = INK; c.font = `800 52px ${sans}`; c.fillText("MiShowo.", 72, 112); }

  // Nombre del negocio
  c.fillStyle = INK; c.font = `800 92px ${sans}`;
  const lines = wrap(c, name || "Mi negocio", POSTER_W - 144, 2);
  lines.forEach((l, i) => c.fillText(l, 72, 290 + i * 100));
  const afterName = 290 + (lines.length - 1) * 100;
  c.fillStyle = "#47566A"; c.font = `500 40px ${sans}`;
  c.fillText("Mirá el catálogo y pedí por WhatsApp", 72, afterName + 70);

  // Tarjeta del QR
  const cardS = 700, cardX = (POSTER_W - cardS) / 2, cardY = afterName + 110;
  c.save();
  c.shadowColor = "rgba(252,85,2,0.45)"; c.shadowBlur = 70; c.shadowOffsetY = 30;
  c.fillStyle = "#FFFFFF"; rr(c, cardX, cardY, cardS, cardS, 56); c.fill();
  c.restore();

  // QR con módulos redondeados y ojos de marca
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size, data = qr.modules.data;
  const pad = 56, cell = (cardS - pad * 2) / n, ox = cardX + pad, oy = cardY + pad;
  const isEye = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  c.fillStyle = INK;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!data[y * n + x] || isEye(x, y)) continue;
    const pxl = cell * 0.88; const o = (cell - pxl) / 2;
    rr(c, ox + x * cell + o, oy + y * cell + o, pxl, pxl, pxl * 0.38); c.fill();
  }
  for (const [ex, ey] of [[0, 0], [n - 7, 0], [0, n - 7]] as const) {
    const x = ox + ex * cell, y = oy + ey * cell;
    c.fillStyle = BLUE; rr(c, x, y, cell * 7, cell * 7, cell * 2); c.fill();
    c.fillStyle = "#FFFFFF"; rr(c, x + cell, y + cell, cell * 5, cell * 5, cell * 1.3); c.fill();
    c.fillStyle = INK; rr(c, x + cell * 2, y + cell * 2, cell * 3, cell * 3, cell * 0.9); c.fill();
  }
  // Marca en el centro (el QR usa corrección H, tolera tapar ~20 %)
  const mid = cardX + cardS / 2, midY = cardY + cardS / 2, lg = cell * 6.2;
  c.fillStyle = "#FFFFFF"; rr(c, mid - lg / 2, midY - lg / 2, lg, lg, lg * 0.28); c.fill();
  if (isotipo) c.drawImage(isotipo, mid - lg * 0.42, midY - lg * 0.42, lg * 0.84, lg * 0.84);
  c.textAlign = "center"; c.textBaseline = "middle";

  // Botón amarillo y link
  const pillY = cardY + cardS + 50, pillW = 640, pillH = 112;
  c.fillStyle = YELLOW; rr(c, (POSTER_W - pillW) / 2, pillY, pillW, pillH, 56); c.fill();
  c.fillStyle = INK; c.font = `800 52px ${sans}`;
  c.fillText("Escaneá y pedí", POSTER_W / 2, pillY + pillH / 2 + 3);
  c.fillStyle = BLUE; c.font = `700 44px ${sans}`;
  c.fillText(display, POSTER_W / 2, pillY + pillH + 70);

  // Pie
  c.fillStyle = "#47566A"; c.font = `600 30px ${sans}`;
  c.fillText("Hecho por MiShowo", POSTER_W / 2, POSTER_H - 40);
  return cv.toDataURL("image/png");
}
