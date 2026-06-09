// Baut den Web-Ordner "www/" für Capacitor: kopiert nur die Laufzeit-Dateien
// des Spiels (keine node_modules, kein android/, keine Editor-/Build-Tools).
//   Aufruf:  npm run build:www   (oder automatisch über npm run sync)
import { cpSync, mkdirSync, rmSync, existsSync, readdirSync } from 'fs';
import { extname } from 'path';

const OUT = 'www';
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// 1) Feste Dateien/Ordner
const fix = ['index.html', 'script.js', 'assets', 'vendor'];
for (const f of fix) if (existsSync(f)) cpSync(f, `${OUT}/${f}`, { recursive: true });

// 2) Alle Medien-Dateien im Wurzelverzeichnis (Bilder, Audio, Icons)
const mediaExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.ogg', '.wav', '.ico']);
for (const f of readdirSync('.')) {
  if (mediaExt.has(extname(f).toLowerCase())) cpSync(f, `${OUT}/${f}`);
}

// 3) Layout-JSONs (werden zur Laufzeit geladen)
mkdirSync(`${OUT}/layout`, { recursive: true });
for (const f of ['layout/layout.json', 'layout/collision.json']) {
  if (existsSync(f)) cpSync(f, `${OUT}/${f}`);
}

console.log('✅ www/ gebaut – bereit für: npx cap sync');
