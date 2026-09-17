# PRIZM 실제 실행 연동 설계 — Airflow·Papermill·MLflow + 실시간 노트북 모니터링

- 작성일: 2026-09-17
- 상태: 설계 승인 완료, 사용자 문서 리뷰 대기
- 관련 저장소: `prizm`(프론트), `prizm-backend`(신규), `~/Workspace/notebook/prototype`(Docker 인프라, git 아님)

## 1. 목표

코드 자산 상세의 **"이 버전으로 실행" → "즉시 실행"** 버튼이 더 이상 화면 내 시뮬레이션이 아니라,

1. Spring Boot 백엔드를 통해 **실제 Airflow DAG**를 트리거하고,
2. Airflow가 **papermill**로 노트북을 실행하면서 사용자가 입력한 파라미터를 주입하고,
3. 학습된 모델을 **MLflow Model Registry**에 새 버전으로 등록하며,
4. 실행 중인 노트북의 **셀 진행과 출력을 화면에서 실시간으로** 보여주도록 한다.

## 2. 결정 사항 요약

| # | 질문 | 결정 |
|---|---|---|
| 1 | 즉시 실행 시 실제로 돌릴 노트북 | 기존 `demo_yolov8_training`(YOLOv8 결함 탐지, CPU 수 분)을 "용접 비드 결함 검출 학습" 자산에 매핑 |
| 2 | 백엔드 위치 | 별도 저장소 `prizm-backend` |
| 3 | 실시간 모니터링 표현 | 셀 단위 실시간 노트북 + 실제 Airflow 로그(접이식) |
| 4 | 실행 이력 저장 | H2 파일 DB (Spring Data JPA) |
| 5 | Java 설치 | SDKMAN으로 Temurin JDK 21을 사용자 홈에 설치 |
| 6 | 실시간 데이터 전달 방식 | **A안** — papermill이 공유 폴더에 노트북 스냅샷 저장 → 백엔드가 읽어 SSE로 푸시 |

A안을 택한 이유: 이미지·표 같은 풍부한 출력을 포함한 실제 노트북을 적은 코드로 안정적으로 보여줄 수 있고, 운영 환경에서는 공유 폴더를 S3/MinIO prefix로 바꾸면 백엔드의 읽기 부분만 교체하면 된다. 로그 파싱(B안)은 셀 경계가 추측이고 텍스트만 가능하며, 콜백 방식(C안)은 커스텀 엔진·웹훅 신뢰성 처리가 필요하고 백엔드가 내려가 있으면 이벤트가 유실된다.

## 3. 전체 아키텍처

### 3.1 구성요소

| 구성요소 | 역할 | 기술 | 포트 |
|---|---|---|---|
| `prizm` | 실행 설정·실험 대시보드·실시간 실행 상세 화면 | Next.js(vinext), React 19 | 3000 |
| `prizm-backend` | 실행 생성, DAG 트리거, 상태 모니터링, SSE 푸시, 실행 이력 저장 | Spring Boot 3.5, Java 21, Gradle Kotlin DSL, H2 | **8081** |
| Airflow | Generic Notebook Executor DAG 실행 (papermill) | Airflow 2.10.2 standalone (Docker) | 8080 |
| MLflow | run·메트릭·Model Registry | MLflow 2.16.2 (Docker, 아티팩트는 MinIO) | 5050 |
| AI Hub / MinIO | 코드·데이터셋·모델 자산 저장 | FastAPI + MinIO (Docker) | 8000 / 9000 |

### 3.2 데이터 흐름

1. 사용자가 코드 자산 상세에서 "이 버전으로 실행"을 누르고, 실행 설정 시트에서 파라미터(epochs, batch_size, image_size, seed)를 입력한 뒤 "즉시 실행"을 누른다.
2. 프론트가 `POST /api/runs`를 호출한다.
3. 백엔드가 `RUN-xxxxx`를 발급해 `QUEUED`로 저장하고, 자산과 파라미터 이름을 매핑한 뒤 Airflow REST API로 DAG를 트리거하고 `dag_run_id`를 저장한다.
4. Airflow가 `preflight_check → download_notebook → execute_notebook`을 실행한다. papermill은 `runs/RUN-xxxxx/executed.ipynb`를 셀마다, 그리고 긴 셀 실행 중에도 3초마다 저장한다. 노트북 마지막 셀이 MLflow에 run을 기록하고 Model Registry에 등록한다(`prizm_run_id` 태그 포함).
5. 백엔드 모니터가 2초마다 진행 중인 run에 대해 Airflow 태스크 상태·로그 tail을 조회하고 `executed.ipynb`를 파싱해 변경분만 SSE로 푸시한다. DAG가 성공하면 MLflow에서 태그로 run을 찾아 mAP50과 등록 모델 버전을 저장한다.
6. 실행 상세 화면이 `GET /api/runs/{id}/stream`을 구독해 단계·진행률·셀·로그·결과를 반영한다.

