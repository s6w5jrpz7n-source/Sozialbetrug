// Baut den Web-Ordner "www/" für Capacitor: kopiert nur die Laufzeit-Dateien
// des Spiels (keine node_modules, kein android/, keine Editor-/Build-Tools)
// UND bündelt Phaser lokal, damit die App OFFLINE läuft (kein CDN nötig).
//   Aufruf:  npm run build:www   (oder automatisch über npm run sync)
import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { extname } from 'path';

const OUT = 'www';
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// 1) Feste Ordner
if (existsSync('assets')) cpSync('assets', `${OUT}/assets`, { recursive: true });

// 2) script.js
if (existsSync('script.js')) cpSync('script.js', `${OUT}/script.js`);

// 3) Alle Medien-Dateien im Wurzelverzeichnis (Bilder, Audio, Icons)
const mediaExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.ogg', '.wav', '.ico']);
for (const f of readdirSync('.')) {
  if (mediaExt.has(extname(f).toLowerCase())) cpSync(f, `${OUT}/${f}`);
}

// 4) Layout-JSONs (werden zur Laufzeit geladen)
mkdirSync(`${OUT}/layout`, { recursive: true });
for (const f of ['layout/layout.json', 'layout/collision.json']) {
  if (existsSync(f)) cpSync(f, `${OUT}/${f}`);
}

// 5) Phaser lokal bündeln (Offline) + index.html auf die lokale Datei umbiegen
let html = readFileSync('index.html', 'utf8');
const phaserSrc = 'node_modules/phaser/dist/phaser.min.js';
if (existsSync(phaserSrc)) {
  mkdirSync(`${OUT}/vendor`, { recursive: true });
  cpSync(phaserSrc, `${OUT}/vendor/phaser.min.js`);
  html = html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/phaser@[^"]+"><\/script>/,
                      '<script src="vendor/phaser.min.js"></script>');
  console.log('✅ Phaser lokal gebündelt (Offline-fähig)');
} else {
  console.log('⚠️  node_modules/phaser fehlt – erst "npm install" ausführen! (sonst CDN/Internet nötig)');
}
writeFileSync(`${OUT}/index.html`, html);

console.log('✅ www/ gebaut – bereit für: npx cap sync');
