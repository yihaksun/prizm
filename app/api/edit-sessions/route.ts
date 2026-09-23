import { PRIZM_API_BASE } from '@/lib/prizm-api';

const COOKIE_NAME = 'prizm_user_id';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1년

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function POST(request: Request) {
  let body: { assetId?: string; version?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: '요청 본문을 읽을 수 없습니다' }, { status: 400 });
  }
  if (!body.assetId || !body.version) {
    return Response.json({ message: 'assetId와 version이 필요합니다' }, { status: 400 });
  }

  let ownerId = readCookie(request, COOKIE_NAME);
  const isNewCookie = !ownerId;
  if (!ownerId) {
    ownerId = crypto.randomUUID();
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${PRIZM_API_BASE}/api/edit-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: body.assetId, version: body.version, ownerId }),
    });
  } catch {
    return Response.json({ message: '편집 세션 서버(백엔드)에 연결할 수 없습니다' }, { status: 502 });
  }
  const responseBody = await backendResponse.text();

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (isNewCookie) {
    headers.set(
      'Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(ownerId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    );
  }
  return new Response(responseBody, { status: backendResponse.status, headers });
}
