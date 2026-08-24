/* Fold the demo into one self-contained page.
 *
 *   node build-artifact.mjs            → portal-orcs.html (standalone)
 *   node build-artifact.mjs --artifact → artifact.html (body only, for
 *                                        publishing, where the host supplies
 *                                        the <!doctype>/<head>/<body> shell)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bodyOnly = process.argv.includes('--artifact');

const html = readFileSync(join(here, 'index.html'), 'utf8');
const css = readFileSync(join(here, 'style.css'), 'utf8');

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
if (!scripts.length) throw new Error('no <script src> tags found in index.html');
const js = scripts.map(s => `/* ── ${s} ── */\n${readFileSync(join(here, s), 'utf8')}`).join('\n');

const body = html.match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/\s*<script src="[^"]+"><\/script>/g, '')
  .trim();

const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Grenze+Gotisch:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">`;

const head = `<title>Orcs &amp; Apertures</title>\n${fonts}\n<style>\n${css}</style>`;
const main = `${body}\n\n<script>\n${js}\n</script>`;

if (bodyOnly) {
  writeFileSync(join(here, 'artifact.html'), `${head}\n\n${main}\n`);
  console.log('wrote artifact.html');
} else {
  writeFileSync(join(here, 'portal-orcs.html'), [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    head,
    '</head>',
    '<body>',
    main,
    '</body>',
    '</html>', ''
  ].join('\n'));
  console.log('wrote portal-orcs.html');
}
