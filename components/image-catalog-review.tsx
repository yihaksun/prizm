'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Filter, ImageIcon,
  Layers3, Search, ShieldCheck, Sparkles, Tag, UserRound,
} from 'lucide-react';

const samples = [
  ['IMG_0912_N_0042761', '0.176', '미세 크랙'],
  ['IMG_0912_N_0042774', '0.203', '미세 크랙'],
  ['IMG_0912_N_0042801', '0.218', '기공'],
  ['IMG_0912_N_0042819', '0.224', '미세 크랙'],
  ['IMG_0912_N_0042840', '0.267', '언더컷'],
  ['IMG_0912_N_0042862', '0.291', '미세 크랙'],
];

export function ImageCatalogReview() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  return <div className="image-catalog-app">
    <header className="catalog-topbar"><div className="catalog-brand"><span><ImageIcon size={20} /></span><div><strong>HMG IMAGE CATALOG</strong><small>Manufacturing Vision Data Service</small></div></div><nav><span>Collections</span><span>Labeling</span><span>Datasets</span></nav><div className="catalog-user"><span className="catalog-external">EXTERNAL SERVICE</span><i>HS</i><div><strong>이학선</strong><small>제조AI기술개발팀</small></div></div></header>
    <main className="catalog-main">
      <Link className="catalog-back" href="/work/tasks"><ArrowLeft size={14} /> PRIZM 작업으로 돌아가기</Link>
      <header className="catalog-page-header"><div><span>INC-260912-0042 · PRIZM에서 전달됨</span><h1>야간 조도 저신뢰 이미지 검토</h1><p>운영 모델이 놓친 가능성이 높은 이미지를 선별하고, 현장 판정으로 Labels을 확정해 기존 데이터셋에 결합합니다.</p></div><div className="catalog-steps"><span className={step >= 1 ? 'is-active' : ''}><i>{step > 1 ? <Check size={12} /> : '1'}</i>샘플 확인</span><b /><span className={step >= 2 ? 'is-active' : ''}><i>{step > 2 ? <Check size={12} /> : '2'}</i>Labels 검토</span><b /><span className={step >= 3 ? 'is-active' : ''}><i>3</i>데이터셋 결합</span></div></header>

      {step < 3 ? <>
        <section className="catalog-query"><div><Search size={16} /><span>울산 차체 2라인 · Weld Detector · 저신뢰 이미지</span></div><button type="button"><Filter size={14} /> 필터 5 <ChevronDown size={13} /></button><dl><div><dt>기간</dt><dd>2026.09.12 02:00–04:00</dd></div><div><dt>모델</dt><dd>PRJ000212-M-0001 · 260911-0003</dd></div><div><dt>Confidence</dt><dd>&lt; 0.35</dd></div><div><dt>현장 판정</dt><dd>불량 확정</dd></div></dl></section>

        <section className="catalog-results"><header><div><span>{step === 1 ? 'SMART COLLECTION' : 'LABELING REVIEW'}</span><h2>{step === 1 ? '선별된 이미지 286건' : 'Labels 검토 및 확정'}</h2></div><div><span><i /> 전체 선택됨</span><strong>{step === 1 ? '286 / 286' : '286 / 286 완료'}</strong></div></header><div className="catalog-image-grid">{samples.map(([id, confidence, label], index) => <article className={step === 2 ? 'is-labeled' : ''} key={id}><div><Image src="/weld-inspection-defect.png" alt={`${id} 용접 검사 이미지`} fill sizes="(max-width: 767px) 45vw, 22vw" style={{ objectPosition: `${42 + index * 3}% center` }} /><span>{step === 2 ? <><Check size={11} /> LABEL VERIFIED</> : `CONF ${confidence}`}</span>{step === 2 && <i className="catalog-label-box" />}</div><footer><span><strong>{id}</strong><small>야간 · 저조도</small></span><b>{label}</b></footer></article>)}</div></section>

        <section className="catalog-action-bar"><div><span>{step === 1 ? <Layers3 size={18} /> : <Tag size={18} />}</span><div><strong>{step === 1 ? '286건을 라벨링 작업으로 만듭니다' : 'Labels 검토가 완료됐습니다'}</strong><small>{step === 1 ? '원본 이미지는 유지되고 선택 결과와 모델 정보가 작업에 함께 저장됩니다.' : '현장 판정 286건과 Labels 438개를 기존 데이터셋에 결합할 준비가 됐습니다.'}</small></div></div><button type="button" onClick={() => setStep(step === 1 ? 2 : 3)}>{step === 1 ? <><UserRound size={15} /> 라벨링 작업 생성</> : <><Sparkles size={15} /> 데이터셋에 결합</>}<ArrowRight size={14} /></button></section>
      </> : <section className="catalog-success"><div className="catalog-success-mark"><CheckCircle2 size={40} /></div><span>DATASET VERSION CREATED</span><h1>새 데이터 버전이 준비됐습니다</h1><p>운영 신호에서 시작한 저신뢰 이미지와 현장 검토 Labels이 기존 자산에 결합됐습니다.</p><div className="catalog-version-card"><header><span><ImageIcon size={18} /> 용접 비드 결함 데이터셋</span><b>최신 버전</b></header><div><span><small>데이터 ID</small><strong>PRJ000212-D-0001</strong></span><i /><span><small>이전 버전</small><strong>260911-0013</strong></span><ArrowRight size={18} /><span className="is-new"><small>신규 버전</small><strong>260912-0014</strong></span></div><footer><span>신규 이미지 <strong>+286</strong></span><span>Labels <strong>+438</strong></span><span><ShieldCheck size={14} /> 품질 검증 <strong>12 / 12 PASS</strong></span></footer></div><div className="catalog-success-actions"><Link href="/assets/data?asset=PRJ000212-D-0001">PRIZM 데이터 자산에서 보기 <ArrowRight size={14} /></Link><button type="button" onClick={() => setStep(1)}>데모 다시 보기</button></div></section>}
    </main>
  </div>;
}