### 3.3 이번 범위에서 제외

- 실행 중지, 동일 조건 재실행, 스케줄링
- "사전 점검"의 실제 연동 (기존 화면 애니메이션 유지)
- 인증·권한 (실행자는 고정값 `이학선`)
- 실행 자원·환경 선택의 실제 반영 (값은 기록만, 실제 실행은 CPU 이미지 1종)
- 파라미터 범위 검증 (타입만 검증, 잘못된 값은 노트북 실행 단계에서 실패로 처리)

## 4. 백엔드 설계 (`prizm-backend`)

### 4.1 기술 스택과 의존성

- Spring Boot 3.5.x, Java 21, Gradle Kotlin DSL(wrapper 포함)
- `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-validation`, `com.h2database:h2`, `spring-boot-devtools`
- HTTP 클라이언트: Spring `RestClient`, JSON: Jackson
- 테스트: `spring-boot-starter-test`(JUnit 5, AssertJ, Mockito), `com.squareup.okhttp3:mockwebserver`

### 4.2 패키지 구조 (`com.prizm.backend`)

| 패키지 | 클래스 | 책임 |
|---|---|---|
| `run` | `RunController`, `RunService`, `Run`, `RunRepository`, `RunStatus`, `RunStage`, `CreateRunRequest`, `RunResponse` | 실행 생성·조회 API와 도메인 |
| `run.monitor` | `RunMonitor`, `RunProgressCalculator`, `RunEventBroadcaster` | 주기적 상태 수집, 단계·진행률 계산, SSE 구독자 관리 |
| `airflow` | `AirflowClient`, `AirflowTaskState` | DAG 트리거, dagRun·taskInstance 조회, 태스크 로그 조회 |
| `mlflow` | `MlflowClient`, `MlflowRunResult` | 실험 조회, 태그 기반 run 검색, run_id 기반 모델 버전 검색 |
| `notebook` | `NotebookSnapshotReader`, `NotebookCell`, `CellOutput` | `executed.ipynb` 파싱 |
| `asset` | `CodeAssetCatalog`, `CodeAssetProperties` | 자산 ID·버전 → 코드 키·버전, 파라미터 이름 매핑 |
| `config` | `PrizmProperties`, `WebConfig` | 외부 서비스 주소·경로 설정, CORS, 스케줄링 활성화 |

### 4.3 API

| 메서드 | 경로 | 응답 | 설명 |
|---|---|---|---|
| POST | `/api/runs` | 201 `RunResponse` / 400 / 502 | 실행 생성 + DAG 트리거 |
| GET | `/api/runs?assetId={assetId}` | 200 `RunResponse[]` | 실행 목록, 요청 시각 최신순. `assetId` 생략 시 전체 |
| GET | `/api/runs/{id}` | 200 `RunResponse` / 404 | 단건 조회 |
| GET | `/api/runs/{id}/notebook` | 200 `{ "cells": NotebookCell[] }` / 404 | 최신 노트북 스냅샷 |
| GET | `/api/runs/{id}/log` | 200 `{ "lines": string[] }` / 404 | `execute_notebook` 태스크 로그 끝 200줄 |
| GET | `/api/runs/{id}/stream` | `text/event-stream` / 404 | 연결 즉시 `run`·`notebook`·`log` 전체 스냅샷, 이후 변경분 푸시 |

**요청 예시 — `POST /api/runs`**

```json
{
  "assetId": "PRJ000212-C-0001",
  "version": "v2.4.1",
  "parameters": { "epochs": 3, "batch_size": 4, "image_size": 320, "seed": 42 },
  "resource": "ml.a100.20gb",
  "environment": "pytorch-2.4-yolo12-py311-cu124"
}
```

검증: `assetId`·`version`은 필수, `parameters`의 네 키는 필수이며 정수여야 한다. 위반 시 400.

**응답 예시 — `RunResponse`**

