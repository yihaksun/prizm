'use client';

import { useEffect, useState } from 'react';
import { isFinishedRun, runStreamUrl, type NotebookCell, type Run } from '@/lib/prizm-api';

export type RunStreamState = { run: Run; cells: NotebookCell[]; log: string[]; connected: boolean };

/** 실행 하나의 SSE를 구독한다. 다른 실행을 보여줄 때는 호출 컴포넌트를 key로 다시 만든다. */
export function useRunStream(initialRun: Run): RunStreamState {
  const [state, setState] = useState<RunStreamState>({ run: initialRun, cells: [], log: [], connected: false });
  const runId = initialRun.id;

  useEffect(() => {
    const source = new EventSource(runStreamUrl(runId));
    source.onopen = () => setState((current) => ({ ...current, connected: true }));
    source.onerror = () => setState((current) => ({ ...current, connected: false }));
    source.addEventListener('notebook', (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as { cells: NotebookCell[] };
      setState((current) => ({ ...current, cells: payload.cells }));
    });
    source.addEventListener('log', (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as { lines: string[] };
      setState((current) => ({ ...current, log: payload.lines }));
    });
    // 백엔드는 notebook·log 다음에 run을 보낸다. 종료 상태면 셀·로그를 받은 뒤 연결을 닫는다.
    source.addEventListener('run', (event: MessageEvent<string>) => {
      const run = JSON.parse(event.data) as Run;
      const finished = isFinishedRun(run);
      if (finished) source.close();
      setState((current) => ({ ...current, run, connected: finished ? false : current.connected }));
    });
    return () => source.close();
  }, [runId]);

  return state;
}
