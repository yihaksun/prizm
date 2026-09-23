export type EditSessionStatus = 'CREATING' | 'READY' | 'FAILED' | 'TERMINATED';

export type EditSessionInfo = {
  sessionId: string;
  status: EditSessionStatus;
  proxyBase: string;
  hostPort: number | null;
  jupyterToken: string | null;
  notebookFilename: string | null;
  errorMessage: string | null;
};

export class EditSessionApiError extends Error {}

export async function createEditSession(assetId: string, version: string): Promise<EditSessionInfo> {
  let response: Response;
  try {
    response = await fetch('/api/edit-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, version }),
    });
  } catch {
    throw new EditSessionApiError('편집 세션 서버(포털)에 연결할 수 없습니다');
  }
  const data = (await response.json().catch(() => ({}))) as Partial<EditSessionInfo> & { message?: string };
  if (!response.ok) {
    throw new EditSessionApiError(data.message ?? `편집 세션 생성 실패 (${response.status})`);
  }
  return data as EditSessionInfo;
}

export async function registerEditSessionVersion(sessionId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/edit-session-register/${encodeURIComponent(sessionId)}`, { method: 'POST' });
  } catch {
    throw new EditSessionApiError('편집 세션 서버(포털)에 연결할 수 없습니다');
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    throw new EditSessionApiError(data.message ?? `새 버전 등록 실패 (${response.status})`);
  }
}
