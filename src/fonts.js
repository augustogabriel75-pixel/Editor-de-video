/* Fontes empacotadas localmente (funcionam offline, inclusive no app Android). */
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/inter/latin-900.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/montserrat/latin-900.css';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/poppins/latin-900.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/pacifico/latin-400.css';
import '@fontsource/bangers/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';

/** Pré-carrega as fontes usadas pelo canvas (o canvas não dispara o download sozinho a tempo). */
const CANVAS_FONTS = [
  '800 16px Inter', '900 16px Inter', '500 16px Inter', '900 16px Montserrat', '800 16px Montserrat', '400 16px "Bebas Neue"',
  '700 16px Poppins', '900 16px Poppins', '700 16px "Space Grotesk"', '400 16px Pacifico', '400 16px Bangers',
];
if (typeof document !== 'undefined' && document.fonts?.load) {
  CANVAS_FONTS.forEach((f) => document.fonts.load(f).catch(() => {}));
}
