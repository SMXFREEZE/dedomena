#!/usr/bin/env node
/**
 * dedomena-bridge v3 — intelligent local filesystem agent
 *
 * Three-layer architecture (pure Node.js, zero npm installs):
 *   Layer 1 — Fuzzy path resolution   (Jaro-Winkler similarity)
 *   Layer 2 — Smart keyword search    (filename + content, multi-term)
 *   Layer 3 — Agentic navigation      (list → match → read → summarise)
 *
 * Run:  node dedomena-bridge.js [root-path]
 * Default root: your home directory.
 * Listens on http://127.0.0.1:7432 — localhost only.
 */

'use strict';

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { execSync } = require('child_process');

const PORT    = 7432;
const ROOT    = path.resolve(process.argv[2] || os.homedir());
const VERSION = '3.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — FUZZY MATCHING  (Jaro-Winkler, pure JS, no deps)
// ─────────────────────────────────────────────────────────────────────────────

function jaro(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length, len2 = s2.length;
  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
  const s1Matches = new Uint8Array(len1);
  const s2Matches = new Uint8Array(len2);
  let matches = 0, transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const lo = Math.max(0, i - matchDist);
    const hi = Math.min(i + matchDist + 1, len2);
    for (let j = lo; j < hi; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = s2Matches[j] = 1;
      matches++;
      break;
    }
  }
  if (!matches) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
}

function jaroWinkler(s1, s2, p = 0.1) {
  const j = jaro(s1, s2);
  let prefix = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefix++; else break;
  }
  return j + prefix * p * (1 - j);
}

// Score how well a file/folder name matches a set of keywords (0–1)
function fuzzyScore(name, keywords) {
  const n = name.toLowerCase().replace(/[_\-\.]/g, ' ');
  const parts = n.split(/\s+/);
  let best = 0;
  for (const kw of keywords) {
    // Exact substring — perfect
    if (n.includes(kw)) { best = Math.max(best, 1.0); continue; }
    // Jaro-Winkler against each word in the name
    for (const part of parts) {
      best = Math.max(best, jaroWinkler(kw, part));
    }
    // Also try against the full name string
    best = Math.max(best, jaroWinkler(kw, n));
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — SMART KEYWORD SEARCH
// ─────────────────────────────────────────────────────────────────────────────

const TEXT_EXTS = new Set([
  '.txt', '.md', '.mdx', '.rst', '.csv', '.tsv',
  '.json', '.jsonl', '.yaml', '.yml', '.toml', '.ini', '.env', '.conf',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.cpp', '.c', '.h', '.cs',
  '.html', '.css', '.scss', '.sql', '.sh', '.bash', '.zsh', '.ps1',
  '.xml', '.log', '.diff', '.patch', '.tex', '.bib',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', '.next',
  '__pycache__', '.pytest_cache', 'venv', '.venv', 'env',
  '.idea', '.vscode', 'AppData', 'Application Data', '$Recycle.Bin',
  'Windows', 'System32', 'Program Files', 'Program Files (x86)',
]);

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_RESULTS   = 20;
const SNIPPET_LINES = 20;
const SNIPPET_MAX   = 1200;
const FUZZY_THRESH  = 0.72;   // minimum Jaro-Winkler score to count as a match

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
  'no','not','only','own','same','than','too','very','just','also',
  'get','make','let','like','how','where','when','why','please',
]);

