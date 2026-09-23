# PRIZM 개발 지침

이 파일은 Claude Code를 포함한 후속 개발 도구가 저장소의 의도와 현재 상태를 빠르게 이해하기 위한 진입점이다.

## 먼저 읽을 문서

1. `README.md` — 설치, 실행, 연계 방식
2. `docs/DEVELOPMENT-HANDOFF.md` — 구조, 현재 구현 범위, 업무 시나리오
3. `docs/design-system.md` — 색상, 타이포그래피, 공통 UI 규칙
4. `design/PRIZM-DESIGN-HANDOFF.md` — 디자인 철학과 화면별 판단 기준

JupyterLab 또는 실행 백엔드를 변경할 때만 `docs/superpowers/specs/`와 `docs/superpowers/plans/`의 관련 문서를 추가로 읽는다.

## 제품의 중심 서사

하나의 데이터 파이프라인이 PRIZM을 통과해 다양한 역할의 제조 AI 모델이 되고, 전 세계 공장으로 빠르게 확산된다. 브랜드 표현은 홈과 브로셔에 집중하고 업무 화면은 실제 제조 운영 시스템처럼 명확하고 절제되어야 한다.

PRIZM의 확정 문구는 `Pipeline for Resource Integration toward Zero-Loss Manufacturing`이다. Z는 프리즘의 각진 형상과 Zero-Loss를 함께 의미한다.

## 작업 원칙

- 사용자가 지정한 화면만 수정한다. 인접 화면을 일괄 재설계하지 않는다.
- 기존 화면을 브라우저에서 먼저 확인하고 현재 정보 구조와 인터랙션을 보존한다.
- UI 프레임·버튼·배경은 `components/portal-page-primitives.tsx`와 기존 CSS 규칙을 재사용한다.
- 새 색상과 임의의 폰트 크기를 추가하지 않는다. `docs/design-system.md`의 토큰을 사용한다.
- 자산 상세의 코드·데이터·모델 화면은 같은 구조와 간격을 유지한다.
- 작은 영문 대문자 라벨, 과도한 카드 중첩, 카드 가장자리 색 띠, 의미 없는 그라데이션을 추가하지 않는다.
- 브랜드 무지개색은 PRIZM Z와 분광 서사에 집중한다. 일반 버튼이나 상태 표시에 확산하지 않는다.
- 샘플 데이터와 실연동 데이터를 혼동하지 않는다. 실연동 실패를 가짜 성공으로 덮지 않는다.
- `public/notebooks/*.html`은 실제 노트북 HTML 미리보기다. 임의의 코드 블록으로 대체하지 않는다.
- 기존 미커밋 변경을 보존하고, 요청 범위 밖 파일을 되돌리지 않는다.

## 기술 기준

- Node.js 22.13+
- React 19, TypeScript, vinext/Vite, Cloudflare Workers 호환 런타임
- 기본 본문 폰트: Pretendard Variable
- 영문 브랜드/숫자 보조: Manrope Variable
- 아이콘: Lucide React 및 `components/prizm-asset-icons.tsx`
- 포털 API 기본 주소: `http://localhost:8081`

## 중요한 구현 위치

- 전체 레이아웃과 배경: `app/layout.tsx`, `components/portal-page-primitives.tsx`
- 홈과 좌측 메뉴: `app/page.tsx`
- 코드 자산·실험 대시보드·공통 내비게이션: `components/code-assets-workspace.tsx`
- 데이터·모델 자산: `components/data-assets-workspace.tsx`, `components/model-assets-workspace.tsx`
- 메뉴 기준 작업 탭: `components/portal-workspace-tabs.tsx`
- 브랜드 브로셔: `app/brand/page.tsx`, `app/brand/brand.css`
- 실연동 API: `lib/prizm-api.ts`, `lib/edit-session-api.ts`
- Jupyter 중계: `app/api/edit-sessions/`, `app/edit/`, `app/edit-session-register/`
- 전역 제품 스타일: `app/prizm-design-system.css`

## 데이터와 상태

대부분의 목록·KPI·모니터링 데이터는 컴포넌트 내부 시연용 데이터다. 실제 연동 범위는 다음과 같다.

- `POST /api/runs`, 실행 목록, SSE 실행 진행: `prizm-backend`
- Airflow DAG 실행과 노트북 결과: `prizm-backend`가 외부 MLOps 스택과 연결
- PRIZM Lab 편집 세션: 포털의 same-origin 중계 + `prizm-backend` + Docker/JupyterLab

백엔드가 없을 때도 포털 목업은 열려야 한다. 실행 또는 편집처럼 실제 서버가 필요한 행동은 명확한 한국어 오류를 보여줘야 한다.

## 검증

변경 후 최소한 다음을 실행한다.

```bash
npm run lint
npm run build
```

현재 build는 통과하며 lint에는 기존 접근성·React Compiler 규칙 위반이 누적되어 있다. 작업으로 새 오류를 추가하지 말고, 기존 오류를 대규모 자동 수정하거나 숨기지 않는다. lint 기준선 정리는 별도 작업으로 진행한다.

UI 변경은 `localhost:3000`에서 해당 화면을 직접 확인한다. 코드 자산 상세처럼 sticky header, 탭, 우측 패널이 있는 화면은 스크롤 상태와 패널 접기까지 확인한다.

## 하지 말아야 할 일

- 사용자 지시 없이 배포하거나 GitHub에 푸시하지 않는다.
- `.env*`, 토큰, 사내 주소, 계정 정보를 커밋하지 않는다.
- `.worktrees/`, `node_modules/`, `.next/`, `.vinext/`, `dist/`를 커밋하지 않는다.
- 요청받지 않은 전체 되돌리기, 대규모 포맷팅, 전역 CSS 재작성은 하지 않는다.
