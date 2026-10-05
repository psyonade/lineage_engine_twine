import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

function parseTweeFiles(tweeDir) {
  const files = fs.readdirSync(tweeDir).filter(f => f.endsWith('.twee'));
  const passages = [];
  let pidCounter = 1;
  let storyData = { name: 'The Lineage Engine', startNodePid: 1 };

  for (const file of files) {
    const content = fs.readFileSync(path.join(tweeDir, file), 'utf-8');
    const lines = content.split(/\r?\n/);
    let currentPassage = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('::')) {
        if (currentPassage) {
          passages.push(currentPassage);
        }
        const header = line.substring(2).trim();
        const match = header.match(/^([^\[\{]+)(?:\[(.*?)\])?\s*(?:\{(.*?)\})?$/);
        const name = match ? match[1].trim() : header;
        const tagsStr = match && match[2] ? match[2].trim() : '';
        const metaStr = match && match[3] ? match[3].trim() : '';

        currentPassage = {
          pid: pidCounter++,
          name: name,
          tags: tagsStr,
          meta: metaStr,
          textLines: []
        };
      } else if (currentPassage) {
        currentPassage.textLines.push(line);
      }
    }
    if (currentPassage) {
      passages.push(currentPassage);
    }
  }

  passages.forEach(p => {
    p.text = p.textLines.join('\n').trim();
    delete p.textLines;
  });

  const storyDataPassage = passages.find(p => p.name === 'StoryData');
  if (storyDataPassage) {
    try {
      const json = JSON.parse(storyDataPassage.text);
      if (json.name) storyData.name = json.name;
      if (json.start) storyData.startName = json.start;
    } catch (e) {
      console.warn('Could not parse StoryData JSON:', e.message);
    }
  }

  if (storyData.startName) {
    const startP = passages.find(p => p.name === storyData.startName);
    if (startP) {
      storyData.startNodePid = startP.pid;
    }
  }

  return { passages, storyData };
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function build() {
  console.log('Building Lineage Engine...');

  const jsResult = await esbuild.build({
    entryPoints: [path.join(srcDir, 'scripts', 'index.js')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'LineageEngineBundle',
    target: 'es2020',
  });

  const bundledJs = jsResult.outputFiles[0].text;

  const cssPath = path.join(srcDir, 'styles', 'main.css');
  const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8') : '';

  const tweeDir = path.join(srcDir, 'twee');
  const { passages, storyData } = parseTweeFiles(tweeDir);

  const passageElements = passages.map(p => {
    return `  <tw-passagedata pid="${p.pid}" name="${escapeHtml(p.name)}" tags="${escapeHtml(p.tags)}">${escapeHtml(p.text)}</tw-passagedata>`;
  }).join('\n');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(storyData.name)}</title>
  <style>
${cssContent}
  </style>
</head>
<body>
  <div id="init-screen">Loading The Lineage Engine...</div>
  <tw-storydata name="${escapeHtml(storyData.name)}" startnode="${storyData.startNodePid}" creator="Tweego / Lineage Engine" creator-version="2.1.1" format="SugarCube" format-version="2.36.1" options="" hidden>
${passageElements}
  </tw-storydata>

  <script>
${bundledJs}
  </script>
  <script>
    function startApp() {
      if (window.setup && window.setup.Lineage && window.setup.Lineage.initStandaloneApp) {
        window.setup.Lineage.initStandaloneApp();
      }
    }
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', startApp);
    } else {
      startApp();
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent, 'utf-8');
  console.log('Successfully built dist/index.html!');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
