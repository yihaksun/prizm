'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, BellRing, Check, CheckCircle2, Clock3, Download, ExternalLink, Factory,
  ImageIcon, LayoutList, Mail, MessageSquareText, ShieldAlert, TableProperties, TriangleAlert, UserRound, Workflow,
} from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CodeAssetsTopbar, PortalNavigation } from '@/components/code-assets-workspace';
import { PortalWorkspaceTabs } from '@/components/portal-workspace-tabs';
import { PortalPageFrame, PortalPageHeader, PortalPrismAtmosphere, PortalWorkspaceSurface } from '@/components/portal-page-primitives';

const tasks = [
  { id: 'TASK-260912-017', type: '모델 성능 이상', title: 'Weld Detector 원인 확인', meta: '울산 · 차체 2라인', time: '4시간 이내', tone: 'urgent' },
  { id: 'TASK-260912-012', type: '모델 평가', title: 'Surface Detector 승격 판단', meta: '아산 · 도장 1라인', time: '오늘 16:00', tone: 'normal' },
];

const historyCategories = [
  { label: '전체', count: 128 },
  { label: '모델 이상 감지', count: 42 },
  { label: '모델 평가', count: 36 },
  { label: '배포 승인', count: 28 },
  { label: '데이터 검토', count: 22 },
] as const;

type HistoryCategory = typeof historyCategories[number]['label'];

const workHistory = [
  { id: 'TASK-260912-017', category: '모델 이상 감지', title: 'Weld Detector 미세 크랙 검출률 하락', model: 'Weld Detector', modelVersion: 'v2.5.0', project: '울산 · 용접 품질 고도화', occurredAt: '2026.09.12 09:12', dueAt: '2026.09.12 13:12', status: '처리 중', owner: '이학선 책임매니저', team: '제조AI기술개발팀', completedAt: '—', result: 'ML 엔지니어 원인 검토 진행 중' },
  { id: 'TASK-260911-031', category: '모델 평가', title: 'Surface Detector 260911-0004 최종 평가', model: 'Surface Detector', modelVersion: 'v1.8.1', project: '아산 · 도장 표면 검사', occurredAt: '2026.09.11 15:42', dueAt: '2026.09.12 16:00', status: '처리 완료', owner: '박지윤 책임매니저', team: '제조AI기술개발팀', completedAt: '2026.09.12 10:28', result: 'Production 승격 승인' },
  { id: 'TASK-260910-024', category: '배포 승인', title: 'Battery Cell Detector 글로벌 배포 승인', model: 'Battery Cell Detector', modelVersion: 'v3.1.0', project: '전동화 · 셀 외관 검사', occurredAt: '2026.09.10 11:20', dueAt: '2026.09.11 18:00', status: '처리 완료', owner: '김서현 책임매니저', team: '전동화품질팀', completedAt: '2026.09.11 14:05', result: '울산·체코·미국 거점 배포 승인' },
  { id: 'TASK-260909-019', category: '데이터 검토', title: '저신뢰 용접 이미지 라벨 품질 검토', model: 'Weld Detector', modelVersion: 'v2.4.1', project: '울산 · 용접 품질 고도화', occurredAt: '2026.09.09 08:35', dueAt: '2026.09.10 17:00', status: '처리 완료', owner: '최민석 매니저', team: '울산 차체품질팀', completedAt: '2026.09.10 15:47', result: '1,284건 검수 및 데이터셋 반영' },
  { id: 'TASK-260908-014', category: '모델 이상 감지', title: 'Surface Detector 도장 기포 오검출 증가', model: 'Surface Detector', modelVersion: 'v1.8.0', project: '아산 · 도장 표면 검사', occurredAt: '2026.09.08 13:07', dueAt: '2026.09.08 17:07', status: '처리 완료', owner: '정우진 매니저', team: '아산 도장품질팀', completedAt: '2026.09.08 14:36', result: '가성 판정 · 카메라 렌즈 세척 조치' },
  { id: 'TASK-260907-011', category: '모델 평가', title: 'Battery Cell Detector 260907-0002 재평가', model: 'Battery Cell Detector', modelVersion: 'v3.1.0-rc1', project: '전동화 · 셀 외관 검사', occurredAt: '2026.09.07 10:15', dueAt: '2026.09.07 18:00', status: '처리 완료', owner: '김서현 책임매니저', team: '전동화품질팀', completedAt: '2026.09.07 16:40', result: '정확도 개선 확인 · Production 유지' },
  { id: 'TASK-260906-008', category: '배포 승인', title: 'Surface Detector 아산 2공장 확대 배포', model: 'Surface Detector', modelVersion: 'v1.8.0', project: '아산 · 도장 표면 검사', occurredAt: '2026.09.06 09:00', dueAt: '2026.09.07 09:00', status: '처리 완료', owner: '박지윤 책임매니저', team: '제조AI기술개발팀', completedAt: '2026.09.06 17:22', result: '아산 2공장 배포 승인' },
  { id: 'TASK-260905-021', category: '데이터 검토', title: '차체 용접 이미지 라벨 2차 검수', model: 'Weld Detector', modelVersion: 'v2.4.1', project: '울산 · 용접 품질 고도화', occurredAt: '2026.09.05 11:40', dueAt: '2026.09.06 11:40', status: '처리 완료', owner: '최민석 매니저', team: '울산 차체품질팀', completedAt: '2026.09.06 09:05', result: '892건 검수 완료 및 반영' },
  { id: 'TASK-260904-006', category: '모델 이상 감지', title: 'Battery Cell Detector 이상 점수 변동', model: 'Battery Cell Detector', modelVersion: 'v3.0.4', project: '전동화 · 셀 외관 검사', occurredAt: '2026.09.04 07:55', dueAt: '2026.09.04 11:55', status: '처리 완료', owner: '김서현 책임매니저', team: '전동화품질팀', completedAt: '2026.09.04 10:50', result: '가성 판정 · 조명 보정' },
  { id: 'TASK-260902-003', category: '모델 평가', title: 'Weld Detector 260902-0002 정기 평가', model: 'Weld Detector', modelVersion: 'v2.4.1', project: '울산 · 용접 품질 고도화', occurredAt: '2026.09.02 08:20', dueAt: '2026.09.02 17:00', status: '처리 완료', owner: '이학선 책임매니저', team: '제조AI기술개발팀', completedAt: '2026.09.02 15:12', result: '성능 유지 확인' },
];

