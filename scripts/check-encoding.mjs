import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'target', 'coverage']);
const checkedExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json',
  '.md', '.yml', '.yaml', '.css', '.html', '.toml', '.rs', '.ps1',
]);
const mojibakePatterns = [
  /Р[‘’“”„…†‡€‰Љ‹ЊЌЋЏђљ›њќћџ ЎўЈҐЁЄЇІіґё№єјЅѕї°±¤¦§©®µ¶·]/u,
  /Р[а-яё]Р[а-яё]/u,
  /С[‚„…†‡€‰Љ‹ЊЌЋЏђљ›њќћџ]/u,
  /С[а-яё][РС][а-яё]/u,
  /вЂ[™”¦]/u,
  new RegExp(String.fromCharCode(0x412, 0xB7), 'u'),
];
const failures = [];

function inspectFile(filePath) {
  const relativePath = path.relative(repositoryRoot, filePath).split(path.sep).join('/');
  const buffer = fs.readFileSync(filePath);
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    failures.push(`${relativePath}: UTF-8 BOM is not allowed`);
  }
  const content = buffer.toString('utf8');
  if (content.includes('\uFFFD')) {
    failures.push(`${relativePath}: replacement character found; file may contain invalid UTF-8`);
  }
  for (const pattern of mojibakePatterns) {
    if (pattern.test(content)) {
      failures.push(`${relativePath}: probable mojibake matched ${pattern}`);
      break;
    }
  }
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && checkedExtensions.has(path.extname(entry.name).toLowerCase())) {
      inspectFile(fullPath);
    }
  }
}

walk(repositoryRoot);
if (failures.length > 0) {
  console.error('Source encoding check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Source encoding check passed.');
}