function extractKeywords(query) {
  return query
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^['"-]+|['"-]+$/g, ''))
    .filter(w => w.length > 2 && !STOP.has(w));
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — AGENTIC NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

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

// Walk directory, yielding { full, name, isDir }
function* walkDir(dir, depth = 0) {
  if (depth > 9) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const isDir = e.isDirectory();
    yield { full, name: e.name, isDir };
    if (isDir) yield* walkDir(full, depth + 1);
  }
}

// Build a rich content snippet from a file
function readSnippet(filepath, keywords) {
  const ext = path.extname(filepath).toLowerCase();
  const name = path.basename(filepath);
  const dir  = path.dirname(filepath).replace(ROOT, '~');

  if (!TEXT_EXTS.has(ext)) {
    return { file: filepath, name, dir, excerpt: `[${ext.slice(1).toUpperCase() || 'file'} — binary/non-text format]`, canRead: false };
  }

  try {
    const stat = fs.statSync(filepath);
    if (stat.size > MAX_FILE_SIZE) return { file: filepath, name, dir, excerpt: `[File too large: ${(stat.size/1024).toFixed(0)} KB]`, canRead: false };
    const content = fs.readFileSync(filepath, 'utf8');
    const lines   = content.split('\n');

    // Find best-matching region — score each line
    let bestIdx = 0, bestScore = 0;
    lines.forEach((line, i) => {
      const ll = line.toLowerCase();
      const score = keywords.reduce((s, k) => s + (ll.includes(k) ? 2 : jaroWinkler(k, ll) > FUZZY_THRESH ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    });

    const start   = Math.max(0, bestIdx - 5);
    const end     = Math.min(lines.length, bestIdx + SNIPPET_LINES);
    const excerpt = lines.slice(start, end).join('\n').slice(0, SNIPPET_MAX);
    return { file: filepath, name, dir, excerpt: excerpt + (content.length > SNIPPET_MAX ? '\n…' : ''), canRead: true, size: content.length };
  } catch {
    return { file: filepath, name, dir, excerpt: '[Could not read file]', canRead: false };
  }
}

// Agentic search: fuzzy folder matching → list contents → content search
function agentSearch(query, root) {
  const keywords = extractKeywords(query);
  console.log(`\n[agent] query: "${query}"`);
  console.log(`[agent] keywords: [${keywords.join(', ')}]`);

  if (keywords.length === 0) {
    return { snippets: [], fileCount: 0, keywords: [], foldersExplored: [], note: 'No meaningful keywords found.' };
  }

  const fileScores  = new Map();  // filepath → score
  const folderHits  = [];         // { path, name, score } — fuzzy-matched directories

  // ── Pass 1: Fuzzy name matching across entire tree ────────────────────────
  for (const { full, name, isDir } of walkDir(root)) {
    const score = fuzzyScore(name, keywords);
    if (score >= FUZZY_THRESH) {
      if (isDir) {
        folderHits.push({ path: full, name, score });
        console.log(`[agent] folder match: "${name}" (score ${score.toFixed(2)})`);
      } else {
        fileScores.set(full, (fileScores.get(full) ?? 0) + score * 2);
      }
    }
  }

  // ── Pass 2: For each fuzzy-matched folder, list and read its contents ─────
  const exploredFolders = [];
  folderHits.sort((a, b) => b.score - a.score);

  for (const folder of folderHits.slice(0, 5)) {
    exploredFolders.push(`${folder.name} (${(folder.score * 100).toFixed(0)}% match)`);
    let entries;
    try { entries = fs.readdirSync(folder.path, { withFileTypes: true }); } catch { continue; }

    for (const e of entries.filter(e => !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))) {
      const full = path.join(folder.path, e.name);
      if (e.isFile()) {
        // Boost score for files inside a matched folder
        fileScores.set(full, (fileScores.get(full) ?? 0) + folder.score * 1.5);
      } else if (e.isDirectory()) {
        // Also list sub-folders
        try {
          const sub = fs.readdirSync(full, { withFileTypes: true });
          for (const s of sub.filter(s => s.isFile())) {
            const sp = path.join(full, s.name);
            fileScores.set(sp, (fileScores.get(sp) ?? 0) + folder.score);
          }
        } catch { /* skip */ }
      }
    }
  }

  // ── Pass 3: Content search — each keyword in text files ──────────────────
  for (const { full, name, isDir } of walkDir(root)) {
    if (isDir) continue;
    const ext = path.extname(name).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.size > MAX_FILE_SIZE) continue;
    let content;
    try { content = fs.readFileSync(full, 'utf8').toLowerCase(); } catch { continue; }

    let score = 0;
    for (const kw of keywords) {
      if (content.includes(kw)) score += 2;
    }
    // Fuzzy content match (word-by-word on first 5000 chars for speed)
    const words = content.slice(0, 5000).split(/\s+/);
    for (const kw of keywords) {
      const fuzzyHit = words.some(w => w.length > 3 && jaroWinkler(kw, w.replace(/[^a-z]/g, '')) > 0.88);
      if (fuzzyHit) score += 1;
    }

    if (score > 0) {
      fileScores.set(full, (fileScores.get(full) ?? 0) + score);
    }
    if (fileScores.size > MAX_RESULTS * 3) break;
  }

  // ── Rank and build results ────────────────────────────────────────────────
  const ranked = [...fileScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_RESULTS)
    .map(([f]) => f);

  const snippets = ranked.map(f => readSnippet(f, keywords));
  console.log(`[agent] → ${snippets.length} results, ${exploredFolders.length} folders explored`);

  return { snippets, fileCount: ranked.length, keywords, foldersExplored: exploredFolders };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP SERVER
// ─────────────────────────────────────────────────────────────────────────────

function handleRequest(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  // GET /status
  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, rootPath: ROOT, platform: process.platform, version: VERSION }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > 128 * 1024) req.destroy(); });
  req.on('end', () => {
    let data;
    try { data = JSON.parse(body); }
    catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }

    const root = (data.rootPath && fs.existsSync(data.rootPath)) ? path.resolve(data.rootPath) : ROOT;

    try {
      // POST /search — agentic search
      if (url.pathname === '/search') {
        const { query } = data;
        if (!query?.trim()) { res.writeHead(400); res.end(JSON.stringify({ error: 'query required' })); return; }
        const result = agentSearch(query, root);
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      // POST /read — read a specific file
      if (url.pathname === '/read') {
        const resolved = safe(data.filepath);
        const stat = fs.statSync(resolved);
        if (stat.size > MAX_FILE_SIZE) {
          res.writeHead(413); res.end(JSON.stringify({ error: `File too large: ${(stat.size/1024).toFixed(0)} KB` })); return;
        }
        const content = fs.readFileSync(resolved, 'utf8');
        res.writeHead(200);
        res.end(JSON.stringify({ content, size: stat.size, filepath: resolved }));
        return;
      }

      // POST /list — list a directory
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

      res.writeHead(404); res.end(JSON.stringify({ error: 'Unknown endpoint' }));

    } catch (e) {
      const status = e.message.startsWith('Access denied') ? 403 : 500;
      res.writeHead(status); res.end(JSON.stringify({ error: e.message }));
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer(handleRequest);

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║   dedomena bridge  v${VERSION}              ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n  Root : ${ROOT}`);
  console.log(`  Port : ${PORT}  (localhost only)`);
  console.log('\n  Fuzzy matching ON  — typos handled automatically');
  console.log('  Leave this window open while using dedomena.\n');
  console.log('  Press Ctrl+C to stop.\n');
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ERROR: Port ${PORT} already in use — another bridge is running.\n`);
  } else {
    console.error('\n  ERROR:', e.message, '\n');
  }
  process.exit(1);
});

process.on('SIGINT',  () => { console.log('\n  Bridge stopped.\n'); process.exit(0); });
process.on('SIGTERM', () => process.exit(0));
