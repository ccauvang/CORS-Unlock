const http = require('http');

{
  const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/HTML');
    res.end(`

  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>CORS Test</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 20px; background: #111; color: #eee; }
      h1 { font-size: 18px; }
      #log { white-space: pre-wrap; font-family: monospace; font-size: 13px; background: #000;
             padding: 12px; border-radius: 6px; margin-top: 12px; line-height: 1.5; }
      .ok { color: #4caf50; }
      .fail { color: #f44336; }
      .info { color: #64b5f6; }
    </style>
  </head>
  <body>
    <h1 id="status">Running CORS test...</h1>
    <div id="log"></div>
    <script>
      const logEl = document.getElementById('log');
      const statusEl = document.getElementById('status');

      function log(msg, cls) {
        const line = document.createElement('div');
        if (cls) line.className = cls;
        line.textContent = msg;
        logEl.appendChild(line);
        console.log(msg);
      }

      document.cookie = 'a=1';
      log('page origin: ' + location.origin, 'info');
      log('cookie set: ' + document.cookie, 'info');
      log('sending fetch -> http://127.0.0.1:3001/ with credentials: include ...', 'info');

      const t0 = performance.now();

      fetch('http://127.0.0.1:3001/', {
        credentials: 'include'
      }).then(async r => {
        const ms = (performance.now() - t0).toFixed(1);
        log('fetch resolved in ' + ms + 'ms, status: ' + r.status + ' ' + r.statusText, 'info');

        log('--- response headers ---', 'info');
        let hasAny = false;
        for (const [key, value] of r.headers.entries()) {
          hasAny = true;
          log('  ' + key + ': ' + value);
        }
        if (!hasAny) log('  (no headers exposed to page — check ACAO/ACAC)', 'fail');

        const acao = r.headers.get('access-control-allow-origin');
        const acac = r.headers.get('access-control-allow-credentials');
        log('Access-Control-Allow-Origin  = ' + (acao ?? 'MISSING'), acao ? 'ok' : 'fail');
        log('Access-Control-Allow-Credentials = ' + (acac ?? 'MISSING'), acac === 'true' ? 'ok' : 'fail');

        const content = await r.text();
        log('body received: "' + content + '"', 'info');

        document.title = 'CORS OK';
        statusEl.textContent = 'CORS OK';
        statusEl.style.color = '#4caf50';
      }).catch(err => {
        const ms = (performance.now() - t0).toFixed(1);
        log('fetch REJECTED after ' + ms + 'ms', 'fail');
        log('error name: ' + err.name, 'fail');
        log('error message: ' + err.message, 'fail');
        log('(open devtools console/network tab for the exact browser-level CORS reason — ' +
            'fetch() intentionally hides the specific cause for security reasons)', 'info');

        document.title = 'CORS FAILED';
        statusEl.textContent = 'CORS FAILED';
        statusEl.style.color = '#f44336';
      });
    </script>
  </body>
  </html>

    `);
  });

  server.listen(3000, '127.0.0.1', () => {
    console.log('Main server is ready!', 'http://127.0.0.1:3000');
  });
}
{
  const server = http.createServer((req, res) => {
    // log every incoming request server-side so you can see what actually arrived,
    // regardless of what the browser lets the page's JS see
    console.log('\n--- API server received request ---');
    console.log('method:', req.method);
    console.log('url:', req.url);
    console.log('headers:');
    for (const [key, value] of Object.entries(req.headers)) {
      console.log('  ' + key + ': ' + value);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/TEXT');
    res.end('hello');
  });

  server.listen(3001, '127.0.0.1', () => {
    console.log('API server is ready!', 'http://127.0.0.1:3001');
  });
}