const completedAnomalyHistory = [
  { id: 'INC-260908-0037', title: 'Surface Detector 도장 기포 오검출 증가', model: 'Surface Detector', modelVersion: 'v1.8.0', location: '아산 도장 1라인', occurredAt: '2026.09.08 13:07', dueAt: '2026.09.08 17:07', status: '처리 완료', owner: '정우진 매니저', completedAt: '2026.09.08 14:36', team: '아산 도장품질팀', category: '현장 조건 조치', verdict: '가성', note: '카메라 렌즈 오염으로 대비가 낮아졌습니다. 렌즈 세척과 조명 보정 후 정상 범위로 회복했습니다.' },
  { id: 'INC-260901-0028', title: 'Torque Anomaly 입력 분포 변화', model: 'Torque Anomaly Detector', modelVersion: 'v1.2.0', location: '광명 의장 2라인', occurredAt: '2026.09.01 07:42', dueAt: '2026.09.01 11:42', status: '처리 완료', owner: '최민석 매니저', completedAt: '2026.09.01 10:18', team: '공정지능화팀', category: '추가 관찰', verdict: '진성', note: '신규 차종 투입 구간의 토크 분포 변화로 확인했습니다. 차종별 기준선을 분리하고 7일간 추가 관찰합니다.' },
  { id: 'INC-260829-0019', title: 'Battery Cell Detector 이상 점수 급등', model: 'Battery Cell Detector', modelVersion: 'v3.0.3', location: '울산 전동화 1라인', occurredAt: '2026.08.29 18:21', dueAt: '2026.08.30 10:00', status: '처리 완료', owner: '김서현 책임매니저', completedAt: '2026.08.30 09:24', team: '전동화품질팀', category: '재학습 필요', verdict: '진성', note: '신규 공급사 셀 표면의 반사 패턴이 원인이었습니다. 확정 불량 846건을 포함해 모델을 재학습했습니다.' },
];

