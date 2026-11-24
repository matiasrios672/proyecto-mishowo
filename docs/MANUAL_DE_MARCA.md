# Manual de marca — MiShowo

Versión web con muestras: `/marca` (sin indexar). Archivos del logo: `frontend/public/brand/` (`logo.png`, `logo-claro.png`, `isotipo.png`; original: `Logotipo naranja MiShowo.png`). Tokens de color y degradés: `frontend/src/app/globals.css` (bloque «Identidad de MiShowo»).

## Logo
- **Logotipo**: «Mi» en tinta + «Showo.» en naranja. Sobre fondo oscuro, `logo-claro.png`.
- **Isotipo**: M con punto en cuadrado redondeado naranja (favicon, perfiles, íconos).
- Espacio libre = altura de la «M». Mínimos: logotipo 96 px, isotipo 24 px. No estirar, girar, recolorear ni agregar sombras. El punto final no se saca.

## Colores
| Nombre | HEX | Uso |
|---|---|---|
| Naranja MiShowo | `#FC5502` | Botones principales con **texto tinta en negrita** (5,3:1; el blanco no llega a AA), logo, íconos, titulares grandes. Un solo botón naranja por pantalla |
| Naranja intenso | `#C73E00` | Links y texto de acento chico sobre fondo claro (AA 5,1:1). Nunca como relleno de botón |
| Ámbar sol | `#FFB000` | Segundo acento, final de degradés cálidos |
| Tinta | `#0E1B2C` | Texto principal, fondos oscuros |
| Crema | `#FFF7F1` | Fondos claros |
| Durazno | `#FFE2D0` | Fondos suaves, estados activos |
| Verde OK | `#15803D` | Solo confirmaciones |

## Degradés (siempre en diagonal, de cálido a cálido)
- **Brasa** (principal): `#FF8A00 → #FC5502 → #E03E00`, 135° · `--brand-gradient`
- **Sol**: `#FFB000 → #FF7A00 → #FC5502`, 135° · `--brand-gradient-sun`
- **Noche**: `#0E1B2C → #1B2B44 → #3A2A2A`, 160° · `--brand-gradient-night` (con logo claro)
- **Amanecer suave**: `#FFE2D0 → #FFF7F1`, 180° · `--brand-gradient-soft`

Un degradé por pieza; no detrás de texto largo.

## Tipografía y voz
Títulos: redonda gruesa (800), interlineado ajustado. Texto: sans-serif, mínimo 16 px. Voz rioplatense con voseo, frases cortas, sin jerga, honesta. Cada página de cliente lleva «Hecho por MiShowo».
