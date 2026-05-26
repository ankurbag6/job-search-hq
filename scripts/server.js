const http = require('http');
const fs = require('fs');
const path = require('path');

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const ROOT = path.join(__dirname, '..');

  // controller for saving the data to the file
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      fs.writeFile(path.join(ROOT, 'data.json'), body, () => {
        res.writeHead(200); res.end('ok');
      });
    });
  } else {
    // serve static files
    const filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
    fs.readFile(filePath, (err, content) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200); res.end(content);
    });
  }
}).listen(8080, () => console.log('http://localhost:8080'));