import serverEntry from '../dist/server/index.js';

function getHandler() {
  // serverEntry may export default as the handler or an object with fetch
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

    const init = {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
    };

    const webReq = new Request(url, init);

    const webRes = await (handler.length >= 3 ? handler(webReq, {}, {}) : handler(webReq));

    res.statusCode = webRes.status || 200;
    webRes.headers.forEach((v, k) => res.setHeader(k, v));

    const buffer = Buffer.from(await webRes.arrayBuffer());
    res.end(buffer);
  } catch (err) {
    console.error('SSR wrapper error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
