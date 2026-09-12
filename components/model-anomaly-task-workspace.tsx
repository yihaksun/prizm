'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, BellRing, Check, CheckCircle2, Clock3, ExternalLink, Factory,
  ImageIcon, Mail, MessageSquareText, ShieldAlert, TriangleAlert, UserRound, Workflow,
} from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CodeAssetsTopbar, PortalNavigation } from '@/components/code-assets-workspace';
import { PortalWorkspaceTabs } from '@/components/portal-workspace-tabs';

const tasks = [
  { id: 'TASK-260912-017', type: '모델 성능 이상', title: 'Weld Detector 원인 확인', meta: '울산 · 차체 2라인', time: '4시간 이내', tone: 'urgent' },
  { id: 'TASK-260912-012', type: '모델 평가', title: 'Surface Detector 승격 판단', meta: '아산 · 도장 1라인', time: '오늘 16:00', tone: 'normal' },
];

export function ModelAnomalyTaskWorkspace() {
  const [decision, setDecision] = useState('재학습 필요');
  const [note, setNote] = useState('야간 조도 변화로 미세 크랙 특징이 약화된 것으로 판단됩니다. 저신뢰 이미지와 현장 확정 불량을 신규 학습 데이터에 반영합니다.');
  const [mlComplete, setMlComplete] = useState(false);

  const openCatalog = () => {
    window.open('/image-catalog/review?incident=INC-260912-0042', '_blank', 'noopener,noreferrer');
  };

  return <SidebarProvider style={{ '--sidebar-width': '248px' } as CSSProperties}>
    <PortalNavigation screen="catalog" activeNavigation={{ group: '나의 작업', child: '할 일' }} />
    <div className="app-shell code-assets-shell">
      <CodeAssetsTopbar />
      <PortalWorkspaceTabs current="my-tasks" />
      <div className="my-task-layout">
        <aside className="task-inbox">
          <header><div><span>MY WORK</span><h1>나의 작업</h1></div><b>2</b></header>
          <div className="task-inbox-tabs"><button className="is-active" type="button">할 일 <b>2</b></button><button type="button">처리 이력</button></div>
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
            <section className="task-signal-card"><header><span>SIGNAL SUMMARY</span><h2>왜 작업이 생성됐나요?</h2></header><dl><div><dt>미세 크랙 검출률</dt><dd><strong>88.6%</strong><small>기준 92.0% 미달</small></dd></div><div><dt>저신뢰 이미지</dt><dd><strong>286건</strong><small>최근 60분 자동 선별</small></dd></div><div><dt>입력 분포 변화</dt><dd><strong>+18.4%</strong><small>야간 저조도 이미지</small></dd></div><div><dt>대상 모델</dt><dd><strong>PRJ000212-M-0001</strong><small>260911-0003 · Production</small></dd></div></dl></section>
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
      </div>
    </div>
  </SidebarProvider>;
}

function TaskIncidentProcess({ mlComplete }: { mlComplete: boolean }) {
  return <section className="task-process"><header><div><span>CLOSED-LOOP RESPONSE</span><h2>이상 감지 대응 프로세스</h2></div><p>각 담당자의 판단과 근거가 하나의 사건 기록에 남습니다.</p></header><div className="task-process-grid"><article className="is-done"><i><BellRing size={17} /></i><span>시작 이벤트</span><strong>성능 이상 감지</strong><small>09:12 · 자동 생성</small><em><Check size={12} /> 완료</em></article><i className="task-process-arrow"><ArrowRight size={16} /></i><div className="task-process-split"><i>+</i></div><div className="task-process-lanes"><article className={mlComplete ? 'is-done' : 'is-active'}><i><UserRound size={17} /></i><span>ML 엔지니어</span><strong>모델·데이터 원인 확인</strong><small>이학선 책임매니저</small><em>{mlComplete ? <><Check size={12} /> 완료</> : '내 작업 · 대기'}</em></article><article className="is-done"><i><Factory size={17} /></i><span>공정 엔지니어</span><strong>실물·설비 조건 확인</strong><small>울산 차체품질팀</small><em><Check size={12} /> 09:19 완료</em></article></div><div className={mlComplete ? 'task-process-split is-merge is-open' : 'task-process-split is-merge'}><i>+</i></div><i className="task-process-arrow"><ArrowRight size={16} /></i><article className={mlComplete ? 'is-done' : 'is-locked'}><i><Mail size={17} /></i><span>종료 이벤트</span><strong>결과 메일 발송</strong><small>품질 · 공정 · MLOps</small><em>{mlComplete ? <><Check size={12} /> 발송 완료</> : '두 확인 완료 후'}</em></article></div></section>;
}