```json
{
  "id": "RUN-27000",
  "assetId": "PRJ000212-C-0001",
  "assetVersion": "v2.4.1",
  "codeKey": "demo.door_defect_yolov8_training",
  "codeVersion": "v2",
  "parameters": { "epochs": 3, "batch_size": 4, "image_size": 320, "seed": 42 },
  "resource": "ml.a100.20gb",
  "environment": "pytorch-2.4-yolo12-py311-cu124",
  "requestedBy": "이학선",
  "dagRunId": "prizm_RUN-27000",
  "status": "RUNNING",
  "stage": "TRAINING",
  "progress": 52,
  "executedCells": 4,
  "totalCells": 8,
  "mlflowRunId": null,
  "map50": null,
  "registeredModelName": null,
  "registeredModelVersion": null,
  "errorMessage": null,
  "requestedAt": "2026-09-17T14:02:11Z",
  "startedAt": "2026-09-17T14:02:15Z",
  "finishedAt": null
}
```

**`NotebookCell`**

```json
{
  "index": 3,
  "cellType": "code",
  "source": "import os\nimport mlops\n...",
  "executionCount": 2,
  "status": "completed",
  "tags": ["parameters"],
  "outputs": [
    { "type": "stream", "name": "stdout", "text": "dataset ready: ...\n" },
    { "type": "text", "text": "0.4123" },
    { "type": "image", "imagePng": "<base64>" },
    { "type": "error", "ename": "FileNotFoundError", "evalue": "...", "traceback": ["..."] }
  ]
}
```

- `cellType`: `code` | `markdown`
- `status`: 셀 메타데이터 `papermill.status` 값(`pending` | `running` | `completed` | `failed`)을 그대로 사용한다. 마크다운 셀은 항상 `completed`.
- `outputs.type` 변환 규칙: `stream` → `stream`, `execute_result`·`display_data`의 `image/png` → `image`, 그 외 `text/plain` → `text`, `error` → `error`. traceback의 ANSI 색상 코드는 제거한다.

**SSE 이벤트**

| event | data |
|---|---|
| `run` | `RunResponse` |
| `notebook` | `{ "cells": NotebookCell[] }` |
| `log` | `{ "lines": string[] }` |

emitter 타임아웃 30분, 15초마다 heartbeat 주석(`: ping`), 완료·오류·타임아웃 시 즉시 구독자 목록에서 제거.

### 4.4 `Run` 엔티티

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | String (PK) | `RUN-` + DB 시퀀스(27000부터) |
| `assetId`, `assetVersion` | String | 프론트 자산 식별자 |
| `codeKey`, `codeVersion` | String | AI Hub 코드 자산 키·버전 |
| `parameters` | String(JSON) | 화면에서 입력한 원래 이름의 파라미터 |
| `resource`, `environment` | String | 기록용 |
| `requestedBy` | String | 고정 `이학선` |
| `dagRunId` | String | `prizm_{id}` |
| `status` | enum `RunStatus` | `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED` |
| `stage` | enum `RunStage` | `PREPARING`, `DATA`, `TRAINING`, `REGISTERING`, `DONE` |
| `progress` | int | 0~100 |
| `executedCells`, `totalCells` | int | 코드 셀 기준 |
| `mlflowRunId`, `map50`, `registeredModelName`, `registeredModelVersion` | String / Double / String / String | 결과 |
| `resultLookupAttempts` | int | MLflow 결과 조회 시도 횟수 |
| `errorMessage` | String | 실패·경고 메시지 |
| `requestedAt`, `startedAt`, `finishedAt` | Instant | 시각 |

### 4.5 자산·파라미터 매핑 (`application.yml`)

```yaml
prizm:
  code-assets:
    - asset-id: PRJ000212-C-0001
      asset-version: v2.4.1
      code-key: demo.door_defect_yolov8_training
      code-version: v2
      parameter-names:
        epochs: epochs
        batch_size: batch
        image_size: imgsz
        seed: seed
```

매핑에 없는 `assetId`+`version` 조합은 400. Airflow에 보내는 `extra_params`는 매핑된 이름으로 변환한 값이다.

### 4.6 Airflow 연동

- 트리거: `POST {airflow}/api/v1/dags/mlops_notebook_executor/dagRuns`, basic auth(admin/admin)

  ```json
  {
    "dag_run_id": "prizm_RUN-27000",
    "conf": {
      "code_key": "demo.door_defect_yolov8_training",
      "code_version": "v2",
      "prizm_run_id": "RUN-27000",
      "extra_params": { "epochs": 3, "batch": 4, "imgsz": 320, "seed": 42 }
    }
  }
  ```