export function ModelAnomalyTaskWorkspace({ view = 'todo' }: { view?: 'todo' | 'history' }) {
  const [historyCategory, setHistoryCategory] = useState<HistoryCategory>('전체');
  const [decision, setDecision] = useState('재학습 필요');
  const [note, setNote] = useState('야간 조도 변화로 미세 크랙 특징이 약화된 것으로 판단됩니다. 저신뢰 이미지와 현장 확정 불량을 신규 학습 데이터에 반영합니다.');
  const [mlComplete, setMlComplete] = useState(false);

  const openCatalog = () => {
    window.open('/image-catalog/review?incident=INC-260912-0042', '_blank', 'noopener,noreferrer');
  };

  return <SidebarProvider style={{ '--sidebar-width': '248px' } as CSSProperties}>
    <PortalNavigation screen="catalog" activeNavigation={{ group: '나의 작업', child: view === 'history' ? '작업 이력' : '할 일' }} />
    <PortalWorkspaceSurface>
      <CodeAssetsTopbar />
      <PortalWorkspaceTabs current="my-tasks" />
      <PortalPrismAtmosphere />
      <PortalPageFrame className="my-task-page">
        <PortalPageHeader
          className="my-task-page-heading"
          kicker={view === 'history' ? 'MY WORK / AUDIT TRAIL' : 'MY WORK / ACTION CENTER'}
          title={view === 'history' ? '작업 이력' : '나의 작업'}
          description={view === 'history' ? '업무의 발생부터 판단과 완료까지 모든 처리 근거를 추적합니다.' : '모델 운영에서 발생한 판단과 승인 업무를 우선순위에 따라 처리합니다.'}
          action={view === 'history' ? <div className="my-task-page-status"><span>전체 작업</span><strong>128</strong><small>완료 109건 · 진행 19건</small></div> : <div className="my-task-page-status"><span>처리 대기</span><strong>2</strong><small>긴급 1건 · 오늘 마감 1건</small></div>}
        />
        {view === 'history' ? <TaskHistoryWorkspace category={historyCategory} onCategoryChange={setHistoryCategory} mlComplete={mlComplete} /> :
        <div className="my-task-layout">
        <aside className="task-inbox">
          <header><div><span>TASK INBOX</span><h2>작업함</h2></div><b>2</b></header>
          <div className="task-inbox-list">{tasks.map((task, index) => <button type="button" className={index === 0 ? 'is-selected' : ''} key={task.id}><span className={`task-type ${task.tone}`}><i />{task.type}</span><strong>{task.title}</strong><small>{task.meta}</small><footer><span>{task.id}</span><em><Clock3 size={11} /> {task.time}</em></footer></button>)}</div>
        </aside>

        <main className="task-detail-page">
          <header className="task-detail-header">
            <div><span className="task-detail-eyebrow"><ShieldAlert size={14} /> MODEL INCIDENT · 높음</span><h1>Weld Detector 원인 확인</h1><p>운영 모델이 놓친 미세 크랙 사례를 확인하고 다음 조치를 결정해 주세요.</p></div>
            <dl><div><dt>작업 ID</dt><dd>TASK-260912-017</dd></div><div><dt>담당자</dt><dd>이학선 책임매니저</dd></div><div><dt>기한</dt><dd>오늘 13:12</dd></div></dl>
          </header>

          <section className="task-context-strip"><span><TriangleAlert size={16} /> INC-260912-0042</span><strong>울산 차체 2라인 · 용접 품질 고도화</strong><Link href="/monitoring/models">모니터링에서 보기 <ArrowRight size={13} /></Link></section>

          <div className="task-evidence-grid">
            <section className="task-evidence-card"><header><div><span>MODEL EVIDENCE</span><h2>판정 불일치 사례</h2></div><b>47건 확인</b></header><div className="task-evidence-visual"><Image src="/weld-inspection-defect.png" alt="용접 비드의 미세 크랙 불량 사례" fill sizes="(max-width: 900px) 100vw, 48vw" priority /><span className="ai-prediction">AI 판정 · 정상 82.4%</span><span className="field-verdict"><i /> 현장 재검사 · 미세 크랙</span><i className="crack-focus" /></div><footer><span>IMG_0912_N_0042761</span><span>야간 · 03:18</span><span>Confidence 0.176</span></footer></section>
            <section className="task-signal-card"><header><div><span>SIGNAL SUMMARY</span><h2>왜 작업이 생성됐나요?</h2></div></header><dl><div><dt>미세 크랙 검출률</dt><dd><strong>88.6%</strong><small>기준 92.0% 미달</small></dd></div><div><dt>저신뢰 이미지</dt><dd><strong>286건</strong><small>최근 60분 자동 선별</small></dd></div><div><dt>입력 분포 변화</dt><dd><strong>+18.4%</strong><small>야간 저조도 이미지</small></dd></div><div><dt>대상 모델</dt><dd><strong>PRJ000212-M-0001</strong><small>260911-0003 · Production</small></dd></div></dl></section>
          </div>

          <TaskIncidentProcess mlComplete={mlComplete} />

          <section className="task-review-panel">
            <header><div><span>ML ENGINEER REVIEW</span><h2>확인 결과 입력</h2></div><span className={mlComplete ? 'review-state is-complete' : 'review-state'}>{mlComplete ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}{mlComplete ? '검토 완료' : '내 확인 대기'}</span></header>
            <div className="task-review-body">
              <fieldset disabled={mlComplete}><legend>판단</legend><div>{['재학습 필요', '현장 조건 조치', '추가 관찰', '이상없음 (가성)'].map((item) => <button type="button" className={decision === item ? 'is-selected' : ''} onClick={() => setDecision(item)} key={item}>{decision === item && <Check size={13} />}{item}</button>)}</div></fieldset>
              <label><span>확인 결과</span><textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={mlComplete} /></label>
            </div>
            <footer><span><MessageSquareText size={14} /> 저장하면 공정 엔지니어의 확인 결과와 합쳐져 관계자에게 자동 공유됩니다.</span>{!mlComplete ? <button type="button" onClick={() => setMlComplete(true)}>확인 결과 저장 <ArrowRight size={14} /></button> : <div className="task-review-actions"><button type="button" className="is-catalog" onClick={openCatalog}><ImageIcon size={15} /> 학습 데이터 준비 <ExternalLink size={13} /></button><Link href="/assets/code?pipeline=1&project=PRJ000212"><Workflow size={15} /> 실험 대시보드 열기 <ArrowRight size={13} /></Link></div>}</footer>
          </section>
        </main>
        </div>}
      </PortalPageFrame>
    </PortalWorkspaceSurface>
  </SidebarProvider>;
}

