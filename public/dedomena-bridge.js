#!/usr/bin/env node
/**
 * dedomena-bridge — local filesystem agent for dedomena
 *
 * Run from any terminal:
 *   node dedomena-bridge.js [root-path]
 *
 * Default root: your home directory.
 * The bridge listens on http://127.0.0.1:7432 (localhost only).
 * It never sends data anywhere — it only responds to queries from
 * your browser tab running dedomena.
 *
 * Endpoints:
 *   GET  /status          → health check + root path
 *   POST /search          → find files matching query, return relevant excerpts
 *   POST /read            → read a specific file (path must be inside root)
 *   POST /list            → list directory contents
 */

'use strict';

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { execSync } = require('child_process');

// ── Config ─────────────────────────────────────────────────────────────────
const PORT = 7432;
const ROOT = path.resolve(process.argv[2] || os.homedir());

// Only text-based extensions are searched
const TEXT_EXTS = new Set([
  '.txt', '.md', '.mdx', '.rst', '.csv', '.tsv',
  '.json', '.jsonl', '.yaml', '.yml', '.toml', '.ini', '.env', '.conf',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.cpp', '.c', '.h', '.cs',
  '.html', '.css', '.scss', '.sass', '.less', '.svelte', '.vue',
  '.sql', '.sh', '.bash', '.zsh', '.fish', '.ps1',
  '.xml', '.plist', '.dockerfile', '.makefile',
  '.log', '.diff', '.patch',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', '.next',
  '__pycache__', '.pytest_cache', 'venv', '.venv', 'env',
  '.DS_Store', 'Thumbs.db', '.idea', '.vscode',
]);

const MAX_FILE_SIZE   = 2 * 1024 * 1024;  // 2 MB max to read
const MAX_RESULTS     = 12;               // max files returned per search
const SNIPPET_LINES   = 12;              // lines of context around match
const SNIPPET_MAX     = 800;             // max chars per snippet

// ── CORS headers — allow any origin since this is localhost-only ────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

// ── Security: ensure requested path is inside ROOT ─────────────────────────
function safe(p) {
  const resolved = path.resolve(p);
  if (!resolved.startsWith(ROOT)) throw new Error('Access denied: path outside root');
  return resolved;
}

