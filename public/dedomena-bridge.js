#!/usr/bin/env node
/**
 * dedomena-bridge v2 — local filesystem agent for dedomena
 *
 * Run:  node dedomena-bridge.js [root-path]
 * Default root: your home directory (~).
 *
 * Listens on http://127.0.0.1:7432 — localhost only.
 * Nothing leaves your machine.
 *
 * Endpoints:
 *   GET  /status   → health + root path
 *   POST /search   → smart search: keywords in filenames AND content
 *   POST /read     → read a specific file
 *   POST /list     → list a directory
 */

'use strict';

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { execSync } = require('child_process');

const PORT = 7432;
const ROOT = path.resolve(process.argv[2] || os.homedir());

// ── File types searched for CONTENT ───────────────────────────────────────
const TEXT_EXTS = new Set([
  '.txt', '.md', '.mdx', '.rst', '.csv', '.tsv',
  '.json', '.jsonl', '.yaml', '.yml', '.toml', '.ini', '.env', '.conf',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.cpp', '.c', '.h', '.cs',
  '.html', '.css', '.scss', '.sql', '.sh', '.bash', '.zsh', '.ps1',
  '.xml', '.log', '.diff', '.patch', '.tex', '.bib',
]);

// All file types indexed (content search for text, name-only for the rest)
const ALL_EXTS = new Set([
  ...TEXT_EXTS,
  '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls',
  '.zip', '.tar', '.gz', '.mp4', '.mp3', '.png', '.jpg', '.jpeg',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', '.next',
  '__pycache__', '.pytest_cache', 'venv', '.venv', 'env',
  '.idea', '.vscode', 'AppData', 'Application Data',
]);

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_RESULTS   = 20;
const SNIPPET_LINES = 15;
const SNIPPET_MAX   = 1000;

// ── Stop words stripped before searching ─────────────────────────────────
const STOP = new Set([
  'a','an','the','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should','may','might',
  'i','you','he','she','it','we','they','me','him','her','us','them',
  'what','which','who','whom','this','that','these','those',
  'and','but','or','nor','for','yet','so','in','on','at','to','of','with',
  'by','from','up','about','into','through','during','before','after',
  'can','my','your','his','its','our','their','there','here',
  'see','look','find','show','tell','give','know','think','want','need',
  'any','all','both','each','few','more','most','other','some','such',
  'no','not','only','own','same','than','too','very','just',
  'do','go','get','make','let','like','how','where','when','why',
]);

function extractKeywords(query) {
  return query
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^['"-]+|['"-]+$/g, ''))
    .filter(w => w.length > 2 && !STOP.has(w));
}

// ── CORS ──────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function safe(p) {
  const resolved = path.resolve(p);
  if (!resolved.startsWith(ROOT)) throw new Error('Access denied: path outside root');
  return resolved;
}

// ── Directory walker ──────────────────────────────────────────────────────
function* walkDir(dir, depth = 0) {
  if (depth > 8) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { yield { full, name: e.name, isDir: true }; yield* walkDir(full, depth + 1); }
    else { yield { full, name: e.name, isDir: false }; }
  }
}

// ── Filename search — searches name AND parent folder names ───────────────
function searchByFilename(keywords, root) {
  const hits = [];
  for (const { full, name, isDir } of walkDir(root)) {
    if (hits.length >= MAX_RESULTS) break;
    const nameLower = name.toLowerCase();
    const pathLower = full.toLowerCase();
    const score = keywords.filter(k => pathLower.includes(k)).length;
    if (score > 0) hits.push({ full, name, isDir, score });
  }
  // Sort by how many keywords matched
  hits.sort((a, b) => b.score - a.score);
  return hits.map(h => h.full);
}

