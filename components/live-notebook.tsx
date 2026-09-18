'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import type { CellOutput, NotebookCell } from '@/lib/prizm-api';

const statusLabel: Record<NotebookCell['status'], string> = {
  completed: '완료',
  running: '실행 중',
  pending: '대기',
  failed: '오류',
};

const PARAMETER_TAGS = ['parameters', 'injected-parameters'];

function MarkdownCell({ source }: { source: string }) {
  return (
    <div className="live-notebook-markdown">
      {source.split('\n').map((line, index) => {
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) return <p key={index} className={`live-notebook-heading level-${Math.min(heading[1].length, 3)}`}>{heading[2]}</p>;
        return line.trim() ? <p key={index}>{line}</p> : null;
      })}
    </div>
  );
}

function OutputView({ output }: { output: CellOutput }) {
  switch (output.type) {
    case 'stream':
      return <pre className={output.name === 'stderr' ? 'live-notebook-stream is-stderr' : 'live-notebook-stream'}>{output.text}</pre>;
    case 'text':
      return <pre className="live-notebook-text">{output.text}</pre>;
    case 'image':
      return <Image className="live-notebook-image" src={`data:image/png;base64,${output.imagePng}`} alt="노트북 출력 이미지" width={640} height={480} unoptimized />;
    case 'error':
      return <pre className="live-notebook-error"><strong>{output.ename}: {output.evalue}</strong>{'\n'}{output.traceback.join('\n')}</pre>;
  }
}

export function LiveNotebook({ cells }: { cells: NotebookCell[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const runningIndex = cells.find((cell) => cell.status === 'running')?.index ?? null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || runningIndex === null || !followRef.current) return;
    const cell = container.querySelector<HTMLElement>(`[data-cell-index="${runningIndex}"]`);
    if (cell) container.scrollTo({ top: Math.max(0, cell.offsetTop - 24), behavior: 'smooth' });
  }, [runningIndex, cells]);

  const resumeFollowNearBottom = () => {
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollHeight - container.scrollTop - container.clientHeight < 48) followRef.current = true;
  };

  return (
    <div
      ref={containerRef}
      className="live-notebook"
      onScroll={resumeFollowNearBottom}
      onWheel={(event) => {
        if (event.deltaY < 0) followRef.current = false;
      }}
    >
      {cells.length === 0 && <div className="live-notebook-empty">노트북 실행이 시작되면 셀이 여기에 표시됩니다.</div>}
      {cells.map((cell) => cell.cellType === 'markdown' ? (
        <section key={cell.index} data-cell-index={cell.index} className="live-notebook-cell is-markdown">
          <MarkdownCell source={cell.source} />
        </section>
      ) : (
        <section key={cell.index} data-cell-index={cell.index} className={`live-notebook-cell is-code is-${cell.status}`}>
          <header>
            <span className="live-notebook-count">[{cell.executionCount ?? ' '}]</span>
            {cell.tags.some((tag) => PARAMETER_TAGS.includes(tag)) && <span className="live-notebook-param-badge">Papermill 주입 파라미터</span>}
            <span className={`live-notebook-status is-${cell.status}`}>{statusLabel[cell.status]}</span>
          </header>
          <pre className="live-notebook-source">{cell.source}</pre>
          {cell.outputs.length > 0 && <div className="live-notebook-outputs">{cell.outputs.map((output, index) => <OutputView key={index} output={output} />)}</div>}
        </section>
      ))}
    </div>
  );
}
