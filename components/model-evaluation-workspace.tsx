'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  ChevronDown,
  CircleCheck,
  Clock3,
  Filter,
  ShieldCheck,
} from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CodeAssetsTopbar, PortalNavigation } from '@/components/code-assets-workspace';
import { PortalWorkspaceTabs } from '@/components/portal-workspace-tabs';
import { ModelEvaluationDetail } from '@/components/vision-mlops-demo';

type EvaluationStatus = '평가 대기중' | '평가 완료';

type EvaluationRecord = {
  id: string;
  projectId: string;
  project: string;
  model: string;
  candidate: string;
  baseline: string;
  dataset: string;
  status: EvaluationStatus;
  requestedBy: string;
  requestedAt: string;
  result: string;
};

const evaluations: EvaluationRecord[] = [
  { id: 'EVAL-260912-0048', projectId: 'PRJ000212', project: '용접 품질 고도화', model: 'Weld Detector', candidate: '260912-0004', baseline: '260911-0003', dataset: '현장 검증 이미지 286장', status: '평가 대기중', requestedBy: '이학선', requestedAt: '오늘 16:03', result: '현장 판정 필요' },
  { id: 'EVAL-260911-0041', projectId: 'PRJ000212', project: '용접 품질 고도화', model: 'Weld Detector', candidate: '260911-0003', baseline: '260812-0002', dataset: 'EVAL-USN-WELD-009 · v5', status: '평가 완료', requestedBy: '이학선', requestedAt: '09.11 15:42', result: '7 / 7 PASS' },
  { id: 'EVAL-260905-0036', projectId: 'PRJ000212', project: '용접 품질 고도화', model: 'Weld Detector', candidate: '260905-0002', baseline: '260812-0002', dataset: 'EVAL-USN-WELD-009 · v4', status: '평가 완료', requestedBy: '김민재', requestedAt: '09.05 11:18', result: '6 / 7 PASS' },
  { id: 'EVAL-260912-0051', projectId: 'PRJ000274', project: 'Surface Zero Defect', model: 'Surface Defect Inspector', candidate: '260912-0006', baseline: '260827-0005', dataset: '도장 현장 평가셋 · v8', status: '평가 대기중', requestedBy: '박지원', requestedAt: '오늘 15:20', result: '품질팀 확인 대기' },
  { id: 'EVAL-260910-0039', projectId: 'PRJ000274', project: 'Surface Zero Defect', model: 'Surface Defect Inspector', candidate: '260910-0005', baseline: '260827-0004', dataset: '도장 현장 평가셋 · v7', status: '평가 완료', requestedBy: '박지원', requestedAt: '09.10 09:08', result: '5 / 6 PASS' },
  { id: 'EVAL-260912-0054', projectId: 'PRJ000341', project: 'Cell Quality Intelligence', model: 'Battery Cell Vision', candidate: '260912-0003', baseline: '260829-0002', dataset: '셀 외관 검증셋 · v11', status: '평가 대기중', requestedBy: '이수현', requestedAt: '오늘 14:47', result: '평가 대기' },
];

const projects = [
  { id: 'PRJ000212', name: '용접 품질 고도화' },
  { id: 'PRJ000274', name: 'Surface Zero Defect' },
  { id: 'PRJ000341', name: 'Cell Quality Intelligence' },
];

