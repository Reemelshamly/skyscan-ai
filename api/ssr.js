import { Readable } from 'stream';
import serverEntry from '../dist/server/index.js';

function getHandler() {
  if (typeof serverEntry === 'function') return serverEntry;
  if (serverEntry && typeof serverEntry.default === 'function') return serverEntry.default;
  if (serverEntry && typeof serverEntry.fetch === 'function') return serverEntry.fetch;
  if (serverEntry && typeof serverEntry.default?.fetch === 'function') return serverEntry.default.fetch;
  throw new Error('Cannot find server handler in dist/server/index.js');
}

const handler = getHandler();

export default async function (req, res) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'localhost';
    const url = `${protocol}://${host}${req.url}`;

    let body = undefined;
    const init = {
      method: req.method,
      headers: req.headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      if (typeof Readable.toWeb === 'function') {
        body = Readable.toWeb(req);
      } else {
        body = req;
      }
      init.body = body;
      init.duplex = 'half';
    }

    const webReq = new Request(url, init);
    const webRes = await handler(webReq, {}, {});

    res.statusCode = webRes.status || 200;
    webRes.headers.forEach((v, k) => res.setHeader(k, v));

    if (webRes.body) {
      const reader = webRes.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
    }
    res.end();
  } catch (err) {
    console.error('SSR wrapper error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Internal Server Error: ' + err.message);
  }
}