function TaskHistoryWorkspace({ category, onCategoryChange, mlComplete }: { category: HistoryCategory; onCategoryChange: (category: HistoryCategory) => void; mlComplete: boolean }) {
  const [displayMode, setDisplayMode] = useState<'summary' | 'grid'>('summary');
  const anomalyRows = [
    { id: 'INC-260912-0042', title: 'Weld Detector 미세 크랙 검출률 하락', model: 'Weld Detector', modelVersion: 'v2.5.0', location: '울산 차체 2라인', occurredAt: '2026.09.12 09:12', dueAt: '2026.09.12 13:12', status: mlComplete ? '처리 완료' : '처리 중', owner: '이학선 책임매니저', completedAt: mlComplete ? '2026.09.12 10:04' : '—', team: '제조AI기술개발팀', category: mlComplete ? '재학습 필요' : '검토 중', verdict: mlComplete ? '진성' : '판단 대기', note: mlComplete ? '야간 조도 변화로 미세 크랙 특징이 약화됐습니다. 저신뢰 이미지와 현장 확정 불량을 신규 학습 데이터에 반영합니다.' : 'ML 엔지니어가 모델·데이터 원인을 확인하고 있습니다.' },
    ...completedAnomalyHistory,
  ];
  const filtered = category === '전체' ? workHistory : workHistory.filter((row) => row.category === category);

  const exportExcel = () => {
    const rows = category === '모델 이상 감지'
      ? anomalyRows.map((row) => ({ '이상 감지 내용': row.title, '사건 ID': row.id, '거점·공정': row.location, '발생일시': row.occurredAt, '납기': row.dueAt, '상태': row.status, '처리자': row.owner, '소속 부서': row.team, '완료일시': row.completedAt, '선택 카테고리': row.category, '진성/가성': row.verdict, '이상 처리 내용': row.note }))
      : filtered.map((row) => ({ '작업 ID': row.id, '작업 유형': row.category, '작업 항목': row.title, '과제·공정': row.project, '발생일시': row.occurredAt, '납기': row.dueAt, '상태': row.status, '처리자': row.owner, '소속 부서': row.team, '완료일시': row.completedAt, '처리 결과': row.result }));
    const headers = Object.keys(rows[0] ?? {});
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = `﻿${headers.map(escape).join(',')}\r\n${rows.map((row) => headers.map((header) => escape((row as Record<string, unknown>)[header])).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `PRIZM_작업이력_${category}_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <section className="task-history-workspace">
    <header className="task-history-toolbar">
      <div><span>WORK HISTORY</span><h2>전체 작업 발생 및 처리 이력</h2></div>
      <div className="task-history-tools"><p>최근 90일 · 총 128건</p><span className="task-history-view-mode"><button type="button" aria-label="요약 보기" title="요약 보기" className={displayMode === 'summary' ? 'is-active' : ''} onClick={() => setDisplayMode('summary')}><LayoutList size={15} /></button><button type="button" aria-label="그리드 보기" title="그리드 보기" className={displayMode === 'grid' ? 'is-active' : ''} onClick={() => setDisplayMode('grid')}><TableProperties size={15} /></button></span><button className="task-history-export" type="button" onClick={exportExcel}><Download size={14} /> Excel 내보내기</button></div>
    </header>
    <div className="task-history-summary">
      <div><span>전체 발생</span><strong>128</strong></div><div><span>처리 완료</span><strong>109</strong></div><div><span>처리 중</span><strong>19</strong></div><div><span>납기 준수율</span><strong>96.8%</strong></div>
    </div>
    <div className="task-history-categories">{historyCategories.map((item) => <button key={item.label} type="button" className={category === item.label ? 'is-active' : ''} onClick={() => onCategoryChange(item.label)}><span>{item.label}</span><b>{item.count}</b></button>)}</div>
    {displayMode === 'grid' ? <TaskHistoryGrid category={category} workRows={filtered} anomalyRows={anomalyRows} /> : category === '모델 이상 감지' ? <div className="anomaly-history-list">
      <div className="anomaly-history-head"><span>이상 감지 및 일정</span><span>처리 책임 및 판정</span><span>이상 처리 내용</span></div>
      {anomalyRows.map((row) => <article key={row.id}>
        <section className="anomaly-history-incident"><Link href={row.id === 'INC-260912-0042' ? '/work/tasks' : '#'}><strong>{row.title}</strong><small>{row.id} · {row.location}</small></Link><dl><div><dt>발생일시</dt><dd>{row.occurredAt}</dd></div><div><dt>납기</dt><dd>{row.dueAt}</dd></div></dl></section>
        <section className="anomaly-history-owner"><div className="anomaly-history-state"><span className={`history-status ${row.status === '처리 완료' ? 'is-complete' : 'is-progress'}`}>{row.status}</span><span className={`history-verdict ${row.verdict === '진성' ? 'is-true' : row.verdict === '가성' ? 'is-false' : ''}`}>{row.verdict}</span></div><strong>{row.owner}</strong><small>{row.team}</small><dl><div><dt>완료일시</dt><dd>{row.completedAt}</dd></div><div><dt>선택 카테고리</dt><dd><span className="history-category-label">{row.category}</span></dd></div></dl></section>
        <section className="anomaly-history-note"><span>RESPONSE RECORD</span><p>{row.note}</p></section>
      </article>)}
    </div> : <div className="task-history-table-wrap"><table className="task-history-table"><thead><tr><th>작업 항목</th><th>발생일시</th><th>납기</th><th>상태</th><th>처리자 · 부서</th><th>완료일시</th><th>처리 결과</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><Link href={row.id === 'TASK-260912-017' ? '/work/tasks' : '#'}><span className="history-kind">{row.category}</span><strong>{row.title}</strong><small>{row.id} · {row.project}</small></Link></td><td>{row.occurredAt}</td><td>{row.dueAt}</td><td><span className={`history-status ${row.status === '처리 완료' ? 'is-complete' : 'is-progress'}`}>{row.status}</span></td><td><strong>{row.owner}</strong><small>{row.team}</small></td><td>{row.completedAt}</td><td><p>{row.result}</p></td></tr>)}</tbody></table></div>}
  </section>;
}

