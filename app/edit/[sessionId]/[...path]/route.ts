import { PRIZM_API_BASE } from '@/lib/prizm-api';

const COOKIE_NAME = 'prizm_user_id';
const CONNECTION_LOST_MESSAGE = '편집 세션 연결이 끊겼습니다, 다시 시작해 주세요';

type SessionLookup = {
  status: 'CREATING' | 'READY' | 'FAILED' | 'TERMINATED';
  hostPort: number | null;
  jupyterToken: string | null;
};

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

async function lookupSession(sessionId: string, requesterId: string): Promise<SessionLookup | null> {
  let response: Response;
  try {
    response = await fetch(
      `${PRIZM_API_BASE}/api/edit-sessions/${encodeURIComponent(sessionId)}` +
        `?requesterId=${encodeURIComponent(requesterId)}`,
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;
  return (await response.json()) as SessionLookup;
}

function stripHopByHopHeaders(headers: Headers): Headers {
  const result = new Headers(headers);
  result.delete('host');
  result.delete('connection');
  result.delete('cookie'); // 포털 세션 쿠키를 JupyterLab에 보낼 이유가 없다
  return result;
}

async function proxyWebSocket(targetUrl: URL, request: Request): Promise<Response> {
  // 알려진 vinext dev(miniflare) 로컬 개발 서버 한계: 브라우저가 최초 WS 업그레이드
  // 요청에 Sec-WebSocket-Protocol을 실었을 경우(JupyterLab의 커널 채널 WS가 그렇다),
  // 이 함수가 그 프로토콜을 요청/전달하든 안 하든 상관없이 miniflare 내부 WS 클라이언트가
  // 매 경우 "Server sent no subprotocol"을 던지고 dev 서버 프로세스 전체가 죽는다
  // (try/catch로 못 막는다 - 응답 콜백 밖에서 발생). Jupyter를 직접(프록시 없이) 같은
  // 프로토콜로 연결하면 정상적으로 협상되므로 Jupyter 쪽 문제가 아니다. 이 함수가 보내는
  // 헤더에서 Sec-WebSocket-Protocol을 지워도, 원본 request 객체에서 직접 지워도 재현됨을
  // 확인했다 - miniflare가 최초 업그레이드 요청의 프로토콜을 애플리케이션 코드가 볼 수
  // 없는 곳에서 내부적으로 추적해 중첩된 fetch에 그대로 적용하는 것으로 보인다.
  // (Phase 2 Task 12 검증 중 발견, 2026-09-20. 로컬 dev 전용 문제로 프로덕션
  // Cloudflare Workers 런타임에는 해당하지 않을 가능성이 높다 - §2·§7 참고.)
  const upstreamHeaders = stripHopByHopHeaders(request.headers);
  upstreamHeaders.set('Upgrade', 'websocket');
  upstreamHeaders.set('Connection', 'Upgrade');
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, { headers: upstreamHeaders });
  } catch {
    return new Response(CONNECTION_LOST_MESSAGE, { status: 502 });
  }
  const upstreamSocket = (upstreamResponse as unknown as { webSocket: WebSocket | null }).webSocket;
  if (!upstreamSocket) {
    return new Response(CONNECTION_LOST_MESSAGE, { status: 502 });
  }
  upstreamSocket.accept();

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
  server.accept();

  server.addEventListener('message', (event: MessageEvent) => upstreamSocket.send(event.data));
  upstreamSocket.addEventListener('message', (event: MessageEvent) => server.send(event.data));
  server.addEventListener('close', () => upstreamSocket.close());
  upstreamSocket.addEventListener('close', () => server.close());
  server.addEventListener('error', () => upstreamSocket.close());
  upstreamSocket.addEventListener('error', () => server.close());

  return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
}

async function handleProxy(
  request: Request,
  context: { params: Promise<{ sessionId: string; path: string[] }> },
): Promise<Response> {
  const { sessionId, path } = await context.params;
  const requesterId = readCookie(request, COOKIE_NAME);
  if (!requesterId) {
    return new Response(CONNECTION_LOST_MESSAGE, { status: 404 });
  }

  const session = await lookupSession(sessionId, requesterId);
  if (!session || session.status !== 'READY' || !session.hostPort || !session.jupyterToken) {
    return new Response(CONNECTION_LOST_MESSAGE, { status: 404 });
  }

  // JupyterLab이 --ServerApp.base_url=/edit/<sessionId>/로 떠 있으므로(자기 자신을
  // 가리키는 static 자산/API 링크를 이 경로 아래로 생성한다), 프록시도 그 접두사를
  // 벗기지 않고 그대로 넘겨야 Jupyter의 라우팅과 맞아떨어진다.
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(
    `http://localhost:${session.hostPort}/edit/${encodeURIComponent(sessionId)}/${path.join('/')}`,
  );
  targetUrl.search = incomingUrl.search;
  if (!targetUrl.searchParams.has('token')) {
    targetUrl.searchParams.set('token', session.jupyterToken);
  }

  if (request.headers.get('Upgrade') === 'websocket') {
    return proxyWebSocket(targetUrl, request);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: stripHopByHopHeaders(request.headers),
      body: hasBody ? await request.arrayBuffer() : undefined,
    });
  } catch {
    return new Response(CONNECTION_LOST_MESSAGE, { status: 502 });
  }
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: upstreamResponse.headers,
  });
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