- 상태: `GET .../dagRuns/{dag_run_id}`, `GET .../dagRuns/{dag_run_id}/taskInstances`
- 로그: `GET .../dagRuns/{dag_run_id}/taskInstances/execute_notebook/logs/1` (`Accept: text/plain`)

### 4.7 단계·진행률 계산 (`RunProgressCalculator`)

| 조건 | status | stage | progress |
|---|---|---|---|
| dagRun `queued` 또는 태스크 미시작 | `QUEUED` | `PREPARING` | 0 |
| `preflight_check` running | `RUNNING` | `PREPARING` | 5 |
| `preflight_check` success, `download_notebook` 미완료 | `RUNNING` | `DATA` | 10 |
| `download_notebook` success, `execute_notebook` 미시작 | `RUNNING` | `DATA` | 24 |
| `execute_notebook` running | `RUNNING` | `TRAINING` | 24 + ⌊71 × 완료 코드셀 / 전체 코드셀⌋ |
| dagRun success, MLflow 결과 미수집 | `RUNNING` | `REGISTERING` | 95 |
| MLflow 결과 저장 완료 | `SUCCEEDED` | `DONE` | 100 |
| 어느 태스크든 `failed`/`upstream_failed` 또는 dagRun failed | `FAILED` | 실패 직전 단계 유지 | 실패 직전 값 유지 |

실패 시 `errorMessage` = `"{task_id} 실패: {로그 마지막 비어있지 않은 줄}"`.

### 4.8 MLflow 연동

- 실험 ID: `GET {mlflow}/api/2.0/mlflow/experiments/get-by-name?experiment_name=prizm-weld-training`
- run 검색: `POST {mlflow}/api/2.0/mlflow/runs/search` — `{"experiment_ids":[id],"filter":"tags.prizm_run_id = 'RUN-27000'","max_results":1}` → `run_id`, `metrics.mAP50`
- 모델 버전: `GET {mlflow}/api/2.0/mlflow/model-versions/search?filter=run_id='{run_id}'` → `name`, `version`
- 결과가 없으면 매 모니터 주기마다 재시도, 30회(약 1분) 초과 시 `SUCCEEDED`/`DONE`/100으로 마감하고 `errorMessage`에 `"MLflow에서 모델 등록 정보를 찾지 못했습니다"` 저장.

### 4.9 모니터 (`RunMonitor`)

- `@Scheduled(fixedDelay = 2000)`.
- 대상: `status ∈ {QUEUED, RUNNING}`인 run.
- 주기마다 run별로 독립 처리(한 run의 예외는 로그만 남기고 다음 주기 재시도).
  1. dagRun·taskInstance 조회 → `RunProgressCalculator`로 status·stage·progress 계산.
  2. `execute_notebook`이 시작된 뒤에만: `{runs-dir}/{runId}/executed.ipynb` 수정 시각이 바뀌었으면 파싱. JSON 파싱 실패(쓰는 도중 읽음)는 무시하고 마지막 정상 스냅샷 유지. 완료·전체 코드셀 수 갱신.
  3. `execute_notebook`이 시작된 뒤에만 로그 끝 200줄 조회.
  4. dagRun success면 MLflow 결과 조회(4.8).
  5. `run`·`notebook`·`log` 각각 이전 값과 해시 비교 → 바뀐 것만 `RunEventBroadcaster`로 푸시, run은 DB 저장.
- 마지막 스냅샷(노트북 셀·로그)은 메모리 캐시에 두고, 캐시가 없으면(재시작 직후) 파일과 Airflow에서 다시 읽는다.
- 백엔드 재시작 시 DB의 미완료 run을 그대로 대상으로 삼아 모니터링을 재개한다.

### 4.10 설정

```yaml
server:
  port: 8081
spring:
  datasource:
    url: jdbc:h2:file:./data/prizm-backend
  jpa:
    hibernate:
      ddl-auto: update
prizm:
  airflow:
    base-url: http://localhost:8080
    username: admin
    password: admin
    dag-id: mlops_notebook_executor
  mlflow:
    base-url: http://localhost:5050
    experiment-name: prizm-weld-training
  runs-dir: ${user.home}/Workspace/notebook/prototype/runs
  cors:
    allowed-origins: http://localhost:3000
```