export function ModelEvaluationWorkspace() {
  const [projectId, setProjectId] = useState('PRJ000212');
  const [scope, setScope] = useState<'전체' | EvaluationStatus>('전체');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const evaluationId = new URLSearchParams(window.location.search).get('evaluation');
      const record = evaluations.find((item) => item.id === evaluationId);
      if (record) {
        setProjectId(record.projectId);
        setSelectedId(record.id);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const projectRows = useMemo(() => evaluations.filter((item) => item.projectId === projectId), [projectId]);
  const visibleRows = useMemo(() => projectRows.filter((item) => scope === '전체' || item.status === scope), [projectRows, scope]);
  const selected = evaluations.find((item) => item.id === selectedId);

  const openEvaluation = (record: EvaluationRecord) => {
    setSelectedId(record.id);
    window.history.replaceState(null, '', `/evaluation/models?evaluation=${record.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeEvaluation = () => {
    setSelectedId(null);
    window.history.replaceState(null, '', '/evaluation/models');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <SidebarProvider style={{ '--sidebar-width': '248px' } as CSSProperties}>
      <PortalNavigation screen="catalog" activeNavigation={{ group: '평가관리', child: '모델 평가' }} />
      <div className="app-shell code-assets-shell">
        <CodeAssetsTopbar />
        <PortalWorkspaceTabs current="model-evaluation" />
        {selected ? (
          <ModelEvaluationDetail
            onBack={closeEvaluation}
            onPromote={() => { window.location.href = '/assets/models?asset=PRJ000212-M-0001'; }}
          />
        ) : (
          <main className="evaluation-workspace-page">
            <header className="evaluation-workspace-heading">
              <div>
                <span className="code-page-kicker">MODEL EVALUATION WORKSPACE</span>
                <h1>모델 평가</h1>
                <p>과제별 평가 요청과 완료 결과를 확인하고, 현장 기준으로 운영 승격을 판단합니다.</p>
              </div>
              <label className="execution-native-select evaluation-project-select">
                <span>과제 선택</span>
                <span className="execution-native-select-control">
                  <select value={projectId} onChange={(event) => { setProjectId(event.target.value); setScope('전체'); }}>
                    {projects.map((project) => <option value={project.id} key={project.id}>{project.id} · {project.name}</option>)}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" />
                </span>
              </label>
              <div className="evaluation-summary">
                <span><Clock3 size={15} /><strong>{projectRows.filter((row) => row.status === '평가 대기중').length}</strong><small>평가 대기중</small></span>
                <span><CircleCheck size={15} /><strong>{projectRows.filter((row) => row.status === '평가 완료').length}</strong><small>평가 완료</small></span>
              </div>
            </header>

            <section className="evaluation-queue">
              <header>
                <div>
                  <span>EVALUATION QUEUE</span>
                  <h2>평가 목록</h2>
                </div>
                <nav aria-label="평가 상태 필터">
                  {(['전체', '평가 대기중', '평가 완료'] as const).map((item) => (
                    <button type="button" className={scope === item ? 'is-active' : ''} onClick={() => setScope(item)} key={item}>
                      {item === '전체' && <Filter size={13} />}{item}
                      <b>{item === '전체' ? projectRows.length : projectRows.filter((row) => row.status === item).length}</b>
                    </button>
                  ))}
                </nav>
              </header>
              <div className="evaluation-table-wrap">
                <table className="evaluation-table">
                  <thead><tr><th>상태</th><th>평가 대상 모델</th><th>비교 버전</th><th>평가 데이터</th><th>요청자</th><th>요청 시각</th><th>결과</th><th aria-label="상세 화면" /></tr></thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.id} onClick={() => openEvaluation(row)}>
                        <td><span className={row.status === '평가 대기중' ? 'evaluation-status is-waiting' : 'evaluation-status is-complete'}><i />{row.status}</span></td>
                        <td><span className="pipeline-project-name">{row.project}</span><strong>{row.model}</strong><small>{row.id}</small></td>
                        <td><span className="evaluation-version is-candidate">{row.candidate}</span><ArrowRight size={12} /><span className="evaluation-version">{row.baseline}</span></td>
                        <td>{row.dataset}</td>
                        <td>{row.requestedBy}</td>
                        <td>{row.requestedAt}</td>
                        <td><strong className={row.status === '평가 완료' ? 'evaluation-result is-complete' : 'evaluation-result'}>{row.result}</strong></td>
                        <td><button type="button" onClick={(event) => { event.stopPropagation(); openEvaluation(row); }}>{row.status === '평가 대기중' ? '평가하기' : '결과 보기'} <ArrowRight size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer><ShieldCheck size={15} /><span>실험에서 생성된 후보 모델은 자동 평가를 거쳐 이 목록에 등록됩니다.</span></footer>
            </section>
          </main>
        )}
      </div>
    </SidebarProvider>
  );
}
