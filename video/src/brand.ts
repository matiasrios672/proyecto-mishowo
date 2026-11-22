import { loadFont as loadDisplay } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadText } from "@remotion/google-fonts/Figtree";

// Identidad de MiShowo: celeste y sol de la bandera argentina sobre tinta azul.
export const C = {
  celeste: "#74ACDF",
  celesteDeep: "#2F6FB0",
  sol: "#F6B40E",
  tinta: "#0E1B2C",
  cielo: "#EAF4FC",
  blanco: "#FFFFFF",
  wa: "#DCF8C6",
};

export const display = loadDisplay("normal", { weights: ["700", "800"], subsets: ["latin"] }).fontFamily;
export const text = loadText("normal", { weights: ["400", "600", "700"], subsets: ["latin"] }).fontFamily;
