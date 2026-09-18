'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, FileCode2, RotateCcw, ShieldCheck, TerminalSquare, TriangleAlert } from 'lucide-react';
import { LiveNotebook } from '@/components/live-notebook';
import { useRunStream } from '@/hooks/use-run-stream';
import { MLFLOW_UI_BASE, type Run, type RunStage } from '@/lib/prizm-api';

const stageOrder: RunStage[] = ['PREPARING', 'DATA', 'TRAINING', 'REGISTERING', 'DONE'];
const trackSteps = ['환경 준비', '데이터 연결', '모델 학습', '평가·등록'];
const NOT_SUPPORTED = '실제 실행에서는 아직 지원하지 않습니다';

function progressCopy(run: Run): { title: string; detail: string } {
  if (run.status === 'FAILED') return { title: '실행 실패', detail: run.errorMessage ?? '실행 중 오류가 발생했습니다.' };
  if (run.status === 'SUCCEEDED') return { title: '실행 완료', detail: run.errorMessage ?? '전체 실행이 정상적으로 완료되었습니다.' };
  if (run.status === 'QUEUED') return { title: '요청 접수', detail: 'Airflow 대기열에서 실행 순서를 기다리고 있습니다.' };
  if (run.stage === 'PREPARING' || run.stage === 'DATA') return { title: '자원 준비', detail: 'Airflow가 노트북과 실행 환경을 준비하고 있습니다.' };
  if (run.stage === 'REGISTERING') return { title: '실행 중', detail: 'MLflow에 등록된 모델 버전을 확인하고 있습니다.' };
  return { title: '실행 중', detail: `노트북 코드 셀 ${run.executedCells}/${run.totalCells} 완료` };
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString('ko-KR', { hour12: false }) : '-';
}

export function LiveRunDetail({ run: initialRun, title, project, onBack }: { run: Run; title: string; project: string; onBack: () => void }) {
  const { run, cells, log, connected } = useRunStream(initialRun);
  const copy = progressCopy(run);
  const stageIndex = stageOrder.indexOf(run.stage);
  const failed = run.status === 'FAILED';
  const succeeded = run.status === 'SUCCEEDED';
  const syncState = succeeded ? '실행 완료' : failed ? '실행 실패' : connected ? '실시간 동기화 중' : '연결 중';
  const modelName = run.registeredModelName ?? '';
  const modelVersion = run.registeredModelVersion ?? '';

  return (
    <>
      <button className="detail-back" type="button" onClick={onBack}><ArrowLeft size={15} /> 실험 대시보드</button>
      <header className="run-detail-header">
        <div><span className="code-page-kicker">{run.id} / {run.stage}</span><span className="run-project-name">{project}</span><h1>{title}</h1><p>{run.assetId} · {run.assetVersion} · {run.codeKey}@{run.codeVersion}</p></div>
        <div className="run-header-actions"><button type="button" disabled title={NOT_SUPPORTED}><RotateCcw size={15} /> 동일 조건으로 다시 실행</button><button type="button" className="run-stop-button" disabled title={NOT_SUPPORTED}>실행 중지</button></div>
      </header>
      <section className={failed ? 'run-progress-card live-run-progress is-failed' : 'run-progress-card live-run-progress'}>
        <div className="run-progress-heading"><div><span className={succeeded ? 'run-live-dot is-complete' : failed ? 'run-live-dot is-failed' : 'run-live-dot'} /><strong>{copy.title}</strong><small>{copy.detail}</small></div><b>{run.progress}%</b></div>
        <div className="run-large-progress"><i style={{ width: `${run.progress}%` }} /></div>
        <div className="run-stage-track">
          {trackSteps.map((label, index) => {
            const done = succeeded || stageIndex > index;
            const current = !done && stageIndex === index;
            const className = done ? 'is-done' : current ? (failed ? 'is-failed' : 'is-current') : '';
            return <span key={label} className={className}>{done ? <Check size={13} /> : current && failed ? <TriangleAlert size={13} /> : <Clock3 size={13} />}{label}</span>;
          })}
        </div>
      </section>
      <div className="run-detail-grid run-notebook-grid">
        <section className="run-notebook-result">
          <header><div><FileCode2 size={16} /><span><strong>실시간 Notebook</strong><small>Papermill 실행 스냅샷 · 셀 단위 동기화</small></span></div><div><span className={succeeded ? 'run-output-state is-complete' : 'run-output-state'}>{syncState}</span></div></header>
          <LiveNotebook cells={cells} />
        </section>
        <aside className="run-context-panel">
          <section>
            <span>실행 조건</span>
            <dl>
              {Object.entries(run.parameters).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
              <div><dt>DAG Run</dt><dd>{run.dagRunId}</dd></div>
              <div><dt>코드</dt><dd>{run.codeKey}@{run.codeVersion}</dd></div>
              <div><dt>실행 자원(기록)</dt><dd>{run.resource}</dd></div>
              <div><dt>실행 환경(기록)</dt><dd>{run.environment}</dd></div>
              <div><dt>실행자</dt><dd>{run.requestedBy}</dd></div>
              <div><dt>요청 시각</dt><dd>{formatDateTime(run.requestedAt)}</dd></div>
              <div><dt>종료 시각</dt><dd>{formatDateTime(run.finishedAt)}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
      <details className="run-log-details"><summary><span><TerminalSquare size={15} /> Airflow 실행 로그</span><small>execute_notebook 태스크 · 마지막 200줄</small><ChevronDown size={14} /></summary><pre>{log.length ? log.join('\n') : '아직 로그가 없습니다.'}</pre></details>
      {succeeded && (
        <section className="run-result-strip live-run-result">
          <div>{modelVersion ? <ShieldCheck size={22} /> : <TriangleAlert size={22} />}<span><strong>{modelVersion ? 'MLflow 모델 등록 완료' : '모델 등록 정보 없음'}</strong><small>{modelVersion ? `MLflow run ${run.mlflowRunId ?? '-'}` : run.errorMessage ?? 'MLflow에서 모델 등록 정보를 찾지 못했습니다'}</small></span></div>
          <div><span>mAP50</span><strong>{run.map50 === null ? '-' : run.map50.toFixed(3)}</strong></div>
          <div><span>생성 모델</span><strong>{modelVersion ? `${modelName} v${modelVersion}` : '-'}</strong></div>
          <div className="live-run-result-actions">
            <Link href="/assets/models">모델 자산 확인 <ArrowRight size={14} /></Link>
            {modelVersion && <a href={`${MLFLOW_UI_BASE}/#/models/${encodeURIComponent(modelName)}/versions/${encodeURIComponent(modelVersion)}`} target="_blank" rel="noreferrer">MLflow 원본 <ArrowUpRight size={13} /></a>}
          </div>
        </section>
      )}
    </>
  );
}
