'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Boxes,
  Code2,
  Database,
  Factory,
  Globe2,
  Network,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { PrizmFlowCanvas } from '@/components/prizm-hero';
import './brand.css';

const aiRays = [
  { name: 'QUALITY INSPECTION', label: '품질 검사', color: '#27d5ef', y: 95 },
  { name: 'ANOMALY DETECTION', label: '이상 감지', color: '#697cff', y: 160 },
  { name: 'PREDICTIVE MAINTENANCE', label: '예지 보전', color: '#48d5a6', y: 225 },
  { name: 'PROCESS OPTIMIZATION', label: '공정 최적화', color: '#f2b64b', y: 290 },
  { name: 'SAFETY INTELLIGENCE', label: '안전 지능', color: '#d87ddb', y: 355 },
];

const resources = [
  { icon: Database, label: 'DATA', title: '검증된 제조 데이터', copy: '공장과 시스템마다 흩어진 데이터를 표준 자산과 버전으로 연결합니다.' },
  { icon: Code2, label: 'CODE', title: '재현 가능한 코드', copy: '파라미터와 실행 조건을 함께 기록해 언제든 같은 결과를 재현합니다.' },
  { icon: Boxes, label: 'MODEL', title: '근거가 연결된 모델', copy: '데이터·코드·평가·배포 이력을 하나의 계보로 추적합니다.' },
  { icon: Workflow, label: 'RUNTIME', title: '표준 실행 기반', copy: '검증된 실행 환경과 중앙 자원을 여러 과제와 공장이 공유합니다.' },
];

const brochureFactories = [
  { code: 'US', name: 'ALABAMA · GEORGIA', x: 754, y: 120 },
  { code: 'MX', name: 'KIA MEXICO', x: 755, y: 151 },
  { code: 'BR', name: 'HMB', x: 796, y: 201 },
  { code: 'CZ · SK', name: 'HMMC · KIA', x: 840, y: 105 },
  { code: 'TR', name: 'HAOS', x: 867, y: 137 },
  { code: 'IN', name: 'CHENNAI · PUNE · AP', x: 899, y: 162 },
  { code: 'CN', name: 'BEIJING · YANCHENG', x: 927, y: 134 },
  { code: 'KR', name: 'HMC · KIA', x: 960, y: 119 },
  { code: 'ID · SG', name: 'HMMI · HMGICS', x: 946, y: 187 },
];

const foundationColors = [
  { name: 'Hyundai Blue', value: '#002C5F', note: '현대자동차의 신뢰와 제품의 중심축' },
  { name: 'Hyundai Sky Blue', value: '#AACAE6', note: '개방성과 연결을 표현하는 공식 보조색' },
  { name: 'Warm Sand', value: '#E4DCD3', note: '산업 환경에 온도와 깊이를 더하는 중성색' },
  { name: 'White', value: '#FFFFFF', note: '정보와 업무를 선명하게 담는 기본 표면' },
];

const operationColors = [
  { name: 'Light Sand', value: '#F6F3F2', note: '장시간 업무를 위한 배경' },
  { name: 'Ink', value: '#0B2138', note: '제목과 핵심 정보' },
  { name: 'Active Cyan', value: '#00AAD2', note: '선택·실행·연결 신호' },
  { name: 'Line', value: '#E3E6E8', note: '구조를 나누는 경계' },
  { name: 'Success', value: '#1C806D', note: '정상과 완료 상태' },
  { name: 'Attention', value: '#925C36', note: '주의와 판단 필요 상태' },
];

