// Builds dist/demo.html: a single self-contained page running the real web client against the in-page API.
//   npm run build:demo
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });

const result = await build({
  entryPoints: [path.join(root, 'demo/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  platform: 'browser',
  minify: true,
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(root, 'web/styles.css'), 'utf8') + fs.readFileSync(path.join(root, 'demo/demo.css'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const bodyMarkup = shell.slice(shell.indexOf('<body>') + 6, shell.indexOf('</body>')).trim();

const page = `<title>DPA Zambia Compliance Platform</title>
<meta name="description" content="Browser demo of the Zambia data protection compliance platform">
<style>
${css}
</style>
${bodyMarkup}
<script>
${js}
</script>
`;
fs.writeFileSync(path.join(out, 'demo.html'), page);
console.log(`Wrote dist/demo.html (${(page.length / 1024).toFixed(0)} KB)`);
