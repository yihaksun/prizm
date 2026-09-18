export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type RunStage = 'PREPARING' | 'DATA' | 'TRAINING' | 'REGISTERING' | 'DONE';

export type RunParameters = { epochs: number; batch_size: number; image_size: number; seed: number };

export type Run = {
  id: string;
  assetId: string;
  assetVersion: string;
  codeKey: string;
  codeVersion: string;
  parameters: Record<string, number>;
  resource: string;
  environment: string;
  requestedBy: string;
  dagRunId: string;
  status: RunStatus;
  stage: RunStage;
  progress: number;
  executedCells: number;
  totalCells: number;
  mlflowRunId: string | null;
  map50: number | null;
  registeredModelName: string | null;
  registeredModelVersion: string | null;
  errorMessage: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type CellOutput =
  | { type: 'stream'; name: string; text: string }
  | { type: 'text'; text: string }
  | { type: 'image'; imagePng: string }
  | { type: 'error'; ename: string; evalue: string; traceback: string[] };

export type NotebookCell = {
  index: number;
  cellType: 'code' | 'markdown';
  source: string;
  executionCount: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  tags: string[];
  outputs: CellOutput[];
};

export type CreateRunInput = {
  assetId: string;
  version: string;
  parameters: RunParameters;
  resource: string;
  environment: string;
};

function configuredApiBase(): string | undefined {
  try {
    // vinext는 정의된 NEXT_PUBLIC_* 값만 빌드 시 문자열로 치환한다.
    // 정의되지 않았으면 브라우저에 process가 없어 ReferenceError가 나므로 기본값으로 대체한다.
    return process.env.NEXT_PUBLIC_PRIZM_API_BASE;
  } catch {
    return undefined;
  }
}

export const PRIZM_API_BASE = configuredApiBase() || 'http://localhost:8081';
export const MLFLOW_UI_BASE = 'http://localhost:5050';

export class PrizmApiError extends Error {}

export async function createRun(input: CreateRunInput): Promise<Run> {
  let response: Response;
  try {
    response = await fetch(`${PRIZM_API_BASE}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new PrizmApiError('실행 서버(8081)에 연결할 수 없습니다');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new PrizmApiError(body?.message ?? `실행 요청에 실패했습니다 (${response.status})`);
  }
  return (await response.json()) as Run;
}

export async function listRuns(assetId?: string): Promise<Run[]> {
  const query = assetId ? `?assetId=${encodeURIComponent(assetId)}` : '';
  const response = await fetch(`${PRIZM_API_BASE}/api/runs${query}`);
  if (!response.ok) throw new PrizmApiError(`실행 목록을 불러오지 못했습니다 (${response.status})`);
  return (await response.json()) as Run[];
}

export function runStreamUrl(runId: string) {
  return `${PRIZM_API_BASE}/api/runs/${encodeURIComponent(runId)}/stream`;
}

export function isFinishedRun(run: Pick<Run, 'status'>) {
  return run.status === 'SUCCEEDED' || run.status === 'FAILED';
}