function BrandFlowScene() {
  return (
    <div className="brand-flow-scene" aria-label="하나의 데이터 파이프라인이 PRIZM을 통과해 다양한 제조 AI가 되고 전 세계 공장으로 확산되는 모습">
      <div className="brand-flow-labels" aria-hidden="true">
        <strong>ONE DATA PIPELINE</strong><b>PRIZM</b><span>MANUFACTURING AI</span><span>GLOBAL FACTORIES</span>
      </div>
      <svg viewBox="0 0 1200 450" role="img" aria-labelledby="brand-flow-title">
        <title id="brand-flow-title">하나의 데이터 파이프라인이 PRIZM을 통과해 다양한 제조 AI가 생성되고 전 세계 공장으로 확산되는 브랜드 개념</title>
        <defs>
          <linearGradient id="brandWhiteBeam" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#7898ac" stopOpacity=".18"/><stop offset=".45" stopColor="#d8f6ff" stopOpacity=".75"/><stop offset="1" stopColor="#fff"/></linearGradient>
          <linearGradient id="brandPrism" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".46"/><stop offset=".45" stopColor="#88dff0" stopOpacity=".16"/><stop offset="1" stopColor="#4abed8" stopOpacity=".04"/></linearGradient>
          <radialGradient id="brandEarth"><stop stopColor="#267aa0" stopOpacity=".27"/><stop offset="1" stopColor="#07192d" stopOpacity="0"/></radialGradient>
          <filter id="brandGlow" x="-100%" y="-300%" width="300%" height="700%"><feGaussianBlur stdDeviation="5"/></filter>
          {aiRays.map((ray) => <linearGradient id={`ray-${ray.y}`} x1="0" y1="0" x2="1" y2="0" key={ray.y}><stop stopColor={ray.color}/><stop offset="1" stopColor={ray.color} stopOpacity=".42"/></linearGradient>)}
        </defs>

        <g className="brochure-pipeline">
          <circle className="brochure-pipeline-origin" cx="72" cy="225" r="8" />
          <path className="brochure-beam-glow" d="M72 225H510" />
          <path className="brochure-beam" d="M72 225H510" />
          <circle className="brochure-beam-pulse" r="4"><animateMotion dur="2.7s" repeatCount="indefinite" path="M72 225H510" /></circle>
          <circle className="brochure-beam-pulse is-second" r="2.5"><animateMotion dur="2.7s" begin="-1.35s" repeatCount="indefinite" path="M72 225H510" /></circle>
        </g>

        <g className="brochure-prism">
          <circle cx="590" cy="225" r="105" />
          <polygon points="522,90 658,225 522,360" />
          <polygon className="brochure-prism-side" points="506,90 522,90 658,225 642,225" />
          <polygon className="brochure-prism-side" points="506,360 522,360 658,225 642,225" />
          <polygon className="brochure-prism-face" points="506,90 642,225 506,360" />
          <path className="brochure-prism-z" d="M541 175H605L548 276H617" />
          <circle className="brochure-prism-core" cx="647" cy="225" r="26" />
        </g>

        <g className="brochure-rays">
          {aiRays.map((ray, index) => (
            <g key={ray.name} style={{ '--ray-color': ray.color, '--ray-delay': `${index * -.9}s` } as CSSProperties}>
              <path className="brochure-ray-glow" d={`M647 225L${index < 2 ? 955 : index === 2 ? 1010 : 950} ${ray.y}`} stroke={ray.color} />
              <path className="brochure-ray" d={`M647 225L${index < 2 ? 955 : index === 2 ? 1010 : 950} ${ray.y}`} stroke={`url(#ray-${ray.y})`} />
              <circle className="brochure-ray-pulse" cx={760 + index * 18} cy={225 + (ray.y - 225) * .35} r="4" fill={ray.color} />
              <text x={index < 2 ? 805 : index === 2 ? 830 : 790} y={225 + (ray.y - 225) * .58 - 8} fill={ray.color}>{ray.label}</text>
            </g>
          ))}
        </g>

        <g className="brochure-globe">
          <g transform="translate(175 60)">
            <circle className="brochure-earth-bloom" cx="845" cy="165" r="178" fill="url(#brandEarth)" />
            <ellipse className="brochure-earth-grid" cx="845" cy="165" rx="154" ry="124" />
            <ellipse className="brochure-earth-grid" cx="845" cy="165" rx="62" ry="124" />
            <path className="brochure-earth-grid" d="M691 165H999M714 110H976M714 220H976" />
            <path className="brochure-land" d="M699 75C708 62 725 57 740 61L750 55 765 59 773 70 788 72 798 83 790 95 780 99 786 110 778 124 768 132 762 145 752 141 744 128 734 121 729 106 715 99 707 87Z" />
            <path className="brochure-land" d="M744 127C754 130 761 140 765 148L773 155 770 162 760 155 754 147 746 142Z" />
            <path className="brochure-land" d="M795 64L812 55 827 65 823 87 810 98 796 89Z" />
            <path className="brochure-land" d="M772 155C785 150 802 156 813 169 819 179 814 192 807 202 804 214 801 226 791 240L784 261 775 250 771 230 765 211 759 193 761 175Z" />
            <path className="brochure-land" d="M830 103L838 96 847 98 852 106 847 113 853 119 844 125 834 120 827 113Z" />
            <path className="brochure-land" d="M833 124C846 118 864 122 876 134L882 151 873 161 869 181 861 206 850 218 842 203 838 184 829 169 825 148Z" />
            <path className="brochure-land" d="M846 92C864 78 889 75 912 79L939 75 966 82 984 94 977 106 962 110 956 123 944 126 934 139 922 137 914 151 904 153 895 141 883 138 877 128 865 124 854 115 850 104Z" />
            <path className="brochure-land" d="M883 134L897 141 908 151 902 169 894 183 886 166 879 151Z" />
            <path className="brochure-land" d="M914 149L926 153 933 164 943 167 950 177 941 181 931 175 922 177 915 169 905 165Z" />
            <path className="brochure-land" d="M936 194C949 186 968 188 982 198L985 216 973 228 955 230 940 219 931 207Z" />
            <path className="brochure-land" d="M973 143L978 132 982 143 978 154ZM858 214L862 224 858 237 854 225ZM990 230L994 239 990 247 987 238Z" />
            {brochureFactories.map((factory, index) => (
              <g className="brochure-site" transform={`translate(${factory.x} ${factory.y})`} style={{ '--site-delay': `${index * .16}s` } as CSSProperties} key={factory.code}>
                <circle r="3.4"/><circle r="10"/><text x="8" y="-5">{factory.code}</text><text x="8" y="4">{factory.name}</text>
              </g>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}

export default function BrandPage() {
  return (
    <div className="brand-brochure">
      <nav className="brand-nav">
        <span aria-hidden="true" />
        <div><a href="#meaning">Meaning</a><a href="#system">Philosophy</a><a href="#product">Product</a><a href="#design">Design</a></div>
        <button type="button" onClick={() => window.close()} className="brand-nav-back"><X size={15}/> 스토리 닫기</button>
      </nav>

      <main>
        <section className="brand-hero" id="story">
          <div className="brand-hero-copy">
            <Image className="brand-hero-logo" src="/prizm-logo-spectrum-on-dark.svg" alt="PRIZM" width={681} height={130} priority />
            <span className="brand-eyebrow">E-FOREST · MANUFACTURING AI PLATFORM</span>
            <h1>하나의 빛에서<br/><em>수많은 제조 AI</em>로</h1>
            <p>하나의 데이터 파이프라인이 PRIZM을 통과하여 다양한 색깔의 제조 AI 모델이 생성되고, 전 세계 공장으로 빠르게 퍼져나갑니다.</p>
          </div>
          <PrizmFlowCanvas className="brand-shared-flow" showKpis={false} interactive={false} />
          <a className="brand-scroll-cue" href="#meaning"><span>THE STORY OF PRIZM</span><ArrowDown size={16}/></a>
        </section>

        <section className="brand-meaning" id="meaning">
          <div className="brand-section-index light"><span>01</span><i/><b>THE NAME</b></div>
          <div className="brand-meaning-heading"><p>빛의 서사를 제품의 이름에 담았습니다.</p><h2>PRIZM</h2></div>
          <div className="brand-acronym">
            <div className="brand-acronym-word"><span>P</span><span>R</span><span>I</span><span className="is-z">Z</span><span>M</span></div>
            <div className="brand-acronym-definition">
              <p><b>P</b>ipeline for <b>R</b>esource <b>I</b>ntegration</p>
              <p>toward <em>Z</em>ero-Loss <b>M</b>anufacturing</p>
            </div>
          </div>
          <div className="brand-letter-grid">
            <article><b>P</b><span>PIPELINE</span><p>데이터에서 운영까지 이어지는 하나의 흐름</p></article>
            <article><b>R</b><span>RESOURCE</span><p>데이터·코드·모델·실행 기반의 공동 자원</p></article>
            <article><b>I</b><span>INTEGRATION</span><p>흩어진 자원과 실행 근거의 연결</p></article>
            <article className="is-z"><b>Z</b><span>ZERO-LOSS</span><p>품질 손실과 자원 낭비를 줄여가는 방향</p></article>
            <article><b>M</b><span>MANUFACTURING</span><p>AI의 가치가 실제로 증명되는 현장</p></article>
          </div>
          <blockquote><Image className="brand-z-symbol" src="/prizm-z-loader-transparent.png" alt="PRIZM 스펙트럼 Z" width={512} height={475}/><p><strong>PRIZM의 Z는 하나의 빛을 다양한 색으로 펼치는 프리즘의 형상이자</strong><br/>자원의 재사용과 확산을 통해 제조 공장의 AX 전환 비용을 최소화하겠다는 의지를 담고 있습니다.</p></blockquote>
        </section>

        <section className="brand-system" id="system">
          <div className="brand-section-index"><span>02</span><i/><b>THE PRODUCT PHILOSOPHY</b></div>
          <div className="brand-system-heading"><div><span>CONNECTED INTELLIGENCE</span><h2>연결하고, 재사용하고,<br/>현장에서 다시 배웁니다.</h2></div><p>PRIZM은 자산을 보관하는 장소를 넘어 제조 AI의 생성과 운영을 하나의 닫힌 순환으로 연결합니다.</p></div>
          <div className="brand-resource-orbit">
            <div className="brand-resource-center"><Image src="/prizm-icon.png" alt="PRIZM Z" width={1024} height={1024}/></div>
            {resources.map((item, index) => <article style={{ '--resource-index': index } as CSSProperties} key={item.label}><item.icon size={20}/><span>{item.label}</span><h3>{item.title}</h3><p>{item.copy}</p></article>)}
          </div>
          <div className="brand-loop">
            {[
              ['01','OBSERVE','현장 이상 감지'],['02','REVIEW','담당자 판단'],['03','CURATE','데이터 보강'],['04','LEARN','재학습'],['05','GATE','평가와 승인'],['06','DEPLOY','글로벌 배포'],
            ].map((item, index) => <div key={item[1]}><span>{item[0]}</span><b>{item[1]}</b><strong>{item[2]}</strong>{index < 5 && <ArrowRight size={16}/>}</div>)}
          </div>
        </section>

        <section className="brand-proof" id="product">
          <div className="brand-section-index"><span>03</span><i/><b>PRODUCT PROOF</b></div>
          <div className="brand-proof-heading"><div><span>FROM METAPHOR TO PRODUCT</span><h2>빛의 흐름은<br/>실제 업무가 됩니다.</h2></div><p>데이터, 코드, 모델, 실행과 모니터링을 오갈 때마다 생성 근거와 다음 행동이 연결됩니다.</p></div>
          <div className="brand-product-stage">
            <div className="brand-product-nav"><Image src="/prizm-logo-dark-rainbow.svg" alt="PRIZM" width={920} height={300}/><span/><span/><span/><span/></div>
            <div className="brand-product-main">
              <header><span>MODEL ASSET / PRJ000212-M-0001</span><b>Weld Detector</b><i>Production</i></header>
              <div className="brand-product-lineage">
                <article><Database size={20}/><span>DATA</span><strong>Weld Defect Dataset</strong><small>v13 · Verified</small></article><ArrowRight size={18}/>
                <article><Code2 size={20}/><span>CODE</span><strong>YOLO12 Training</strong><small>v2.4.1 · Reproduced</small></article><ArrowRight size={18}/>
                <article><Workflow size={20}/><span>RUN</span><strong>RUN-27018</strong><small>A100 · Success</small></article><ArrowRight size={18}/>
                <article><ShieldCheck size={20}/><span>MODEL</span><strong>Weld Detector</strong><small>v2.5.0 · Production</small></article>
              </div>
              <footer><div><Activity size={18}/><span><b>92</b><small>MODEL HEALTH</small></span></div><div><span>미세 크랙 검출률</span><b>94.6%</b></div><div><span>추론 지연 P95</span><b>26ms</b></div><button>운영 상태 보기 <ArrowRight size={14}/></button></footer>
            </div>
          </div>
          <div className="brand-human-ops">
            <header><div><span>HUMAN-IN-THE-LOOP OPERATIONS</span><h3>이상은 알림에서 끝나지 않고<br/>담당자의 책임 있는 작업이 됩니다.</h3></div><p>‘나의 작업’을 통해 역할별 판단을 병렬로 연결하고, 진성·가성 분류와 조치 근거를 하나의 운영 기록으로 남깁니다.</p></header>
            <div className="brand-workflow-proof">
              <article><span>01 / DETECT</span><b>성능 이상 감지</b><small>모니터링 이벤트</small></article><ArrowRight size={17}/>
              <article className="is-work"><span>02 / MY WORK</span><b>역할별 작업 자동 배정</b><small>기한·담당자·확인 항목</small></article><ArrowRight size={17}/>
              <div className="brand-role-lanes"><article><span>ML ENGINEER</span><b>모델·데이터 원인 확인</b><small>진성 / 가성 판단</small></article><article><span>PLANT ENGINEER</span><b>실물·설비 조건 확인</b><small>현장 조치 확인</small></article></div><ArrowRight size={17}/>
              <article className="is-record"><span>04 / RECORD</span><b>판단과 처리 내용 기록</b><small>데이터 보강·재학습 또는 종료</small></article>
            </div>
          </div>
          <div className="brand-proof-list">
            <article><span>CONNECTED ASSETS</span><h3>모든 결과에는 근거가 있습니다.</h3><p>데이터·코드·실행·평가·배포의 관계를 자동으로 기록합니다.</p></article>
            <article><span>REPRODUCIBLE RUNS</span><h3>검증된 조건으로 다시 실행합니다.</h3><p>파라미터와 실행 환경을 함께 관리해 공장마다 다시 만들지 않습니다.</p></article>
            <article><span>CLOSED LOOP</span><h3>이상 징후가 다음 개선을 시작합니다.</h3><p>모니터링에서 담당자 작업과 데이터 보강, 재학습으로 연결됩니다.</p></article>
          </div>
        </section>

        <section className="brand-design" id="design">
          <div className="brand-section-index"><span>04</span><i/><b>DESIGN LANGUAGE</b></div>
          <div className="brand-design-heading"><h2>현대자동차의 신뢰 위에<br/>PRIZM의 빛을 더합니다.</h2><p>기업의 정체성, 모델이 생성되는 순간, 장시간 사용하는 업무 화면을 서로 다른 색의 역할로 구분합니다.</p></div>
          <div className="brand-palette-heading"><span>CORPORATE FOUNDATION</span><p>현대자동차의 공식 색상을 제품 구조의 기반으로 사용합니다.</p></div>
          <div className="brand-color-grid is-foundation">{foundationColors.map((color) => <article key={color.name}><i style={{ background: color.value }}/><span>{color.name}</span><b>{color.value}</b><p>{color.note}</p></article>)}</div>
          <div className="brand-spectrum-block"><div><span>PRIZM SPECTRUM</span><h3>하나의 자원에서 다양한 제조 AI가 생성되는 순간</h3></div><i/><p>스펙트럼은 장식색이 아닙니다. 로고의 Z, 모델 광선, 생성과 확산을 보여주는 장면에만 제한적으로 사용합니다.</p></div>
          <div className="brand-palette-heading is-operational"><span>OPERATIONAL UI</span><p>상태를 빠르게 읽고 오래 사용해도 편안한 실제 포털의 업무 색상입니다.</p></div>
          <div className="brand-color-grid is-operational">{operationColors.map((color) => <article key={color.name}><i style={{ background: color.value }}/><span>{color.name}</span><b>{color.value}</b><p>{color.note}</p></article>)}</div>
          <div className="brand-form-principles">
            <article><Sparkles size={22}/><span>TRUSTED FOUNDATION</span><h3>Hyundai Blue가 제품의 신뢰를 세웁니다.</h3><p>사이드바, 주요 제목과 핵심 행동에 사용해 현대자동차 제품이라는 출발점을 분명히 합니다.</p></article>
            <article><Network size={22}/><span>PRISMATIC SIGNAL</span><h3>빛은 의미가 있을 때만 사용합니다.</h3><p>스펙트럼은 모델 생성과 확산을, Cyan은 선택·실행·연결을 알려주는 신호가 됩니다.</p></article>
            <article><Factory size={22}/><span>CALM WORKSPACE</span><h3>업무 화면은 오래 보아도 편안해야 합니다.</h3><p>완만한 곡률과 절제된 그라데이션으로 신뢰할 수 있는 작업 공간을 만듭니다.</p></article>
          </div>
        </section>

        <section className="brand-closing">
          <Globe2 className="brand-closing-globe" size={420} strokeWidth={.45}/>
          <Image src="/prizm-eforest.svg" alt="E-FOREST PRIZM" width={920} height={300}/>
          <h2>연결된 자원에서 시작해<br/><em>손실을 줄이는 제조</em>로</h2>
          <p>Pipeline for Resource Integration<br/>toward Zero-Loss Manufacturing</p>
          <button type="button" onClick={() => window.close()}>PRIZM 시작하기 <ArrowRight size={16}/></button>
          <footer className="brand-family-signature">
            <span><b>MANUFACTURING SOLUTION DIVISION</b><b>E-FOREST PRODUCT FAMILY</b></span>
            <div className="brand-family-products"><span><small>01</small>E-FOREST:POLARIS</span><span className="is-prizm"><small>02</small>E-FOREST:PRIZM</span><span className="is-next" aria-hidden="true"><small>03</small><i>···</i></span></div>
            <p>E-FOREST:P 제품군은 자율생산을 향한 철학을 이름에 담아,<br/>제조 현장의 AX 혁신을 이끄는 중추가 되고자 합니다.</p>
          </footer>
        </section>
      </main>
    </div>
  );
}