## 5. 인프라 변경 (`~/Workspace/notebook/prototype`)

변경 전 원본(`docker-compose.yml`, `airflow/dags/mlops_notebook_executor.py`)을 `prototype/.backup-2026-09-17/`에 복사해 되돌릴 수 있게 한다.

### 5.1 `docker-compose.yml`

`airflow` 서비스 `volumes`에 `./runs:/opt/airflow/mlops_run` 추가. DAG는 이미 볼륨 마운트이므로 이미지 재빌드 없이 `airflow` 컨테이너만 재생성한다.

### 5.2 DAG `mlops_notebook_executor.py`

- `download_notebook`: `conf.prizm_run_id`가 있으면 `run_dir = /opt/airflow/mlops_run/{prizm_run_id}`, 없으면 기존 규칙(Airflow run_id 기반) 유지 — 기존 Python 포털과 `trigger.sh`가 계속 동작해야 한다.
- `execute_notebook`:
  - `pm.execute_notebook(..., request_save_on_cell_execute=True, autosave_cell_every=3, log_output=True, kernel_name="python3")`
  - `base_params`에 `prizm_run_id`(conf에 있을 때) 추가. `base_params`는 `extra_params`보다 우선.

### 5.3 노트북 v2 — `demo.door_defect_yolov8_training@v2`

v1(`notebooks/demo_yolov8_training.ipynb`)은 수정하지 않고 `notebooks/demo_yolov8_training_v2.ipynb`를 새로 만든다.

- parameters 셀 추가: `prizm_run_id = ""`, `mlflow_experiment = "prizm-weld-training"`, `registered_model_name = "weld-bead-defect-detector"`. 기본값 `epochs = 3`, `imgsz = 320`, `batch = 4`, `seed = 42`.
- 학습 셀: ultralytics 콜백 `on_fit_epoch_end`에서 epoch마다 한 줄 출력 — `epoch {n}/{epochs} · box_loss {x:.3f} · cls_loss {y:.3f} · mAP50 {z:.3f}`. `verbose=False` 유지.
- 마지막 셀:
  - `mlflow.set_experiment(mlflow_experiment)`, `mlflow.start_run(run_name=f"{prizm_run_id or 'manual'}-yolov8-training")`
  - `mlflow.set_tag("prizm_run_id", prizm_run_id)`, 하이퍼파라미터 `log_params`, `log_metric("mAP50", map50)`
  - `best.pt`를 감싼 `mlflow.pyfunc.PythonModel`로 `mlflow.pyfunc.log_model(artifact_path="model", python_model=..., artifacts={"weights": best_weight}, registered_model_name=registered_model_name)` → Model Registry 새 버전
  - 기존 `mlops.model.upload(model_key, best_weight)` 및 태그 유지
- 등록: 1회성 스크립트 `seed/register_notebook_v2.py`로 AI Hub에 `v2` 등록. `demo.door_defect` 데이터셋·`demo.yolov8n_base` 가중치가 없으면 기존 `seed` 먼저 실행.

### 5.4 명명 규칙

- MLflow 실험: `prizm-weld-training`
- 등록 모델: `weld-bead-defect-detector`
- 실행 폴더: `prototype/runs/{RUN-id}/executed.ipynb`

## 6. 프론트엔드 연동 (`prizm`)

### 6.1 신규 파일

| 파일 | 역할 |
|---|---|
| `lib/prizm-api.ts` | 백엔드 타입(`Run`, `NotebookCell`, `CellOutput`)과 `createRun`, `listRuns`. 주소는 `NEXT_PUBLIC_PRIZM_API_BASE`, 기본 `http://localhost:8081` |
| `hooks/use-run-stream.ts` | `EventSource`로 `/api/runs/{id}/stream` 구독 → `{ run, cells, log, connected }`. run이 `SUCCEEDED`/`FAILED`가 되면 연결 종료 |
| `components/live-notebook.tsx` | 셀 렌더러 |
| `components/live-run-detail.tsx` | 실제 실행 상세 화면(진행 카드·노트북·실행 조건·로그·결과) |

`components/code-assets-workspace.tsx`(1,138줄)가 더 커지지 않도록 실제 실행 화면은 별도 컴포넌트로 분리한다.

### 6.2 실행 설정 시트

