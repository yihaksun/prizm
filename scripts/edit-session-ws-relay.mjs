// 로컬 개발 전용 보조 프로세스.
// vinext/miniflare의 Jupyter 커널 WebSocket subprotocol 중계 문제를 순수 Node로 우회한다.

import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

const RELAY_PORT = Number(process.env.EDIT_SESSION_RELAY_PORT ?? 3011);
const PRIZM_API_BASE = process.env.PRIZM_API_BASE ?? 'http://localhost:8081';
const COOKIE_NAME = 'prizm_user_id';
const CONNECTION_LOST_MESSAGE = '편집 세션 연결이 끊겼습니다, 다시 시작해 주세요';

function readCookie(header, name) {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function parseEditPath(url) {
  const match = url.match(/^\/edit\/([^/?]+)\/([^?]*)(\?.*)?$/);
  if (!match) return null;
  return { sessionId: match[1], path: match[2], search: match[3] ?? '' };
}

async function lookupSession(sessionId, requesterId) {
  try {
    const response = await fetch(
      `${PRIZM_API_BASE}/api/edit-sessions/${encodeURIComponent(sessionId)}` +
        `?requesterId=${encodeURIComponent(requesterId)}`,
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function buildTargetUrl(protocol, hostPort, sessionId, path, search, token) {
  const targetUrl = new URL(`${protocol}://localhost:${hostPort}/edit/${sessionId}/${path}`);
  if (search) targetUrl.search = search;
  if (!targetUrl.searchParams.has('token')) targetUrl.searchParams.set('token', token);
  return targetUrl;
}

const server = http.createServer(async (req, res) => {
  const parsed = parseEditPath(req.url ?? '');
  const requesterId = readCookie(req.headers.cookie, COOKIE_NAME);
  if (!parsed || !requesterId) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(CONNECTION_LOST_MESSAGE);
    return;
  }

  const session = await lookupSession(parsed.sessionId, requesterId);
  if (!session || session.status !== 'READY' || !session.hostPort || !session.jupyterToken) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(CONNECTION_LOST_MESSAGE);
    return;
  }

  const targetUrl = buildTargetUrl(
    'http',
    session.hostPort,
    parsed.sessionId,
    parsed.path,
    parsed.search,
    session.jupyterToken,
  );

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers.cookie;

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });
  } catch {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(CONNECTION_LOST_MESSAGE);
    return;
  }

  const responseHeaders = {};
  upstream.headers.forEach((value, key) => {
    if (key === 'content-encoding' || key === 'transfer-encoding') return;
    // 로컬 릴레이는 포털과 다른 origin이므로 Jupyter의 frame-ancestors 'self'를 전달하지 않는다.
    if (key === 'content-security-policy') return;
    responseHeaders[key] = value;
  });
  res.writeHead(upstream.status, responseHeaders);
  res.end(Buffer.from(await upstream.arrayBuffer()));
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (req, socket, head) => {
  const parsed = parseEditPath(req.url ?? '');
  const requesterId = readCookie(req.headers.cookie, COOKIE_NAME);
  if (!parsed || !requesterId) {
    socket.destroy();
    return;
  }

  const session = await lookupSession(parsed.sessionId, requesterId);
  if (!session || session.status !== 'READY' || !session.hostPort || !session.jupyterToken) {
    socket.destroy();
    return;
  }

  const targetUrl = buildTargetUrl(
    'ws',
    session.hostPort,
    parsed.sessionId,
    parsed.path,
    parsed.search,
    session.jupyterToken,
  );
  const requestedProtocols = req.headers['sec-websocket-protocol']
    ?.split(',')
    .map((protocol) => protocol.trim());

  const upstream = new WebSocket(targetUrl, requestedProtocols);
  upstream.on('open', () => {
    wss.handleUpgrade(req, socket, head, (client) => {
      client.on('message', (data, isBinary) => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary });
      });
      upstream.on('message', (data, isBinary) => {
        if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
      });
      client.on('close', () => upstream.close());
      upstream.on('close', () => client.close());
      client.on('error', () => upstream.close());
      upstream.on('error', () => client.close());
    });
  });
  upstream.on('error', () => socket.destroy());
});

server.listen(RELAY_PORT, () => {
  console.log(`[edit-session-ws-relay] listening on http://localhost:${RELAY_PORT}`);
});
