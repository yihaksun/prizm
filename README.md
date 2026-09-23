# PRIZM Manufacturing AI Portal

현대자동차 제조솔루션본부의 제조 AI 운영 포털 목업입니다. 데이터·코드·모델 자산, 실행·평가·배포·모니터링, 작업 프로세스를 하나의 포털에서 연결하는 비전을 보여줍니다.

> PRIZM: **Pipeline for Resource Integration toward Zero-Loss Manufacturing**

## 빠른 시작

### 요구 사항

- Node.js `22.13.0` 이상
- npm `10` 이상 권장
- Git

### 설치 및 개발 서버

```bash
git clone https://github.com/yihaksun/prizm.git
cd prizm
npm ci
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 코드 자산 실행과 PRIZM Lab 편집을 제외한 주요 데모 화면은 프론트엔드만으로 확인할 수 있습니다.

### 검사 및 빌드

```bash
npm run lint
npm run build
```

`npm run build`는 현재 통과합니다. `npm run lint`는 기존 화면과 기반 UI에 누적된 접근성·React Compiler 규칙 위반을 보고하며 아직 0건 기준선은 아닙니다. 사내 개발 시작 시 별도 정리 작업으로 다루고, 기능 변경과 함께 무리하게 일괄 수정하지 않습니다.

빌드 결과를 로컬에서 실행하려면 다음 명령을 사용합니다.

```bash
npm run start
```

기본 주소는 Wrangler가 출력하는 주소를 따릅니다.

## 백엔드 연계 실행

실행 관리와 PRIZM Lab 편집은 별도 저장소인 [prizm-backend](https://github.com/yihaksun/prizm-backend)가 필요합니다.

1. `prizm-backend`를 내려받아 `http://localhost:8081`에서 실행합니다.
2. 포털 루트에 `.env.local`을 만들고 필요 시 API 주소를 지정합니다.
3. 포털을 다시 실행합니다.

```dotenv
NEXT_PUBLIC_PRIZM_API_BASE=http://localhost:8081
```

기본값이 이미 `http://localhost:8081`이므로 같은 PC에서 실행하면 `.env.local`은 생략할 수 있습니다. 사내 서버 주소를 사용할 때만 변경합니다.

JupyterLab 커널 WebSocket까지 로컬에서 검증할 때는 보조 릴레이를 함께 실행합니다.

```bash
# 터미널 1
npm run dev

# 터미널 2
npm run dev:edit-relay
```

이때 `.env.local`에 다음 값을 추가하고 포털을 재시작합니다.

```dotenv
NEXT_PUBLIC_EDIT_SESSION_RELAY_BASE=http://localhost:3011
```

보조 릴레이는 로컬 `vinext/miniflare`의 Jupyter 커널 WebSocket 제약을 우회하기 위한 개발용 구성입니다. 일반 화면 확인이나 실제 배포에서는 설정하지 않습니다.

## 주요 화면

| 영역 | 경로 | 현재 상태 |
|---|---|---|
| 홈 대시보드 | `/` | 목업 데이터 |
| 브랜드 브로셔 | `/brand` | 완성된 정적 페이지 |
| 나의 할 일 / 작업 이력 | `/work/tasks`, `/work/history` | 데모 프로세스 |
| 과제 관리 | `/projects` | 목록·권한 모달 목업 |
| 데이터·코드·모델 자산 | `/assets/data`, `/assets/code`, `/assets/models` | 상세·연관 자산·다운로드 UI |
| 파이프라인 구성 | `/assets/pipelines` | 구성 화면 목업 |
| 실험 대시보드 | `/assets/code?pipeline=1` | 백엔드 실행 연계 가능 |
| 모델 평가 | `/evaluation/models` | 평가·승격 데모 |
| 모델 모니터링 | `/monitoring/models` | 이상 감지 데모 |
| 실행 자원·환경 | `/resources/compute`, `/resources/environments` | 관리 화면 목업 |
| PRIZM Lab 편집 | 코드 자산 상세의 편집 버튼 | 백엔드·Docker 필요 |

## 프로젝트 구조

```text
app/                         페이지와 서버 라우트
components/                  업무 화면과 공통 UI
components/ui/               기반 UI 컴포넌트
lib/                         API 클라이언트와 공통 유틸리티
public/                      로고, 폰트, 노트북 HTML, 데모 이미지
design/                      디자인 인계서와 QA 기록
docs/                        디자인 시스템·구현 설계·개발 인수인계
scripts/                     로컬 개발 보조 프로세스
```

상세한 구조와 연계 방식은 [docs/DEVELOPMENT-HANDOFF.md](docs/DEVELOPMENT-HANDOFF.md), UI 원칙은 [docs/design-system.md](docs/design-system.md), 디자인 배경은 [design/PRIZM-DESIGN-HANDOFF.md](design/PRIZM-DESIGN-HANDOFF.md)를 참고합니다.

## Claude Code로 이어서 개발하기

저장소 루트의 [CLAUDE.md](CLAUDE.md)를 먼저 읽도록 합니다. 새 세션에서는 다음처럼 요청하면 됩니다.

```text
CLAUDE.md와 docs/DEVELOPMENT-HANDOFF.md를 먼저 읽고,
현재 디자인 시스템과 데모 시나리오를 유지한 채 작업해줘.
변경 전 관련 화면과 컴포넌트를 확인하고, 완료 후 npm run lint와 npm run build를 실행해줘.
```

## 주의 사항

- `.env*`, 빌드 결과, 로컬 DB, `.worktrees/`는 Git에 올리지 않습니다.
- 화면의 수치와 사용자 정보는 이해관계자 시연용 데이터입니다.
- `app/prizm-design-system.css`는 누적된 실제 화면 규칙을 포함합니다. 큰 범위로 재작성하기 전에 대상 화면과 기존 공통 컴포넌트를 확인합니다.
- 메뉴·탭·자산 ID·브랜드 문구는 데모 흐름과 연결되어 있으므로 임의로 바꾸지 않습니다.
- `npm audit`에는 vinext/Vite/React Server Components 계열의 상위 버전 전환이 필요한 항목이 남아 있습니다. `npm audit fix --force`를 바로 적용하지 말고 vinext 호환성을 검증한 뒤 묶어서 업그레이드합니다.