- 파라미터 입력을 controlled state로 전환. 기본값 `epochs 3`, `batch_size 4`, `image_size 320`, `seed 42`. 입력 `min=1`.
- `data_id`, `model_id`, `model_version`은 읽기 전용 표시.
- 예상 소요시간 문구: "약 3~5분 (CPU)".
- "즉시 실행": 기존 사전 점검 애니메이션 후 `createRun` 호출, 호출 중 버튼 로딩.
  - 성공: 응답 run을 목록에 추가하고 **실행 상세 화면으로 즉시 이동**.
  - 실패: 시트를 닫지 않고 하단에 오류 표시. 연결 실패 시 "실행 서버(8081)에 연결할 수 없습니다", 400/502 시 응답 메시지.

### 6.3 실험 대시보드 목록

- `RunRecord`에 `source: 'mock' | 'live'` 추가, 상태 유니온에 `'실패'` 추가.
- 화면 진입 시 `listRuns()` 결과를 기존 mock 목록 앞에 병합. 진행 중인 live run이 있을 때만 5초마다 재조회.
- 백엔드 연결 실패 시 mock 목록만 표시.
- 상태 매핑: `QUEUED` → 요청 접수, `RUNNING`+`PREPARING`/`DATA` → 자원 준비, `RUNNING`+`TRAINING`/`REGISTERING` → 실행 중, `SUCCEEDED` → 완료, `FAILED` → 실패(빨간 배지).

### 6.4 실행 상세 화면

- `source === 'live'`면 `LiveRunDetail`, `mock`이면 기존 정적 HTML 화면을 그대로 사용.
- 진행 카드: 실제 `progress`와 기존 4단계 트랙(환경 준비·데이터 연결·모델 학습·평가·등록), 실패 상태와 `errorMessage`.
- 실시간 노트북(`LiveNotebook`):
  - 코드 셀: 소스(고정폭), 실행 번호, 상태 배지(완료·실행 중·대기·오류). 실행 중 셀 강조.
  - 출력: stream 텍스트, text, `image/png`, error(traceback, 빨간 강조).
  - `parameters` 셀과 papermill이 추가한 `injected-parameters` 셀에 "Papermill 주입 파라미터" 배지.
  - 마크다운 셀: 외부 라이브러리 없이 `#` 제목과 본문 텍스트만 렌더.
  - 실행 중 셀로 자동 스크롤. 사용자가 위로 스크롤하면 자동 스크롤 중지, 맨 아래로 돌아오면 재개.
- 실행 조건 패널: 주입된 파라미터, `dagRunId`, 기록된 실행 자원·환경, 실행자.
- Airflow 실행 로그(기존 접이식): 실제 로그 줄.
- 결과 스트립(`SUCCEEDED`): mAP50, `weld-bead-defect-detector v{N}`, "MLflow에서 보기" → `http://localhost:5050/#/models/weld-bead-defect-detector/versions/{N}` 새 탭. 등록 정보가 없으면 경고 문구.
- "실행 중지", "동일 조건으로 다시 실행"은 live run에서 비활성화.

### 6.5 스타일

`app/prizm-design-system.css`에 `live-notebook-*`, `live-run-*` 클래스를 추가하고 기존 `run-notebook-result`·`run-progress-card` 톤을 따른다.

## 7. 오류 처리

| 상황 | 백엔드 | 화면 |
|---|---|---|
| 백엔드 미기동 | — | 시트 하단 "실행 서버(8081)에 연결할 수 없습니다", 대시보드는 mock만 |
| Airflow 미기동·인증 실패 | run `FAILED` 저장, 502 | 시트 오류, 대시보드에 실패 이력 |
| 알 수 없는 자산·버전, 파라미터 누락·타입 오류 | 400 | 시트 오류 |
| 노트북 셀 오류로 DAG 실패 | `FAILED`, `errorMessage` | 진행 카드 실패, 오류 셀 빨간 강조 + traceback |
| `executed.ipynb` 쓰는 도중 읽음 | 마지막 정상 스냅샷 유지 | 변화 없음 |
| MLflow 결과 지연·누락 | 30회 재시도 후 경고와 함께 완료 | 결과 스트립 경고 |
| SSE 연결 끊김 | 재연결 시 전체 스냅샷 재전송 | `EventSource` 자동 재연결 |
| 실행 중 백엔드 재시작 | 미완료 run 모니터링 재개 | 파일 기반이라 누락 없음 |
| 동시에 2건 이상 실행 | Airflow standalone이 순차 실행 | 뒤 실행은 "요청 접수" 대기 후 진행 |