function TaskHistoryGrid({ category, workRows, anomalyRows }: { category: HistoryCategory; workRows: typeof workHistory; anomalyRows: typeof completedAnomalyHistory }) {
  if (category === '모델 이상 감지') return <div className="task-history-table-wrap is-grid-mode"><table className="task-history-table anomaly-history-table"><thead><tr><th className="col-no">No.</th><th>이상 감지 내용</th><th>모델</th><th>사건 ID</th><th>거점·공정</th><th>발생일시</th><th>납기</th><th>상태</th><th>처리자</th><th>소속 부서</th><th>완료일시</th><th>선택 카테고리</th><th>진성/가성</th><th>이상 처리 내용</th></tr></thead><tbody>{anomalyRows.map((row, index) => <tr key={row.id}><td className="col-no">{index + 1}</td><td>{row.title}</td><td><span className="history-model-tag"><span>{row.model}</span><b>{row.modelVersion}</b></span></td><td>{row.id}</td><td>{row.location}</td><td>{row.occurredAt}</td><td>{row.dueAt}</td><td>{row.status}</td><td>{row.owner}</td><td>{row.team}</td><td>{row.completedAt}</td><td>{row.category}</td><td>{row.verdict}</td><td><p>{row.note}</p></td></tr>)}</tbody></table></div>;
  return <div className="task-history-table-wrap is-grid-mode"><table className="task-history-table work-history-grid-table"><thead><tr><th className="col-no">No.</th><th>작업 ID</th><th>작업 유형</th><th>작업 항목</th><th>모델</th><th>과제·공정</th><th>발생일시</th><th>납기</th><th>상태</th><th>처리자</th><th>소속 부서</th><th>완료일시</th><th>처리 결과</th></tr></thead><tbody>{workRows.map((row, index) => <tr key={row.id}><td className="col-no">{index + 1}</td><td>{row.id}</td><td>{row.category}</td><td>{row.title}</td><td><span className="history-model-tag"><span>{row.model}</span><b>{row.modelVersion}</b></span></td><td>{row.project}</td><td>{row.occurredAt}</td><td>{row.dueAt}</td><td>{row.status}</td><td>{row.owner}</td><td>{row.team}</td><td>{row.completedAt}</td><td><p>{row.result}</p></td></tr>)}</tbody></table></div>;
}

