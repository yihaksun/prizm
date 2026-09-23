import { PRIZM_API_BASE } from '@/lib/prizm-api';

const COOKIE_NAME = 'prizm_user_id';

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await context.params;
  const requesterId = readCookie(request, COOKIE_NAME);
  if (!requesterId) {
    return Response.json({ message: '편집 세션을 찾을 수 없습니다' }, { status: 404 });
  }
  const backendResponse = await fetch(
    `${PRIZM_API_BASE}/api/edit-sessions/${encodeURIComponent(sessionId)}/register-version` +
      `?requesterId=${encodeURIComponent(requesterId)}`,
    { method: 'POST' },
  );
  const text = await backendResponse.text();
  return new Response(text || null, { status: backendResponse.status });
}