// ── Content search strategies ─────────────────────────────────────────────
function searchRipgrep(term, root) {
  try {
    const esc = term.replace(/[\\'"]/g, '\\$&');
    const raw = execSync(
      `rg --json -i -l --max-count 2 "${esc}" "${root}"`,
      { maxBuffer: 8 * 1024 * 1024, timeout: 6000 }
    ).toString();
    return raw.trim().split('\n')
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(x => x?.type === 'match')
      .map(x => x.data.path.text)
      .filter((v, i, a) => a.indexOf(v) === i);
  } catch { return []; }
}

function searchGrep(term, root) {
  try {
    const esc = term.replace(/[\\'"]/g, '\\$&');
    const exts = [...TEXT_EXTS].map(e => `--include="*${e}"`).join(' ');
    const raw = execSync(
      `grep -rl ${exts} -i "${esc}" "${root}" 2>/dev/null | head -${MAX_RESULTS}`,
      { maxBuffer: 4 * 1024 * 1024, timeout: 6000 }
    ).toString();
    return raw.trim().split('\n').filter(Boolean);
  } catch { return []; }
}

function searchManual(keywords, root) {
  const hits = new Map(); // filepath → matchCount
  for (const { full, name, isDir } of walkDir(root)) {
    if (isDir) continue;
    const ext = path.extname(name).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.size > MAX_FILE_SIZE) continue;
    let content;
    try { content = fs.readFileSync(full, 'utf8').toLowerCase(); } catch { continue; }
    const matches = keywords.filter(k => content.includes(k)).length;
    if (matches > 0) hits.set(full, matches);
    if (hits.size >= MAX_RESULTS * 2) break;
  }
  return [...hits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_RESULTS)
    .map(([f]) => f);
}

// ── Build rich snippets ───────────────────────────────────────────────────
function buildSnippets(files, keywords) {
  return files.map(filepath => {
    const ext = path.extname(filepath).toLowerCase();
    const name = path.basename(filepath);
    const dir  = path.dirname(filepath).replace(ROOT, '~');

    // Non-text file — return name/path only
    if (!TEXT_EXTS.has(ext)) {
      return { file: filepath, name, dir, excerpt: `[${ext.slice(1).toUpperCase()} file — cannot read content directly]`, size: 0 };
    }

    let content;
    try {
      const stat = fs.statSync(filepath);
      if (stat.size > MAX_FILE_SIZE) return { file: filepath, name, dir, excerpt: '[File too large to preview]', size: stat.size };
      content = fs.readFileSync(filepath, 'utf8');
    } catch { return null; }

    const lines   = content.split('\n');
    // Find best line — most keyword matches
    let bestIdx = 0, bestScore = 0;
    lines.forEach((line, i) => {
      const ll = line.toLowerCase();
      const score = keywords.filter(k => ll.includes(k)).length;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    });

    const start   = Math.max(0, bestIdx - 4);
    const end     = Math.min(lines.length, bestIdx + SNIPPET_LINES);
    const excerpt = lines.slice(start, end).join('\n').slice(0, SNIPPET_MAX);

    return { file: filepath, name, dir, excerpt: excerpt + (content.length > SNIPPET_MAX ? '\n…' : ''), size: content.length };
  }).filter(Boolean);
}

// ── Main search: filename first, then content ─────────────────────────────
function doSearch(query, root) {
  const keywords = extractKeywords(query);
  console.log(`[search] keywords: [${keywords.join(', ')}]  root: ${root}`);

  if (keywords.length === 0) {
    return { snippets: [], fileCount: 0, keywords: [], note: 'No meaningful keywords found in query.' };
  }

  // 1. Filename/path matches (fastest, catches "outline maisonneuve" even if content is binary)
  const nameMatches = searchByFilename(keywords, root);

  // 2. Content matches — try each keyword separately, merge results
  const contentMatches = new Set();
  for (const kw of keywords) {
    const found = searchRipgrep(kw, root).length
      ? searchRipgrep(kw, root)
      : searchGrep(kw, root).length
        ? searchGrep(kw, root)
        : searchManual([kw], root);
    found.forEach(f => contentMatches.add(f));
    if (contentMatches.size >= MAX_RESULTS) break;
  }

  // Merge: name matches first, then content, deduplicated
  const all = [...new Set([...nameMatches, ...contentMatches])].slice(0, MAX_RESULTS);

  const snippets = buildSnippets(all, keywords);
  console.log(`[search] → ${snippets.length} results (${nameMatches.length} by name, ${contentMatches.size} by content)`);

  return { snippets, fileCount: all.length, keywords };
}

// ── Request handler ───────────────────────────────────────────────────────
function handleRequest(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, rootPath: ROOT, platform: process.platform, version: '2.0.0' }));
    return;
  }

  if (req.method !== 'POST') { res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); return; }

  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > 64 * 1024) req.destroy(); });
  req.on('end', () => {
    let data;
    try { data = JSON.parse(body); }
    catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }

    const root = (data.rootPath && fs.existsSync(data.rootPath)) ? path.resolve(data.rootPath) : ROOT;

    try {
      if (url.pathname === '/search') {
        const { query } = data;
        if (!query?.trim()) { res.writeHead(400); res.end(JSON.stringify({ error: 'query required' })); return; }
        const result = doSearch(query, root);
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      if (url.pathname === '/read') {
        const resolved = safe(data.filepath);
        const stat = fs.statSync(resolved);
        if (stat.size > MAX_FILE_SIZE) {
          res.writeHead(413);
          res.end(JSON.stringify({ error: `File too large (${(stat.size / 1024).toFixed(0)} KB)` }));
          return;
        }
        const content = fs.readFileSync(resolved, 'utf8');
        res.writeHead(200);
        res.end(JSON.stringify({ content, size: stat.size, filepath: resolved }));
        return;
      }

      if (url.pathname === '/list') {
        const dirPath = data.dirPath ? safe(data.dirPath) : root;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true })
          .filter(e => !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
          .map(e => ({ name: e.name, isDir: e.isDirectory(), path: path.join(dirPath, e.name), ext: e.isFile() ? path.extname(e.name).toLowerCase() : null }))
          .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
        res.writeHead(200);
        res.end(JSON.stringify({ entries, dirPath }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Unknown endpoint' }));
    } catch (e) {
      const status = e.message.startsWith('Access denied') ? 403 : 500;
      res.writeHead(status);
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

// ── Start ─────────────────────────────────────────────────────────────────
const server = http.createServer(handleRequest);

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║      dedomena bridge  v2.0               ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n  Port      : ${PORT}`);
  console.log(`  Root path : ${ROOT}`);
  console.log(`  Platform  : ${process.platform}`);
  console.log('\n  Leave this terminal open.');
  console.log('  Return to dedomena and ask anything.\n');
  console.log('  Press Ctrl+C to stop.\n');
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ERROR: Port ${PORT} is already in use.`);
    console.error('  Another bridge may be running. Close it and try again.\n');
  } else {
    console.error('\n  ERROR:', e.message, '\n');
  }
  process.exit(1);
});

process.on('SIGINT',  () => { console.log('\n\n  Bridge stopped.\n'); process.exit(0); });
process.on('SIGTERM', () => process.exit(0));