// ── Search strategy 1: ripgrep ─────────────────────────────────────────────
function searchRipgrep(query, root) {
  try {
    const escaped = query.replace(/[\\'"]/g, '\\$&');
    const raw = execSync(
      `rg --json -i -l --max-count 3 "${escaped}" "${root}"`,
      { maxBuffer: 8 * 1024 * 1024, timeout: 7000 }
    ).toString();
    const files = raw.trim().split('\n')
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(x => x?.type === 'match')
      .map(x => x.data.path.text)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, MAX_RESULTS);
    return files.length ? files : null;
  } catch { return null; }
}

// ── Search strategy 2: grep (Unix/macOS) ───────────────────────────────────
function searchGrep(query, root) {
  try {
    const escaped = query.replace(/[\\'"]/g, '\\$&');
    const exts = [...TEXT_EXTS].map(e => `--include="*${e}"`).join(' ');
    const raw = execSync(
      `grep -rl ${exts} -i "${escaped}" "${root}" 2>/dev/null | head -${MAX_RESULTS}`,
      { maxBuffer: 4 * 1024 * 1024, timeout: 7000 }
    ).toString();
    const files = raw.trim().split('\n').filter(Boolean);
    return files.length ? files : null;
  } catch { return null; }
}

// ── Search strategy 3: pure Node.js walk (cross-platform fallback) ──────────
function* walkDir(dir, depth = 0) {
  if (depth > 6) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { yield* walkDir(full, depth + 1); }
    else { yield full; }
  }
}

function searchManual(query, root) {
  const q = query.toLowerCase();
  const hits = [];
  for (const filepath of walkDir(root)) {
    if (hits.length >= MAX_RESULTS) break;
    const ext = path.extname(filepath).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;
    let stat;
    try { stat = fs.statSync(filepath); } catch { continue; }
    if (stat.size > MAX_FILE_SIZE) continue;
    let content;
    try { content = fs.readFileSync(filepath, 'utf8'); } catch { continue; }
    if (content.toLowerCase().includes(q)) hits.push(filepath);
  }
  return hits;
}

// ── Build snippets from matched files ──────────────────────────────────────
function buildSnippets(files, query) {
  const q = query.toLowerCase();
  return files.map(filepath => {
    let content;
    try {
      const stat = fs.statSync(filepath);
      if (stat.size > MAX_FILE_SIZE) return null;
      content = fs.readFileSync(filepath, 'utf8');
    } catch { return null; }

    const lines = content.split('\n');
    const idx   = lines.findIndex(l => l.toLowerCase().includes(q));
    const start = Math.max(0, idx - 3);
    const end   = Math.min(lines.length, idx + SNIPPET_LINES);
    const excerpt = lines.slice(start, end).join('\n').slice(0, SNIPPET_MAX);

    return {
      file:    filepath,
      name:    path.basename(filepath),
      dir:     path.dirname(filepath).replace(ROOT, '~'),
      excerpt: excerpt + (content.length > SNIPPET_MAX ? '\n…' : ''),
      size:    content.length,
    };
  }).filter(Boolean);
}

// ── Request handler ────────────────────────────────────────────────────────
function handleRequest(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  // GET /status
  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, rootPath: ROOT, platform: process.platform, version: '1.0.0' }));
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
      // POST /search
      if (url.pathname === '/search') {
        const { query } = data;
        if (!query?.trim()) { res.writeHead(400); res.end(JSON.stringify({ error: 'query required' })); return; }

        console.log(`[search] "${query}" in ${root}`);
        let files = searchRipgrep(query, root)
                 ?? searchGrep(query, root)
                 ?? searchManual(query, root);

        const snippets = buildSnippets(files, query);
        console.log(`[search] → ${snippets.length} results`);
        res.writeHead(200);
        res.end(JSON.stringify({ snippets, fileCount: files.length }));
        return;
      }

      // POST /read
      if (url.pathname === '/read') {
        const { filepath } = data;
        const resolved = safe(filepath);
        const stat = fs.statSync(resolved);
        if (stat.size > MAX_FILE_SIZE) {
          res.writeHead(413);
          res.end(JSON.stringify({ error: `File too large (${(stat.size / 1024).toFixed(0)} KB). Max 2 MB.` }));
          return;
        }
        const content = fs.readFileSync(resolved, 'utf8');
        res.writeHead(200);
        res.end(JSON.stringify({ content, size: stat.size, filepath: resolved }));
        return;
      }

      // POST /list
      if (url.pathname === '/list') {
        const dirPath = data.dirPath ? safe(data.dirPath) : root;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true })
          .filter(e => !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
          .map(e => ({
            name:  e.name,
            isDir: e.isDirectory(),
            path:  path.join(dirPath, e.name),
            ext:   e.isFile() ? path.extname(e.name).toLowerCase() : null,
          }))
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

// ── Start ──────────────────────────────────────────────────────────────────
const server = http.createServer(handleRequest);

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║      dedomena bridge  v1.0               ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n  Port      : ${PORT}`);
  console.log(`  Root path : ${ROOT}`);
  console.log(`  Platform  : ${process.platform}`);
  console.log('\n  Leave this terminal open.');
  console.log('  Return to dedomena → click "Test Connection".\n');
  console.log('  Press Ctrl+C to stop.\n');
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ERROR: Port ${PORT} is already in use.`);
    console.error('  Another bridge instance may already be running.\n');
  } else {
    console.error('\n  ERROR:', e.message, '\n');
  }
  process.exit(1);
});

process.on('SIGINT', () => { console.log('\n\n  Bridge stopped.\n'); process.exit(0); });
process.on('SIGTERM', () => process.exit(0));