## 8. 테스트 전략

### 8.1 백엔드 (TDD)

| 테스트 | 검증 내용 |
|---|---|
| `CodeAssetCatalogTest` | 매핑 조회, 파라미터 이름 변환, 미등록 자산 예외 |
| `NotebookSnapshotReaderTest` | papermill 형식 fixture(실행 중·완료·오류 셀·불완전 JSON) → 셀 상태, 출력 변환, ANSI 제거, 파싱 실패 처리 |
| `RunProgressCalculatorTest` | 4.7 표의 모든 행 |
| `AirflowClientTest` | MockWebServer: basic auth 헤더, 트리거 요청 JSON, 상태·로그 응답 파싱, 5xx·연결 실패 예외 |
| `MlflowClientTest` | MockWebServer: 실험 조회, run 검색 필터 문자열, 모델 버전 파싱, 결과 없음 |
| `RunControllerTest` | `@WebMvcTest`: 201·400·404·502 응답 계약 |
| `RunServiceTest` | 생성 시 매핑·저장·트리거, 트리거 실패 시 `FAILED` 저장 |
| `RunMonitorTest` | 가짜 클라이언트로 상태 전이, 변경 시에만 브로드캐스트, run별 예외 격리, MLflow 재시도 한도 |

### 8.2 프론트

테스트 프레임워크를 새로 도입하지 않는다. `tsc --noEmit`, `oxlint`, Playwright 스크립트로 실제 브라우저 흐름을 스크린샷 검증한다.

### 8.3 인프라

CLI로 `prizm_run_id`를 포함해 DAG를 트리거하고, 학습 셀 실행 중 `runs/{id}/executed.ipynb` 수정 시각이 수 초 간격으로 바뀌는지, 완료 후 MLflow Model Registry에 버전이 생기는지 확인한다.

### 8.4 완료 기준 (E2E)

1. 화면에서 "즉시 실행"을 누르면 Airflow에 `prizm_RUN-xxxxx` dagRun이 생성된다.
2. 실행 상세에서 셀이 순서대로 완료 처리되고, 학습 셀 실행 중 epoch 출력 줄이 수 초 내에 나타난다.
3. 입력한 epochs 값이 `injected-parameters` 셀과 MLflow run params에 동일하게 기록된다.
4. 완료 후 MLflow Model Registry에 `weld-bead-defect-detector` 새 버전이 생기고, 화면 결과 스트립에 같은 버전과 mAP50이 표시된다.
5. 백엔드를 재시작해도 실험 대시보드에 실행 이력과 결과가 유지된다.
6. `curl`로 `epochs: 0`을 담아 `POST /api/runs`를 호출하면 노트북 실행 단계에서 실패하고, 화면에 `FAILED`와 오류 셀이 표시된다.

## 9. 저장소·브랜치·되돌리기

| 대상 | 방식 | 되돌리기 |
|---|---|---|
| `prizm` | 오늘 작업 전 상태 = `main`의 `309374d`, 태그 `before-airflow-live-run`. 설계 문서와 구현은 `feature/airflow-live-run` 브랜치 | 브랜치를 병합하지 않거나 `git switch main` |
| `prizm-backend` | 로컬 `…/dnp/work/prizm-backend`에 신규 git 저장소. GitHub 원격 저장소는 `gh` CLI가 없으므로 사용자가 github.com에서 빈 저장소 `prizm-backend`를 생성한 뒤 push | 저장소 삭제 |
| prototype 인프라 | git 아님. 수정 전 원본을 `prototype/.backup-2026-09-17/`에 복사 | 백업 파일로 덮어쓰기 |
| 로컬 도구 | SDKMAN + Temurin JDK 21 (`~/.sdkman`) | `sdk uninstall java <version>` |

## 10. 참고 파일

- 실행 설정 시트·실행 상세: `prizm/components/code-assets-workspace.tsx` (`beginRun` 740행, 실행 상세 1014행, 실행 설정 시트 1058행)
- Generic DAG: `prototype/airflow/dags/mlops_notebook_executor.py`
- 노트북 v1: `prototype/notebooks/demo_yolov8_training.ipynb`
- 기존 Airflow·MLflow 연동 참고: `prototype/portal/app.py` (`/api/trigger`, `/api/run_status`, `/api/run_log`, `/api/history`)
- Compose: `prototype/docker-compose.yml`
