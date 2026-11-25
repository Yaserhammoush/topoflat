/**
 * وسيط محلي لجلب صفحات FlightAware — بدون مكتبات خارجية
 * node server.js
 * ثم: http://localhost:3000/
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const FA_HOST = 'www.flightaware.com';
function hasApp(dir) {
  return (
    fs.existsSync(path.join(dir, 'index.html')) ||
    fs.existsSync(path.join(dir, 'globe_split_view.html')) ||
    fs.existsSync(path.join(dir, 'assets.js'))
  );
}
function findWebRoot() {
  const candidates = [
    path.resolve(__dirname, '..'),
    __dirname,
    path.resolve(__dirname, '..', 'Samt'),
    path.resolve(__dirname, 'Samt'),
    path.resolve(__dirname, '..', 'TOPO-FLAT'),
  ];
  for (const dir of candidates) {
    if (hasApp(dir)) return dir;
  }
  return path.resolve(__dirname, '..');
}
const ARTIFACTS = findWebRoot();
const HTML_OK =
  fs.existsSync(path.join(ARTIFACTS, 'index.html')) ||
  fs.existsSync(path.join(ARTIFACTS, 'globe_split_view.html'));
function defaultPage() {
  if (fs.existsSync(path.join(ARTIFACTS, 'index.html'))) return '/index.html';
  return '/globe_split_view.html';
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text, contentType) {
  res.writeHead(status, {
    'Content-Type': contentType || 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(text);
}

function decodeBody(buf, encoding) {
  const enc = String(encoding || '').toLowerCase();
  try {
    if (enc.includes('gzip')) return zlib.gunzipSync(buf).toString('utf8');
    if (enc.includes('deflate')) return zlib.inflateSync(buf).toString('utf8');
    if (enc.includes('br') && zlib.brotliDecompressSync) {
      return zlib.brotliDecompressSync(buf).toString('utf8');
    }
  } catch (e) {}
  return buf.toString('utf8');
}

const cookieJar = Object.create(null);
function rememberCookies(setCookie) {
  const list = !setCookie ? [] : Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const raw of list) {
    const part = String(raw).split(';')[0];
    const eq = part.indexOf('=');
    if (eq > 0) cookieJar[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
}
function cookieHeader() {
  return Object.keys(cookieJar)
    .map((k) => k + '=' + cookieJar[k])
    .join('; ');
}

function fetchHttps(urlString, redirectsLeft) {
  const left = redirectsLeft == null ? 5 : redirectsLeft;
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(urlString);
    } catch (e) {
      return reject(new Error('رابط غير صالح'));
    }
    if (u.protocol !== 'https:') return reject(new Error('https فقط'));
    const headers = {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'no-cache',
      Referer: 'https://www.flightaware.com/live/',
      Connection: 'close',
    };
    const ck = cookieHeader();
    if (ck) headers.Cookie = ck;
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers,
        timeout: 12000,
      },
      (r) => {
        rememberCookies(r.headers['set-cookie']);
        const loc = r.headers.location;
        if ([301, 302, 303, 307, 308].includes(r.statusCode) && loc && left > 0) {
          r.resume();
          const next = loc.startsWith('http') ? loc : u.origin + loc;
          fetchHttps(next, left - 1).then(resolve, reject);
          return;
        }
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => {
          const buf = Buffer.concat(chunks);
          const html = decodeBody(buf, r.headers['content-encoding']);
          resolve({ status: r.statusCode || 0, html, finalUrl: urlString });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('انتهت مهلة الاتصال'));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchHttpsRetry(urlString) {
  let last;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetchHttps(urlString);
      const html = r.html || '';
      const head = html.slice(0, 2000).toLowerCase();
      const blocked =
        head.includes('just a moment') ||
        head.includes('cf-browser-verification') ||
        head.includes('captcha');
      if (r.status >= 200 && r.status < 400 && html.length > 400 && !blocked) return r;
      last = new Error('محاولة ' + (i + 1) + ': status ' + r.status);
    } catch (e) {
      last = e;
    }
    if (i === 0) await new Promise((ok) => setTimeout(ok, 400));
  }
  throw last || new Error('فشل الجلب');
}

function normalizeIdent(ident) {
  return String(ident || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function isAllowedFaUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === FA_HOST || u.hostname.endsWith('.flightaware.com'));
  } catch {
    return false;
  }
}

function ymdUTC(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = defaultPage();
  if (
    (rel === '/globe_split_view.html' || rel === '/index.html') &&
    !fs.existsSync(path.join(ARTIFACTS, rel.replace(/^\//, '')))
  ) {
    rel = defaultPage();
  }
  const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ARTIFACTS, safe);
  if (!filePath.startsWith(ARTIFACTS)) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const msg = HTML_OK
        ? 'الملف غير موجود: ' + rel
        : [
            'لم يُعثر على index.html',
            '',
            'ضع مجلد flight-proxy داخل نفس المجلد الذي فيه ملف المشروع:',
            '  TOPO-FLAT/',
            '    index.html',
            '    assets.js',
            '    maps/',
            '    flight-proxy/server.js',
            '',
            'ثم شغّل start.bat وافتح:',
            '  http://localhost:' + PORT + '/',
            '',
            'لا تفتح ملف HTML بالنقر المزدوج إذا أردت الرحلات.',
          ].join('\n');
      sendText(res, 404, msg);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}

async function handleFlightRequest(req, res) {
  const raw = String(req.url || '/');
  const isApi = raw.split('?')[0].startsWith('/api/');
  if (!isApi) return false;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return true;
  }
  const u = new URL(raw, 'http://localhost');
  if (u.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'flight-proxy', port: PORT });
    return true;
  }
  if (u.pathname.startsWith('/api/flight/')) {
    try {
      const rest = u.pathname.slice('/api/flight/'.length);
      const ident = normalizeIdent(rest.split('/')[0]);
      if (!/^[A-Z0-9]{2,10}$/.test(ident)) {
        sendJson(res, 400, { ok: false, error: 'رقم رحلة غير صالح' });
        return true;
      }
      const wantHistory = /\/history\/?$/i.test(rest) || u.searchParams.get('history') === '1';
      if (wantHistory) {
        const faUrl = 'https://' + FA_HOST + '/live/flight/' + encodeURIComponent(ident) + '/history';
        const result = await fetchHttpsRetry(faUrl);
        if (!result.html || result.html.length < 500) {
          sendJson(res, 502, {
            ok: false,
            error: 'تعذر جلب السجل من FlightAware',
            status: result.status,
          });
          return true;
        }
        sendJson(res, 200, {
          ok: true,
          ident,
          url: faUrl,
          html: result.html,
        });
        return true;
      }
      const faUrl = 'https://' + FA_HOST + '/live/flight/' + encodeURIComponent(ident);
      const result = await fetchHttpsRetry(faUrl);
      if (!result.html || result.html.length < 500) {
        sendJson(res, 502, {
          ok: false,
          error: 'استجابة فارغة أو محظورة من FlightAware',
          status: result.status,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        status: result.status,
        ident,
        url: faUrl,
        html: result.html,
      });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: String(e.message || e) });
    }
    return true;
  }
  if (u.pathname === '/api/proxy') {
    try {
      const target = String(u.searchParams.get('url') || '').trim();
      if (!target || !isAllowedFaUrl(target)) {
        sendJson(res, 400, {
          ok: false,
          error: 'يُسمح فقط بروابط https://www.flightaware.com/...',
        });
        return true;
      }
      const result = await fetchHttpsRetry(target);
      if (!result.html || result.html.length < 200) {
        sendJson(res, 502, {
          ok: false,
          error: 'استجابة فارغة أو محظورة',
          status: result.status,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        status: result.status,
        url: target,
        html: result.html,
      });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: String(e.message || e) });
    }
    return true;
  }
  sendJson(res, 404, { ok: false, error: 'مسار غير معروف' });
  return true;
}

async function fetchIdentBundle(ident) {
  const live = 'https://' + FA_HOST + '/live/flight/' + encodeURIComponent(ident);
  const pages = [
    live,
    live + '/history',
    live + '/history?offset=20',
    live + '/history?offset=40',
  ];
  const htmlParts = [];
  const urls = [];
  for (const faUrl of pages) {
    try {
      const result = await fetchHttpsRetry(faUrl);
      if (result.html && result.html.length > 400) {
        htmlParts.push(result.html);
        urls.push({ url: faUrl, status: result.status, bytes: result.html.length });
      } else {
        urls.push({ url: faUrl, status: result.status, bytes: result.html ? result.html.length : 0 });
      }
    } catch (e) {
      urls.push({ url: faUrl, error: String(e.message || e) });
    }
  }
  return { html: htmlParts.join('\n'), urls, live };
}

const server = http.createServer(async (req, res) => {
  try {
    if (await handleFlightRequest(req, res)) return;
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String(e.message || e) });
  }
  const u = new URL(req.url || '/', 'http://localhost');
  serveStatic(req, res, u.pathname);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('  Flight Proxy جاهز');
    console.log('  http://localhost:' + PORT + '/');
    console.log('========================================');
    console.log('  مجلد الصفحة: ' + ARTIFACTS);
    console.log('  ملف المشروع: ' + (HTML_OK ? 'موجود (' + defaultPage() + ')' : 'غير موجود — ضع flight-proxy بجانب index.html'));
    console.log('  http://localhost:' + PORT + '/api/health');
    console.log('  http://localhost:' + PORT + '/api/flight/UAE123');
    console.log('========================================');
    console.log('');
    fetchHttps('https://www.flightaware.com/')
      .then(() => console.log('  جلسة FlightAware جاهزة'))
      .catch((e) => console.log('  تنبيه الجلسة:', e && e.message ? e.message : e));
  });
}

module.exports = { handleFlightRequest };