function TaskIncidentProcess({ mlComplete }: { mlComplete: boolean }) {
  return <section className="task-process"><header><div><span>CLOSED-LOOP RESPONSE</span><h2>이상 감지 대응 프로세스</h2></div><p>각 담당자의 판단과 근거가 하나의 사건 기록에 남습니다.</p></header><div className="task-process-grid"><article className="is-done"><i><BellRing size={17} /></i><span>시작 이벤트</span><strong>성능 이상 감지</strong><small>09:12 · 자동 생성</small><em><Check size={12} /> 완료</em></article><i className="task-process-arrow"><ArrowRight size={16} /></i><div className="task-process-split"><i>+</i></div><div className="task-process-lanes"><article className={mlComplete ? 'is-done' : 'is-active'}><i><UserRound size={17} /></i><span>ML 엔지니어</span><strong>모델·데이터 원인 확인</strong><small>이학선 책임매니저</small><em>{mlComplete ? <><Check size={12} /> 완료</> : '내 작업 · 대기'}</em></article><article className="is-done"><i><Factory size={17} /></i><span>공정 엔지니어</span><strong>실물·설비 조건 확인</strong><small>울산 차체품질팀</small><em><Check size={12} /> 09:19 완료</em></article></div><div className={mlComplete ? 'task-process-split is-merge is-open' : 'task-process-split is-merge'}><i>+</i></div><i className="task-process-arrow"><ArrowRight size={16} /></i><article className={mlComplete ? 'is-done' : 'is-locked'}><i><Mail size={17} /></i><span>종료 이벤트</span><strong>결과 메일 발송</strong><small>품질 · 공정 · MLOps</small><em>{mlComplete ? <><Check size={12} /> 발송 완료</> : '두 확인 완료 후'}</em></article></div></section>;
}
