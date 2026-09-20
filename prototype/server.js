const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
                '.css':'text/css; charset=utf-8', '.png':'image/png', '.json':'application/json' };

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      const b64 = body.replace(/^data:image\/png;base64,/, '');
      const outPath = path.join(ROOT, 'farbvarianten.png');
      fs.writeFile(outPath, Buffer.from(b64, 'base64'), (err) => {
        res.writeHead(err ? 500 : 200).end(err ? String(err) : 'ok');
      });
    });
    return;
  }
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(5178, () => console.log('Prototyp laeuft auf http://localhost:5178'));
