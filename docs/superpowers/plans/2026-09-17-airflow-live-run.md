# PRIZM 실제 실행 연동 구현 계획 (Airflow·Papermill·MLflow + 실시간 노트북)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 코드 자산 상세의 "즉시 실행"이 Spring Boot 백엔드를 거쳐 실제 Airflow DAG(papermill)를 실행하고, MLflow Model Registry에 모델을 등록하며, 실행 중인 노트북 셀과 로그를 화면에 실시간으로 보여준다.

**Architecture:** 3개 영역을 순서대로 만든다. (A) prototype 인프라: DAG가 `prizm_run_id` 폴더에 papermill 스냅샷을 자주 저장하고, 노트북 v2가 MLflow에 모델을 등록한다. (B) `prizm-backend`: 실행을 H2에 저장하고 Airflow를 트리거하며, 2초 주기 모니터가 Airflow 상태·로그와 `executed.ipynb`를 읽어 바뀐 것만 SSE로 푸시한다. (C) `prizm-portal`: 실행 설정 시트가 백엔드를 호출하고, live run 상세 화면이 SSE를 구독해 셀·로그·결과를 렌더링한다.

**Tech Stack:** Spring Boot 4.1.1 · Java 21(Temurin, SDKMAN) · Gradle 9.7.1 Kotlin DSL · H2 2.4 · Jackson 3.1(`tools.jackson.*`) · Spring `RestClient`/`MockRestServiceServer` · Airflow 2.10.2 · papermill 2.6.0 · MLflow 2.16.2 · ultralytics 8.3.28 · Next.js(vinext 1.0 beta) · React 19 · TypeScript 5.9 · oxlint · Playwright(검증용, 저장하지 않음)

**Spec:** `docs/superpowers/specs/2026-09-17-airflow-live-run-design.md` (실행자는 반드시 설계 문서도 함께 읽는다. 특히 10장·10.1장의 변경 사항)

## Global Constraints

- 문서·UI 문구·커밋 메시지 본문은 한국어. 코드 식별자는 영어.
- 경로 약칭: `PORTAL` = `~/Documents/Codex/2026-09-09/dnp/work/prizm-portal`, `BACKEND` = `~/Documents/Codex/2026-09-09/dnp/work/prizm-backend`, `PROTO` = `~/Workspace/notebook/prototype`.
- `PORTAL` 작업은 `feature/airflow-live-run` 브랜치에서만 한다. `main`에 커밋·병합하지 않는다. 되돌리기 기준은 태그 `before-airflow-live-run`(= `309374d`).
- `PROTO`는 git이 아니다. 수정 전 원본을 `PROTO/.backup-2026-09-17/`에 복사한다.
- 백엔드 포트 **8081**, Airflow 8080(admin/admin), MLflow 5050, AI Hub 8000, 프론트 3000.
- 모든 Java/Gradle 명령은 새 셸마다 `source "$HOME/.sdkman/bin/sdkman-init.sh" &&`를 앞에 붙인다.
- 실행 ID `RUN-` + H2 시퀀스(27000부터), Airflow `dag_run_id` = `prizm_{runId}`, DAG id `mlops_notebook_executor`.
- MLflow 실험 `prizm-weld-training`, 등록 모델 `weld-bead-defect-detector`, 실행 폴더 `PROTO/runs/{runId}/executed.ipynb`.
- 매핑 자산: `PRJ000212-C-0001` @ `v2.4.1` → `demo.door_defect_yolov8_training` @ `v2`, 파라미터 이름 `epochs→epochs`, `batch_size→batch`, `image_size→imgsz`, `seed→seed`.
- 실행자 고정값 `이학선`. 실행 자원·환경 값은 기록만 한다.
- SSE 이벤트 이름 `notebook`·`log`·`run`, **항상 `run`을 마지막에** 보낸다. emitter 타임아웃 30분, heartbeat 15초(`: ping`).
- 백엔드 테스트 의존성은 `spring-boot-starter-webmvc-test`(+Initializr 기본 `data-jpa-test`)만. OkHttp·WireMock 등 외부 테스트 라이브러리 추가 금지.
- Jackson 3 `JsonNode`에서 문자열은 `isString()`/`stringValue()`만 쓴다(`asText()`/`textValue()` 사용 금지 — 3.x에서 이름 변경됨).
- 프론트는 테스트 프레임워크·의존성을 추가하지 않는다(`package.json` 변경 금지). 검증: `npx tsc --noEmit`(현재 통과), 신규 파일 `npx oxlint <파일>` 오류 0건, `components/code-assets-workspace.tsx`는 기존 `error` 14줄에서 증가 금지. `<img>` 대신 `next/image`(`unoptimized`).

## File Structure

### A. 인프라 (`PROTO`)

| 파일 | 변경 | 책임 |
|---|---|---|
| `docker-compose.yml` | 수정 | `airflow` 볼륨에 `./runs:/opt/airflow/mlops_run` |
| `airflow/dags/mlops_notebook_executor.py` | 수정 | `prizm_run_id` 폴더, papermill 자동 저장, `prizm_run_id` 파라미터 주입 |
| `notebooks/demo_yolov8_training_v2.ipynb` | 생성 | epoch 출력·epochs 가드·MLflow Registry 등록 노트북 |
| `seed/register_notebook_v2.py` | 생성 | AI Hub에 코드 자산 v2 등록 |
| `runs/` | 생성 | 실행 스냅샷 공유 폴더 |

### B. 백엔드 (`BACKEND`, 패키지 `com.prizm.backend`)

| 파일 | 책임 |
|---|---|
| `build.gradle.kts`, `settings.gradle.kts`, `gradlew*`, `.gitignore`, `README.md` | 빌드·실행 안내 |
| `src/main/resources/application.yml` | 포트·H2·외부 서비스·자산 매핑 |
| `PrizmBackendApplication.java` | 진입점, `@ConfigurationPropertiesScan`, `Clock` 빈 |
| `config/PrizmProperties.java` | `prizm.*` 설정 레코드 |
| `config/SchedulingConfig.java` | `prizm.monitor.enabled`일 때만 `@EnableScheduling` |
| `config/HttpClientConfig.java` | Airflow·MLflow `RestClient` 생성(basic auth, 타임아웃) |
| `config/WebConfig.java` | `/api/**` CORS |
| `asset/CodeAssetProperties.java`, `asset/CodeAssetCatalog.java` | 자산 매핑 조회·파라미터 이름 변환·타입 검증 |
| `api/ApiError.java`, `api/ApiExceptionHandler.java`, `api/InvalidRunRequestException.java`, `api/RunNotFoundException.java`, `api/RunTriggerException.java` | 400·404·502 오류 규약 |
| `notebook/CellOutput.java`, `notebook/NotebookCell.java`, `notebook/NotebookSnapshotReader.java` | `executed.ipynb` 파싱 |
| `airflow/AirflowTaskState.java`, `airflow/AirflowClient.java` | DAG 트리거·상태·로그 |
| `mlflow/MlflowRunResult.java`, `mlflow/MlflowClient.java` | 태그 기반 run·모델 버전 조회 |
| `run/RunStatus.java`, `run/RunStage.java`, `run/Run.java`, `run/RunRepository.java`, `run/RunIdGenerator.java`, `run/CreateRunRequest.java`, `run/RunResponse.java`, `run/RunService.java`, `run/RunController.java` | 실행 도메인·API |
| `run/monitor/RunProgress.java`, `run/monitor/RunProgressCalculator.java` | 단계·진행률 계산 |
| `run/monitor/NotebookPayload.java`, `run/monitor/LogPayload.java`, `run/monitor/RunEvents.java`, `run/monitor/RunSnapshotStore.java` | 스냅샷 캐시·변경 감지 |
| `run/monitor/RunEventBroadcaster.java` | SSE 구독자 관리·heartbeat |
| `run/monitor/RunMonitor.java` | 2초 주기 수집·푸시 |
| `src/test/java/com/prizm/backend/TestFixtures.java` + 각 `*Test.java` | 테스트 |
| `src/test/resources/notebooks/{running,failed,partial}.ipynb` | papermill 형식 fixture |

### C. 프론트 (`PORTAL`)

| 파일 | 변경 | 책임 |
|---|---|---|
| `lib/prizm-api.ts` | 생성 | 백엔드 타입·`createRun`·`listRuns`·스트림 URL |
| `hooks/use-run-stream.ts` | 생성 | `EventSource` 구독 훅 |
| `components/live-notebook.tsx` | 생성 | 셀 렌더러·자동 스크롤 |
| `components/live-run-detail.tsx` | 생성 | live run 상세 화면 |
| `components/code-assets-workspace.tsx` | 수정 | 파라미터 controlled state, 실제 실행 호출, live 목록 병합, 상세 분기, mock 타이머 제한 |
| `app/prizm-design-system.css` | 수정 | `live-notebook-*`, `live-run-*`, `state-실패`, 시트 오류 스타일 |

### 작업 순서와 의존

Part A(Task 1~3) → Part B(Task 4~15) → Part C(Task 16~20). Docker Desktop이 필요한 태스크는 **3·15·20**뿐이다. 나머지는 테스트·타입 검사만으로 끝나므로, Docker를 쓸 수 없는 동안에는 Task 1·2 → 4~14 → 16~19를 먼저 진행하고 Task 3·15·20을 나중에 몰아서 해도 된다.

---

## Part A — 인프라 (`PROTO`)

### Task 1: 백업, 공유 폴더 마운트, DAG 수정

**Files:**
- Create: `PROTO/.backup-2026-09-17/docker-compose.yml`, `PROTO/.backup-2026-09-17/mlops_notebook_executor.py`, `PROTO/runs/`
- Modify: `PROTO/docker-compose.yml` (`airflow.volumes`)
- Modify: `PROTO/airflow/dags/mlops_notebook_executor.py` (`download_notebook`, `execute_notebook`)

**Interfaces:**
- Produces: DAG conf 계약 `{"code_key", "code_version", "prizm_run_id"?, "extra_params"?}`. `prizm_run_id`가 있으면 실행 폴더 `/opt/airflow/mlops_run/{prizm_run_id}` = 호스트 `PROTO/runs/{prizm_run_id}`, 노트북 파라미터 `prizm_run_id` 주입. papermill 결과 `executed.ipynb`가 셀 시작·완료마다와 출력 메시지 수신 시(마지막 저장 후 3초 경과) 저장됨.

- [ ] **Step 1: 원본 백업과 공유 폴더 생성**

```bash
cd ~/Workspace/notebook/prototype
mkdir -p .backup-2026-09-17 runs
cp docker-compose.yml .backup-2026-09-17/docker-compose.yml
cp airflow/dags/mlops_notebook_executor.py .backup-2026-09-17/mlops_notebook_executor.py
ls -la .backup-2026-09-17
```

Expected: 두 파일이 보인다.

- [ ] **Step 2: `docker-compose.yml`에 볼륨 추가**

`airflow` 서비스의 다음 부분을

```yaml
    volumes:
      - ./airflow/dags:/opt/airflow/dags
    depends_on:
      - ai-hub
      - mlflow
```

아래로 바꾼다.

```yaml
    volumes:
      - ./airflow/dags:/opt/airflow/dags
      # PRIZM 백엔드가 papermill 실행 스냅샷(executed.ipynb)을 읽는 공유 폴더
      - ./runs:/opt/airflow/mlops_run
    depends_on:
      - ai-hub
      - mlflow
```

- [ ] **Step 3: `download_notebook`에서 `prizm_run_id` 폴더 사용**

다음 부분을

```python
    import mlops

    run_dir = os.path.join(RUN_ROOT, context["run_id"].replace(":", "_").replace("+", "_"))
    code_dir = os.path.join(run_dir, "code")
```

아래로 바꾼다.

```python
    import mlops

    # PRIZM 백엔드가 트리거한 실행은 prizm_run_id 폴더를 쓴다 - 백엔드가 이 경로의
    # executed.ipynb를 읽어 화면에 실시간으로 보여준다. 없으면 기존 규칙(trigger.sh, 기존 포털).
    prizm_run_id = conf.get("prizm_run_id")
    run_folder = prizm_run_id or context["run_id"].replace(":", "_").replace("+", "_")
    run_dir = os.path.join(RUN_ROOT, run_folder)
    code_dir = os.path.join(run_dir, "code")
```

- [ ] **Step 4: `execute_notebook`에 `prizm_run_id` 주입과 자동 저장 추가**

다음 부분을

```python
    base_params = {
        "output_dir": output_dir,
        "mlflow_tracking_uri": MLFLOW_TRACKING_URI,
    }
    parameters = {**extra_params, **base_params}
```

아래로 바꾼다.

```python
    base_params = {
        "output_dir": output_dir,
        "mlflow_tracking_uri": MLFLOW_TRACKING_URI,
    }
    if conf.get("prizm_run_id"):
        base_params["prizm_run_id"] = conf["prizm_run_id"]
    parameters = {**extra_params, **base_params}
```

그리고 다음 호출을

```python
    pm.execute_notebook(
        notebook_path,
        executed_notebook_path,
        parameters=parameters,
        log_output=True,
        kernel_name="python3",
    )
```

아래로 바꾼다.

```python
    # request_save_on_cell_execute: 셀 시작·완료마다 저장
    # autosave_cell_every=3: 긴 셀 실행 중 출력 메시지가 오면 마지막 저장 후 3초 이상일 때 저장
    #   (타이머가 아니라 메시지 기반 - 학습 셀은 epoch마다 print해서 메시지를 보장한다)
    pm.execute_notebook(
        notebook_path,
        executed_notebook_path,
        parameters=parameters,
        request_save_on_cell_execute=True,
        autosave_cell_every=3,
        log_output=True,
        kernel_name="python3",
    )
```

- [ ] **Step 5: 문법 확인**

```bash
cd ~/Workspace/notebook/prototype
python3 -m py_compile airflow/dags/mlops_notebook_executor.py && echo OK
diff .backup-2026-09-17/mlops_notebook_executor.py airflow/dags/mlops_notebook_executor.py
diff .backup-2026-09-17/docker-compose.yml docker-compose.yml
```

Expected: `OK`, diff에 Step 2~4 변경만 보인다. (`PROTO`는 git이 아니므로 커밋 없음. 실제 동작 검증은 Task 3.)

---

### Task 2: 노트북 v2와 등록 스크립트

**Files:**
- Create: `PROTO/notebooks/demo_yolov8_training_v2.ipynb` (v1에서 생성, v1은 수정하지 않음)
- Create: `PROTO/seed/register_notebook_v2.py`

**Interfaces:**
- Consumes: Task 1의 파라미터 주입(`prizm_run_id`, `output_dir`, `mlflow_tracking_uri`, extra_params `epochs`·`batch`·`imgsz`·`seed`).
- Produces: 노트북 계약 — parameters 셀 변수 `prizm_run_id=""`, `mlflow_experiment="prizm-weld-training"`, `registered_model_name="weld-bead-defect-detector"`, 기본값 `epochs=3`, `imgsz=320`, `batch=4`, `seed=42`. 학습 셀은 `epochs < 1`이면 `ValueError("epochs는 1 이상이어야 합니다")`, epoch마다 `epoch {n}/{epochs} · box_loss {x:.3f} · cls_loss {y:.3f} · mAP50 {z:.3f}` 출력. 마지막 셀은 MLflow run에 태그 `prizm_run_id`, 메트릭 `mAP50`, 모델 `weld-bead-defect-detector` 새 버전 등록. AI Hub 코드 자산 `demo.door_defect_yolov8_training@v2`.

- [ ] **Step 1: v2 노트북 생성 스크립트 실행**

v1 셀 구조(0 마크다운, 1 parameters, 9 학습, 13 업로드)를 기준으로 수정한다. 아래를 그대로 실행한다.

```bash
cd ~/Workspace/notebook/prototype
md5 -q notebooks/demo_yolov8_training.ipynb > .backup-2026-09-17/demo_yolov8_training.v1.md5
python3 - <<'PY'
import json
from pathlib import Path

src = Path("notebooks/demo_yolov8_training.ipynb")
dst = Path("notebooks/demo_yolov8_training_v2.ipynb")
nb = json.loads(src.read_text(encoding="utf-8"))
cells = nb["cells"]


def text(cell):
    return "".join(cell["source"])


def set_text(cell, value):
    cell["source"] = value.splitlines(keepends=True)


assert "parameters" in cells[1]["metadata"].get("tags", []), "cell 1 must be parameters"
assert "model.train(" in text(cells[9]), "cell 9 must be training"
assert "mlflow.start_run" in text(cells[13]), "cell 13 must be mlflow upload"

set_text(cells[0], text(cells[0]) + (
    "\n\n> **v2 — PRIZM 실행 연동**: `prizm_run_id` 태그, epoch별 진행 출력, "
    "`epochs` 가드, MLflow Model Registry(`weld-bead-defect-detector`) 등록.\n"
))

params = text(cells[1])
params = params.replace(
    'model_key = "demo.door_defect_yolov8"\n',
    'model_key = "demo.door_defect_yolov8"\n'
    "\n"
    "# PRIZM 실행 연동 - 백엔드/Airflow가 prizm_run_id를 주입한다\n"
    'prizm_run_id = ""\n'
    'mlflow_experiment = "prizm-weld-training"\n'
    'registered_model_name = "weld-bead-defect-detector"\n',
)
params = params.replace("epochs = 1\n", "epochs = 3\n").replace("seed = 0\n", "seed = 42\n")
assert 'prizm_run_id = ""' in params and "epochs = 3\n" in params and "seed = 42\n" in params
assert "imgsz = 320\n" in params and "batch = 4\n" in params
set_text(cells[1], params)

set_text(cells[9], (
    "# ultralytics는 epochs=0을 기본값(100)으로 바꿔 실행하므로 노트북 계약에서 먼저 막는다\n"
    "if epochs < 1:\n"
    '    raise ValueError("epochs는 1 이상이어야 합니다")\n'
    "\n"
    "\n"
    "def _print_epoch(trainer):\n"
    '    losses = trainer.label_loss_items(trainer.tloss, prefix="train")\n'
    "    metrics = trainer.metrics or {}\n"
    "    print(\n"
    '        f"epoch {trainer.epoch + 1}/{epochs} · "\n'
    "        f\"box_loss {losses.get('train/box_loss', 0.0):.3f} · \"\n"
    "        f\"cls_loss {losses.get('train/cls_loss', 0.0):.3f} · \"\n"
    "        f\"mAP50 {metrics.get('metrics/mAP50(B)', 0.0):.3f}\",\n"
    "        flush=True,\n"
    "    )\n"
    "\n"
    "\n"
    'model.add_callback("on_fit_epoch_end", _print_epoch)\n'
    "\n"
) + text(cells[9]))

set_text(cells[13], '''best_weight = os.path.join(output_dir, "train", "weights", "best.pt")


class YoloWeightsModel(mlflow.pyfunc.PythonModel):
    """best.pt를 MLflow Model Registry에 올리기 위한 최소 pyfunc 래퍼."""

    def load_context(self, context):
        from ultralytics import YOLO

        self.model = YOLO(context.artifacts["weights"])

    def predict(self, context, model_input):
        results = self.model.predict(list(model_input["image_path"]), verbose=False)
        return [len(result.boxes) for result in results]


mlflow.set_tracking_uri(mlflow_tracking_uri)
mlflow.set_experiment(mlflow_experiment)

with mlflow.start_run(run_name=f"{prizm_run_id or 'manual'}-yolov8-training"):
    mlflow.set_tag("prizm_run_id", prizm_run_id)
    mlflow.log_params({
        "base_model": f"{base_model_key}:{base_model_version}",
        "epochs": epochs, "imgsz": imgsz, "batch": batch, "seed": seed,
        "optimizer": optimizer, "lr0": lr0, "lrf": lrf,
        "momentum": momentum, "weight_decay": weight_decay,
        "patience": patience, "mosaic": mosaic, "mixup": mixup,
    })
    mlflow.log_metric("mAP50", map50)
    mlflow.log_artifact(best_weight)
    mlflow.pyfunc.log_model(
        artifact_path="model",
        python_model=YoloWeightsModel(),
        artifacts={"weights": best_weight},
        pip_requirements=["mlflow==2.16.2", "ultralytics==8.3.28"],
        registered_model_name=registered_model_name,
    )

    result = mlops.model.upload(model_key, best_weight)
    mlflow.set_tag("mlops_asset_key", result["key"])
    mlflow.set_tag("mlops_asset_version", result["version"])

print("registered:", result)
''')

for cell in cells:
    if cell["cell_type"] == "code":
        cell["outputs"] = []
        cell["execution_count"] = None

dst.write_text(json.dumps(nb, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("written", dst, len(cells), "cells")
PY
```

Expected: `written notebooks/demo_yolov8_training_v2.ipynb 14 cells`

- [ ] **Step 2: 생성 결과 확인**

```bash
cd ~/Workspace/notebook/prototype
python3 - <<'PY'
import ast, json
nb = json.load(open("notebooks/demo_yolov8_training_v2.ipynb", encoding="utf-8"))
for i, c in enumerate(nb["cells"]):
    if c["cell_type"] == "code":
        ast.parse("".join(c["source"]))  # 문법 오류면 예외
src = "".join("".join(c["source"]) for c in nb["cells"])
for needle in ['prizm_run_id = ""', 'raise ValueError("epochs는 1 이상이어야 합니다")',
               'on_fit_epoch_end', 'registered_model_name=registered_model_name',
               'mlflow.set_tag("prizm_run_id", prizm_run_id)', 'pip_requirements=']:
    assert needle in src, needle
print("v2 notebook OK")
PY
[ "$(md5 -q notebooks/demo_yolov8_training.ipynb)" = "$(cat .backup-2026-09-17/demo_yolov8_training.v1.md5)" ] && echo "v1 untouched"
```

Expected: `v2 notebook OK`, `v1 untouched`

- [ ] **Step 3: 등록 스크립트 작성**

`PROTO/seed/register_notebook_v2.py`:

```python
"""노트북 v2(PRIZM 실행 연동)를 AI Hub 코드 자산으로 등록한다 (1회성).

    docker compose --profile seed run --rm --entrypoint python seed register_notebook_v2.py

demo.door_defect 데이터셋과 demo.yolov8n_base 가중치는 seed_assets.py가 먼저 등록해 두어야 한다.
"""
import sys
from pathlib import Path

sys.path.insert(0, "/opt/mlops-sdk")
import mlops  # noqa: E402
from seed_assets import wait_for_ai_hub  # noqa: E402

CODE_KEY = "demo.door_defect_yolov8_training"
NOTEBOOK = Path("/opt/seed/notebooks/demo_yolov8_training_v2.ipynb")

if __name__ == "__main__":
    wait_for_ai_hub()
    result = mlops.code.upload(CODE_KEY, str(NOTEBOOK), version="v2")
    print("[seed] registered notebook v2:", result)
```

- [ ] **Step 4: 문법 확인**

```bash
cd ~/Workspace/notebook/prototype && python3 -m py_compile seed/register_notebook_v2.py && echo OK
```

Expected: `OK` (등록 실행은 Task 3)

---

### Task 3: 인프라 실동작 검증 (Docker 필요)

**Files:** 없음(검증 전용). 실패 시 Task 1·2 파일을 고친다.

**Interfaces:**
- Consumes: Task 1·2 결과.
- Produces: 확인된 사실 — `PROTO/runs/{id}/executed.ipynb`가 학습 중 수 초 간격으로 갱신, MLflow에 태그 run과 등록 모델 버전 생성, `epochs=0`이면 `ValueError`로 실패. Part B 백엔드가 이 계약에 의존한다.

- [ ] **Step 1: Docker와 스택 기동**

```bash
open -a Docker
until docker info >/dev/null 2>&1; do sleep 3; done
cd ~/Workspace/notebook/prototype
docker compose up -d minio minio-init ai-hub mlflow
until curl -sf localhost:8000/health >/dev/null; do sleep 3; done
curl -s localhost:8000/assets | python3 -c "import json,sys; d=json.load(sys.stdin); print(sorted(d.get('dataset',{})), sorted(d.get('model',{})), {k: sorted(v) for k, v in d.get('code',{}).items()})"
```

Expected: `demo.door_defect`와 `demo.yolov8n_base`가 목록에 있다. 없으면 먼저 `docker compose --profile seed run --rm seed`를 실행하고 다시 확인한다.

- [ ] **Step 2: v2 등록**

```bash
cd ~/Workspace/notebook/prototype
docker compose --profile seed run --rm --entrypoint python seed register_notebook_v2.py
curl -s "localhost:8000/assets/resolve?type=code&key=demo.door_defect_yolov8_training&version=v2"
```

Expected: `[seed] registered notebook v2: ...` 출력, resolve 응답에 `"version":"v2"`.

- [ ] **Step 3: Airflow 재생성과 DAG 로드 확인**

```bash
cd ~/Workspace/notebook/prototype
docker compose up -d --force-recreate airflow
until curl -sf -u admin:admin localhost:8080/api/v1/health >/dev/null; do sleep 5; done
docker compose exec -T airflow ls -ld /opt/airflow/mlops_run
docker compose exec -T airflow airflow dags list-import-errors
```

Expected: `mlops_run` 디렉터리가 보이고, import error는 `No data found`.

- [ ] **Step 4: `prizm_run_id`로 트리거하고 스냅샷 갱신 관찰**

```bash
cd ~/Workspace/notebook/prototype
curl -s -u admin:admin -X POST localhost:8080/api/v1/dags/mlops_notebook_executor/dagRuns \
  -H 'Content-Type: application/json' \
  -d '{"dag_run_id":"prizm_RUN-INFRA-1","conf":{"code_key":"demo.door_defect_yolov8_training","code_version":"v2","prizm_run_id":"RUN-INFRA-1","extra_params":{"epochs":2,"batch":4,"imgsz":320,"seed":42}}}'
for i in $(seq 1 200); do
  S=$(curl -s -u admin:admin localhost:8080/api/v1/dags/mlops_notebook_executor/dagRuns/prizm_RUN-INFRA-1 | python3 -c "import json,sys; print(json.load(sys.stdin)['state'])")
  M=$(stat -f '%Sm' -t '%H:%M:%S' runs/RUN-INFRA-1/executed.ipynb 2>/dev/null || echo '-')
  echo "$(date +%H:%M:%S) state=$S executed.ipynb mtime=$M"
  [ "$S" = success ] || [ "$S" = failed ] && break
  sleep 3
done
```

Expected: 학습 셀 실행 중 mtime이 수 초 간격으로 바뀌고 최종 `state=success`. `failed`면 `docker compose exec -T airflow bash -lc 'tail -80 /opt/airflow/logs/dag_id=mlops_notebook_executor/run_id=prizm_RUN-INFRA-1/task_id=execute_notebook/attempt=1.log'`로 원인을 보고 Task 2 노트북을 고친 뒤 v2를 다시 등록하고 `RUN-INFRA-2`로 재시도한다.

- [ ] **Step 5: 셀 상태·주입 파라미터·epoch 출력 확인**

```bash
cd ~/Workspace/notebook/prototype
python3 - <<'PY'
import json
nb = json.load(open("runs/RUN-INFRA-1/executed.ipynb", encoding="utf-8"))
inj = [c for c in nb["cells"] if "injected-parameters" in c["metadata"].get("tags", [])]
print("injected:", "".join(inj[0]["source"]))
print("statuses:", [c["metadata"].get("papermill", {}).get("status") for c in nb["cells"]])
outs = "".join(
    "".join(o["text"]) if isinstance(o.get("text"), list) else o.get("text", "")
    for c in nb["cells"] if c["cell_type"] == "code" for o in c["outputs"]
)
print("epoch lines:", [l for l in outs.splitlines() if l.startswith("epoch ")])
PY
```

Expected: injected에 `epochs = 2`, `prizm_run_id = "RUN-INFRA-1"`; statuses 전부 `completed`; `epoch 1/2 · ...`, `epoch 2/2 · ...` 두 줄.

- [ ] **Step 6: MLflow 결과 확인**

```bash
EXP=$(curl -s "localhost:5050/api/2.0/mlflow/experiments/get-by-name?experiment_name=prizm-weld-training" | python3 -c "import json,sys; print(json.load(sys.stdin)['experiment']['experiment_id'])")
curl -s -X POST localhost:5050/api/2.0/mlflow/runs/search -H 'Content-Type: application/json' \
  -d "{\"experiment_ids\":[\"$EXP\"],\"filter\":\"tags.prizm_run_id = 'RUN-INFRA-1'\",\"max_results\":1}" \
  | python3 -c "import json,sys; r=json.load(sys.stdin)['runs'][0]; print(r['info']['run_id'], [m for m in r['data']['metrics'] if m['key']=='mAP50'], [p for p in r['data']['params'] if p['key']=='epochs'])"
curl -s "localhost:5050/api/2.0/mlflow/model-versions/search?filter=name%3D'weld-bead-defect-detector'" | python3 -c "import json,sys; print([(v['version'], v['run_id']) for v in json.load(sys.stdin)['model_versions']])"
```

Expected: run_id 1개, `mAP50` 메트릭, `epochs` param `2`, 모델 버전 목록에 방금 run_id를 가진 버전이 있다.

- [ ] **Step 7: 실패 경로 확인 (`epochs=0`)**

```bash
cd ~/Workspace/notebook/prototype
curl -s -u admin:admin -X POST localhost:8080/api/v1/dags/mlops_notebook_executor/dagRuns \
  -H 'Content-Type: application/json' \
  -d '{"dag_run_id":"prizm_RUN-INFRA-FAIL","conf":{"code_key":"demo.door_defect_yolov8_training","code_version":"v2","prizm_run_id":"RUN-INFRA-FAIL","extra_params":{"epochs":0,"batch":4,"imgsz":320,"seed":42}}}'
until curl -s -u admin:admin localhost:8080/api/v1/dags/mlops_notebook_executor/dagRuns/prizm_RUN-INFRA-FAIL | grep -Eq '"state": ?"(failed|success)"'; do sleep 5; done
curl -s -u admin:admin localhost:8080/api/v1/dags/mlops_notebook_executor/dagRuns/prizm_RUN-INFRA-FAIL | grep '"state"'
curl -s -u admin:admin -H 'Accept: text/plain' localhost:8080/api/v1/dags/mlops_notebook_executor/dagRuns/prizm_RUN-INFRA-FAIL/taskInstances/execute_notebook/logs/1 | grep -n "ValueError" | tail -3
python3 -c "import json; nb=json.load(open('runs/RUN-INFRA-FAIL/executed.ipynb')); print([(c['cell_type'], c['metadata'].get('tags'), c['metadata'].get('papermill',{}).get('status')) for c in nb['cells']][:4])"
```

Expected: `"state": "failed"`, 로그에 `ValueError: epochs는 1 이상이어야 합니다` 줄, 노트북 앞쪽에 `papermill-error-cell-tag` 마크다운 셀과 `failed` 코드 셀. (이 로그 줄 형식이 Task 13 `RunMonitor` 오류 메시지 추출 테스트의 근거다. 형식이 다르면 Task 13 테스트의 로그 fixture 줄을 실제 줄로 바꾼다.)

---

## Part B — 백엔드 (`BACKEND`)

모든 Java 파일 경로는 `BACKEND/src/main/java/com/prizm/backend/` 또는 `BACKEND/src/test/java/com/prizm/backend/` 기준이다. 아래에서 `main/…`, `test/…`로 줄여 쓴다.

### Task 4: JDK 설치, 프로젝트 스캐폴드, 설정 바인딩

**Files:**
- Create: `BACKEND/` (Spring Initializr 결과), `BACKEND/build.gradle.kts`(교체), `BACKEND/src/main/resources/application.yml`
- Delete: `BACKEND/src/main/resources/application.properties`, `BACKEND/HELP.md`
- Create: `main/PrizmBackendApplication.java`(교체), `main/config/PrizmProperties.java`, `main/config/SchedulingConfig.java`, `main/asset/CodeAssetProperties.java`
- Test: `test/PrizmBackendApplicationTests.java`(교체)

**Interfaces:**
- Produces:
  - `record PrizmProperties(Airflow airflow, Mlflow mlflow, Path runsDir, Cors cors, Monitor monitor, List<CodeAssetProperties> codeAssets)` — 중첩 `Airflow(String baseUrl, String username, String password, String dagId)`, `Mlflow(String baseUrl, String experimentName)`, `Cors(List<String> allowedOrigins)`, `Monitor(boolean enabled)`
  - `record CodeAssetProperties(String assetId, String assetVersion, String codeKey, String codeVersion, Map<String, String> parameterNames)` — 키 순서 보존
  - `Clock` 빈(UTC). `prizm.monitor.enabled=false`면 스케줄링 비활성

- [ ] **Step 1: SDKMAN과 Temurin JDK 21 설치**

```bash
[ -d "$HOME/.sdkman" ] || curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
JAVA_ID=$(sdk list java | grep -oE '21\.[0-9]+\.[0-9]+-tem' | sort -t. -k2,2n -k3,3n | tail -1)
echo "installing $JAVA_ID"
sdk install java "$JAVA_ID" <<< "Y"
java -version
```

Expected: `openjdk version "21.0.x"` 및 `Temurin`.

- [ ] **Step 2: Initializr로 스캐폴드 생성과 git 초기화**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work
[ -e prizm-backend ] && { echo "prizm-backend already exists - stop and inspect"; exit 1; }
curl -s https://start.spring.io/starter.zip \
  -d type=gradle-project-kotlin -d language=java -d bootVersion=4.1.1 -d javaVersion=21 \
  -d groupId=com.prizm -d artifactId=prizm-backend -d name=prizm-backend \
  -d packageName=com.prizm.backend -d dependencies=web,data-jpa,validation,h2,devtools \
  -o "$TMPDIR/prizm-backend.zip"
mkdir prizm-backend && unzip -q "$TMPDIR/prizm-backend.zip" -d prizm-backend
cd prizm-backend
rm src/main/resources/application.properties HELP.md
grep distributionUrl gradle/wrapper/gradle-wrapper.properties
git init -b main
printf '\n### PRIZM ###\n/data/\n' >> .gitignore
```

Expected: `gradle-9.7.1-bin.zip`.

- [ ] **Step 3: `build.gradle.kts` 교체 (h2console·validation-test 제거)**

```kotlin
plugins {
    java
    id("org.springframework.boot") version "4.1.1"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.prizm"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    developmentOnly("org.springframework.boot:spring-boot-devtools")
    runtimeOnly("com.h2database:h2")
    testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
```

- [ ] **Step 4: `src/main/resources/application.yml` 작성**

```yaml
server:
  port: 8081

spring:
  application:
    name: prizm-backend
  datasource:
    url: jdbc:h2:file:./data/prizm-backend
    username: sa
    password: ""
  jpa:
    hibernate:
      ddl-auto: update
    open-in-view: false

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
  monitor:
    enabled: true
  code-assets:
    - asset-id: PRJ000212-C-0001
      asset-version: v2.4.1
      code-key: demo.door_defect_yolov8_training
      code-version: v2
      # 맵 키에 '_'가 있으면 Spring Boot가 문자를 제거하므로 대괄호 표기를 쓴다
      parameter-names:
        epochs: epochs
        "[batch_size]": batch
        "[image_size]": imgsz
        seed: seed
```

- [ ] **Step 5: 실패하는 설정 바인딩 테스트 작성**

`test/PrizmBackendApplicationTests.java`:

```java
package com.prizm.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;

import com.prizm.backend.asset.CodeAssetProperties;
import com.prizm.backend.config.PrizmProperties;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:prizm-test;DB_CLOSE_DELAY=-1",
        "prizm.monitor.enabled=false"
})
class PrizmBackendApplicationTests {

    @Autowired
    private PrizmProperties properties;

    @Test
    void bindsPrizmProperties() {
        assertThat(properties.airflow().baseUrl()).isEqualTo("http://localhost:8080");
        assertThat(properties.airflow().dagId()).isEqualTo("mlops_notebook_executor");
        assertThat(properties.mlflow().experimentName()).isEqualTo("prizm-weld-training");
        assertThat(properties.runsDir()).endsWithRaw(Path.of("Workspace", "notebook", "prototype", "runs"));
        assertThat(properties.cors().allowedOrigins()).containsExactly("http://localhost:3000");
        assertThat(properties.monitor().enabled()).isFalse();
    }

    @Test
    void keepsUnderscoresInParameterNameKeys() {
        CodeAssetProperties asset = properties.codeAssets().getFirst();

        assertThat(asset.assetId()).isEqualTo("PRJ000212-C-0001");
        assertThat(asset.codeVersion()).isEqualTo("v2");
        assertThat(asset.parameterNames()).containsExactly(
                entry("epochs", "epochs"),
                entry("batch_size", "batch"),
                entry("image_size", "imgsz"),
                entry("seed", "seed"));
    }
}
```

- [ ] **Step 6: 테스트 실패 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests PrizmBackendApplicationTests
```

Expected: FAIL — `cannot find symbol` (`PrizmProperties`, `CodeAssetProperties`). 첫 실행은 Gradle·의존성 다운로드로 수 분 걸린다.

- [ ] **Step 7: 설정 클래스 구현**

`main/asset/CodeAssetProperties.java`:

```java
package com.prizm.backend.asset;

import java.util.Map;

/** 프론트 자산 ID·버전과 AI Hub 코드 자산, 화면 파라미터 이름 → 노트북 변수 이름 매핑. */
public record CodeAssetProperties(
        String assetId,
        String assetVersion,
        String codeKey,
        String codeVersion,
        Map<String, String> parameterNames) {
}
```

`main/config/PrizmProperties.java`:

```java
package com.prizm.backend.config;

import com.prizm.backend.asset.CodeAssetProperties;
import java.nio.file.Path;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "prizm")
public record PrizmProperties(
        Airflow airflow,
        Mlflow mlflow,
        Path runsDir,
        Cors cors,
        Monitor monitor,
        List<CodeAssetProperties> codeAssets) {

    public record Airflow(String baseUrl, String username, String password, String dagId) {
    }

    public record Mlflow(String baseUrl, String experimentName) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record Monitor(boolean enabled) {
    }
}
```

`main/config/SchedulingConfig.java`:

```java
package com.prizm.backend.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 실행 모니터와 SSE heartbeat 스케줄러. 테스트에서는 prizm.monitor.enabled=false로 끈다. */
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "prizm.monitor", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {
}
```

`main/PrizmBackendApplication.java`:

```java
package com.prizm.backend;

import java.time.Clock;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
@ConfigurationPropertiesScan
public class PrizmBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(PrizmBackendApplication.class, args);
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
```

- [ ] **Step 8: 테스트 통과 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests PrizmBackendApplicationTests
```

Expected: PASS (2 tests). `keepsUnderscoresInParameterNameKeys`가 `batchsize` 키로 실패하면 YAML 대괄호 키가 따옴표로 감싸졌는지 확인한다.

- [ ] **Step 9: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "chore: Spring Boot 4.1.1 백엔드 스캐폴드와 prizm 설정 바인딩"
```

---

### Task 5: 코드 자산 매핑과 파라미터 검증

**Files:**
- Create: `main/api/InvalidRunRequestException.java`, `main/asset/CodeAssetCatalog.java`
- Create: `test/TestFixtures.java`
- Test: `test/asset/CodeAssetCatalogTest.java`

**Interfaces:**
- Consumes: `PrizmProperties`, `CodeAssetProperties` (Task 4)
- Produces:
  - `class InvalidRunRequestException extends RuntimeException` — `InvalidRunRequestException(String message)`
  - `CodeAssetCatalog(PrizmProperties)` — `CodeAssetProperties find(String assetId, String version)`(없으면 `InvalidRunRequestException("등록되지 않은 코드 자산입니다: {assetId}@{version}")`), `Map<String, Object> toNotebookParameters(CodeAssetProperties asset, Map<String, Object> parameters)`(매핑 순서대로 노트북 이름 → 값. 누락 `"파라미터가 누락되었습니다: {name}"`, 정수 아님 `"파라미터는 정수여야 합니다: {name}"`)
  - `TestFixtures.weldAsset()`, `TestFixtures.properties(Path runsDir)`(Airflow `http://airflow.test` admin/admin, MLflow `http://mlflow.test`), `TestFixtures.validParameters()`(`epochs 3, batch_size 4, image_size 320, seed 42`, 수정 가능한 `LinkedHashMap`) — 이후 모든 백엔드 테스트가 사용

- [ ] **Step 1: 테스트 fixture 작성**

`test/TestFixtures.java`:

```java
package com.prizm.backend;

import com.prizm.backend.asset.CodeAssetProperties;
import com.prizm.backend.config.PrizmProperties;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class TestFixtures {

    private TestFixtures() {
    }

    public static CodeAssetProperties weldAsset() {
        Map<String, String> names = new LinkedHashMap<>();
        names.put("epochs", "epochs");
        names.put("batch_size", "batch");
        names.put("image_size", "imgsz");
        names.put("seed", "seed");
        return new CodeAssetProperties(
                "PRJ000212-C-0001", "v2.4.1", "demo.door_defect_yolov8_training", "v2", names);
    }

    public static PrizmProperties properties(Path runsDir) {
        return new PrizmProperties(
                new PrizmProperties.Airflow("http://airflow.test", "admin", "admin", "mlops_notebook_executor"),
                new PrizmProperties.Mlflow("http://mlflow.test", "prizm-weld-training"),
                runsDir,
                new PrizmProperties.Cors(List.of("http://localhost:3000")),
                new PrizmProperties.Monitor(false),
                List.of(weldAsset()));
    }

    public static Map<String, Object> validParameters() {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("epochs", 3);
        parameters.put("batch_size", 4);
        parameters.put("image_size", 320);
        parameters.put("seed", 42);
        return parameters;
    }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`test/asset/CodeAssetCatalogTest.java`:

```java
package com.prizm.backend.asset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.entry;

import com.prizm.backend.TestFixtures;
import com.prizm.backend.api.InvalidRunRequestException;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CodeAssetCatalogTest {

    private final CodeAssetCatalog catalog = new CodeAssetCatalog(TestFixtures.properties(null));

    @Test
    void findsRegisteredAssetVersion() {
        CodeAssetProperties asset = catalog.find("PRJ000212-C-0001", "v2.4.1");

        assertThat(asset.codeKey()).isEqualTo("demo.door_defect_yolov8_training");
        assertThat(asset.codeVersion()).isEqualTo("v2");
    }

    @Test
    void rejectsUnknownAssetVersion() {
        assertThatThrownBy(() -> catalog.find("PRJ000212-C-0001", "v9.9.9"))
                .isInstanceOf(InvalidRunRequestException.class)
                .hasMessage("등록되지 않은 코드 자산입니다: PRJ000212-C-0001@v9.9.9");
    }

    @Test
    void translatesParameterNamesInMappingOrder() {
        Map<String, Object> result = catalog.toNotebookParameters(TestFixtures.weldAsset(), TestFixtures.validParameters());

        assertThat(result).containsExactly(
                entry("epochs", 3), entry("batch", 4), entry("imgsz", 320), entry("seed", 42));
    }

    @Test
    void rejectsMissingParameter() {
        Map<String, Object> parameters = TestFixtures.validParameters();
        parameters.remove("seed");

        assertThatThrownBy(() -> catalog.toNotebookParameters(TestFixtures.weldAsset(), parameters))
                .isInstanceOf(InvalidRunRequestException.class)
                .hasMessage("파라미터가 누락되었습니다: seed");
    }

    @Test
    void rejectsNonIntegerParameter() {
        Map<String, Object> decimal = TestFixtures.validParameters();
        decimal.put("epochs", 3.5);
        Map<String, Object> text = TestFixtures.validParameters();
        text.put("epochs", "3");

        assertThatThrownBy(() -> catalog.toNotebookParameters(TestFixtures.weldAsset(), decimal))
                .hasMessage("파라미터는 정수여야 합니다: epochs");
        assertThatThrownBy(() -> catalog.toNotebookParameters(TestFixtures.weldAsset(), text))
                .hasMessage("파라미터는 정수여야 합니다: epochs");
    }
}
```

- [ ] **Step 3: 실패 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests CodeAssetCatalogTest
```

Expected: FAIL — `cannot find symbol` (`CodeAssetCatalog`, `InvalidRunRequestException`).

- [ ] **Step 4: 구현**

`main/api/InvalidRunRequestException.java`:

```java
package com.prizm.backend.api;

/** 400 Bad Request로 응답할 실행 요청 오류. */
public class InvalidRunRequestException extends RuntimeException {

    public InvalidRunRequestException(String message) {
        super(message);
    }
}
```

`main/asset/CodeAssetCatalog.java`:

```java
package com.prizm.backend.asset;

import com.prizm.backend.api.InvalidRunRequestException;
import com.prizm.backend.config.PrizmProperties;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class CodeAssetCatalog {

    private final List<CodeAssetProperties> assets;

    public CodeAssetCatalog(PrizmProperties properties) {
        this.assets = properties.codeAssets() == null ? List.of() : List.copyOf(properties.codeAssets());
    }

    public CodeAssetProperties find(String assetId, String version) {
        return assets.stream()
                .filter(asset -> asset.assetId().equals(assetId) && asset.assetVersion().equals(version))
                .findFirst()
                .orElseThrow(() -> new InvalidRunRequestException(
                        "등록되지 않은 코드 자산입니다: " + assetId + "@" + version));
    }

    /** 화면 파라미터 이름을 노트북 변수 이름으로 바꾼다. 범위는 검증하지 않고 타입(정수)만 검증한다. */
    public Map<String, Object> toNotebookParameters(CodeAssetProperties asset, Map<String, Object> parameters) {
        Map<String, Object> notebookParameters = new LinkedHashMap<>();
        asset.parameterNames().forEach((name, notebookName) -> {
            Object value = parameters.get(name);
            if (value == null) {
                throw new InvalidRunRequestException("파라미터가 누락되었습니다: " + name);
            }
            if (!(value instanceof Integer)) {
                throw new InvalidRunRequestException("파라미터는 정수여야 합니다: " + name);
            }
            notebookParameters.put(notebookName, value);
        });
        return notebookParameters;
    }
}
```

- [ ] **Step 5: 통과 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests CodeAssetCatalogTest
```

Expected: PASS (5 tests)

- [ ] **Step 6: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "feat: 코드 자산 매핑과 실행 파라미터 이름 변환·검증"
```

---

### Task 6: papermill 노트북 스냅샷 파서

**Files:**
- Create: `main/notebook/CellOutput.java`, `main/notebook/NotebookCell.java`, `main/notebook/NotebookSnapshotReader.java`
- Create: `BACKEND/src/test/resources/notebooks/running.ipynb`, `failed.ipynb`, `partial.ipynb`
- Test: `test/notebook/NotebookSnapshotReaderTest.java`

**Interfaces:**
- Produces:
  - `record CellOutput(String type, String name, String text, String imagePng, String ename, String evalue, List<String> traceback)` + `@JsonInclude(NON_NULL)`, 팩토리 `stream(name, text)`, `text(text)`, `image(imagePng)`, `error(ename, evalue, traceback)`
  - `record NotebookCell(int index, String cellType, String source, Integer executionCount, String status, List<String> tags, List<CellOutput> outputs)`
  - `NotebookSnapshotReader(JsonMapper)` — `Optional<List<NotebookCell>> read(Path path)`: 파일 없음·불완전 JSON이면 `Optional.empty()`. `papermill-error-cell-tag` 셀 제외, `index`는 제외 후 0부터. 마크다운 status는 항상 `completed`, 코드 셀 status 누락 시 `pending`. stream·text·traceback·evalue의 ANSI 제거. `image/png`가 있으면 image만, 없으면 `text/plain`.
  - fixture `running.ipynb`: 코드 셀 5개 중 `completed` 3개 (Task 11·13 기대값의 근거)

- [ ] **Step 1: fixture 작성**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
mkdir -p src/test/resources/notebooks
cat > src/test/resources/notebooks/running.ipynb <<'EOF'
{
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {"papermill": {"status": "pending"}},
   "source": ["# 용접 비드 학습\n", "본문"]
  },
  {
   "cell_type": "code",
   "execution_count": 1,
   "metadata": {"tags": ["parameters"], "papermill": {"status": "completed"}},
   "outputs": [],
   "source": "epochs = 3\n"
  },
  {
   "cell_type": "code",
   "execution_count": 2,
   "metadata": {"tags": ["injected-parameters"], "papermill": {"status": "completed"}},
   "outputs": [],
   "source": ["# Parameters\n", "epochs = 1\n"]
  },
  {
   "cell_type": "code",
   "execution_count": 3,
   "metadata": {"papermill": {"status": "completed"}},
   "outputs": [
    {"output_type": "stream", "name": "stdout", "text": ["dataset ready: ", "/data/data.yaml\n"]},
    {"output_type": "execute_result", "execution_count": 3, "metadata": {}, "data": {"text/plain": ["0.4123"]}},
    {"output_type": "display_data", "metadata": {}, "data": {"image/png": "iVBORw0K\nGgo=\n", "text/plain": ["<Figure size 640x480>"]}}
   ],
   "source": "print('dataset ready:', data_yaml)"
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {"papermill": {"status": "running"}},
   "outputs": [
    {"output_type": "stream", "name": "stderr", "text": "[34mepoch 1/3[0m · box_loss 1.234\n"}
   ],
   "source": "model.train(data=data_yaml, epochs=epochs)"
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {"papermill": {"status": "pending"}},
   "outputs": [],
   "source": "metrics = model.val()"
  }
 ],
 "metadata": {"kernelspec": {"name": "python3"}},
 "nbformat": 4,
 "nbformat_minor": 5
}
EOF
cat > src/test/resources/notebooks/failed.ipynb <<'EOF'
{
 "cells": [
  {"cell_type": "markdown", "metadata": {"tags": ["papermill-error-cell-tag"]}, "source": "<span style=\"color:red;\">An Exception was encountered at '<a href=\"#papermill-error-cell\">In [2]</a>'.</span>"},
  {"cell_type": "code", "execution_count": 1, "metadata": {"papermill": {"status": "completed"}}, "outputs": [], "source": "epochs = 0\n"},
  {"cell_type": "markdown", "metadata": {"tags": ["papermill-error-cell-tag"]}, "source": "<span id=\"papermill-error-cell\" style=\"color:red;\">Execution using papermill encountered an exception here and stopped:</span>"},
  {"cell_type": "code", "execution_count": 2, "metadata": {"papermill": {"status": "failed"}}, "outputs": [{"output_type": "error", "ename": "ValueError", "evalue": "epochs는 1 이상이어야 합니다", "traceback": ["[0;31mValueError[0m Traceback (most recent call last)", "[0;32m----> 2[0m [38;5;28;01mraise[39;00m ValueError(\"epochs는 1 이상이어야 합니다\")"]}], "source": "if epochs < 1:\n    raise ValueError(\"epochs는 1 이상이어야 합니다\")\n"},
  {"cell_type": "code", "execution_count": null, "metadata": {"papermill": {"status": "pending"}}, "outputs": [], "source": "model.train()"}
 ],
 "metadata": {},
 "nbformat": 4,
 "nbformat_minor": 5
}
EOF
printf '%s' '{"cells": [{"cell_type": "code", "execution_count": 1, "metadata": {"papermill": {"status": "comp' > src/test/resources/notebooks/partial.ipynb
python3 -c "import json; [json.load(open(f'src/test/resources/notebooks/{n}.ipynb')) for n in ('running','failed')]; print('fixtures valid')"
```

Expected: `fixtures valid`

- [ ] **Step 2: 실패하는 테스트 작성**

`test/notebook/NotebookSnapshotReaderTest.java`:

```java
package com.prizm.backend.notebook;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

class NotebookSnapshotReaderTest {

    private final NotebookSnapshotReader reader = new NotebookSnapshotReader(JsonMapper.builder().build());

    static Path fixture(String name) throws URISyntaxException {
        return Path.of(NotebookSnapshotReaderTest.class.getResource("/notebooks/" + name).toURI());
    }

    @Test
    void readsCellsOfRunningNotebook() throws Exception {
        List<NotebookCell> cells = reader.read(fixture("running.ipynb")).orElseThrow();

        assertThat(cells).extracting(NotebookCell::index).containsExactly(0, 1, 2, 3, 4, 5);
        assertThat(cells).extracting(NotebookCell::cellType)
                .containsExactly("markdown", "code", "code", "code", "code", "code");
        assertThat(cells).extracting(NotebookCell::status)
                .containsExactly("completed", "completed", "completed", "completed", "running", "pending");
        assertThat(cells.get(0).source()).isEqualTo("# 용접 비드 학습\n본문");
        assertThat(cells.get(0).outputs()).isEmpty();
        assertThat(cells.get(0).executionCount()).isNull();
        assertThat(cells.get(1).tags()).containsExactly("parameters");
        assertThat(cells.get(2).tags()).containsExactly("injected-parameters");
        assertThat(cells.get(2).source()).isEqualTo("# Parameters\nepochs = 1\n");
        assertThat(cells.get(3).executionCount()).isEqualTo(3);
        assertThat(cells.get(4).executionCount()).isNull();
    }

    @Test
    void convertsOutputsAndStripsAnsi() throws Exception {
        List<NotebookCell> cells = reader.read(fixture("running.ipynb")).orElseThrow();

        assertThat(cells.get(3).outputs()).containsExactly(
                CellOutput.stream("stdout", "dataset ready: /data/data.yaml\n"),
                CellOutput.text("0.4123"),
                CellOutput.image("iVBORw0KGgo="));
        assertThat(cells.get(4).outputs()).containsExactly(
                CellOutput.stream("stderr", "epoch 1/3 · box_loss 1.234\n"));
    }

    @Test
    void skipsPapermillErrorCellsAndCleansTraceback() throws Exception {
        List<NotebookCell> cells = reader.read(fixture("failed.ipynb")).orElseThrow();

        assertThat(cells).extracting(NotebookCell::index).containsExactly(0, 1, 2);
        assertThat(cells).extracting(NotebookCell::status).containsExactly("completed", "failed", "pending");
        assertThat(cells.get(1).outputs()).containsExactly(CellOutput.error(
                "ValueError",
                "epochs는 1 이상이어야 합니다",
                List.of(
                        "ValueError Traceback (most recent call last)",
                        "----> 2 raise ValueError(\"epochs는 1 이상이어야 합니다\")")));
    }

    @Test
    void returnsEmptyForPartiallyWrittenFile() throws Exception {
        assertThat(reader.read(fixture("partial.ipynb"))).isEmpty();
    }

    @Test
    void returnsEmptyForMissingFile(@TempDir Path dir) {
        assertThat(reader.read(dir.resolve("executed.ipynb"))).isEmpty();
    }
}
```

- [ ] **Step 3: 실패 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests NotebookSnapshotReaderTest
```

Expected: FAIL — `cannot find symbol` (`NotebookSnapshotReader`, `NotebookCell`, `CellOutput`).

- [ ] **Step 4: 구현**

`main/notebook/CellOutput.java`:

```java
package com.prizm.backend.notebook;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CellOutput(
        String type,
        String name,
        String text,
        String imagePng,
        String ename,
        String evalue,
        List<String> traceback) {

    public static CellOutput stream(String name, String text) {
        return new CellOutput("stream", name, text, null, null, null, null);
    }

    public static CellOutput text(String text) {
        return new CellOutput("text", null, text, null, null, null, null);
    }

    public static CellOutput image(String imagePng) {
        return new CellOutput("image", null, null, imagePng, null, null, null);
    }

    public static CellOutput error(String ename, String evalue, List<String> traceback) {
        return new CellOutput("error", null, null, null, ename, evalue, List.copyOf(traceback));
    }
}
```

`main/notebook/NotebookCell.java`:

```java
package com.prizm.backend.notebook;

import java.util.List;

public record NotebookCell(
        int index,
        String cellType,
        String source,
        Integer executionCount,
        String status,
        List<String> tags,
        List<CellOutput> outputs) {
}
```

`main/notebook/NotebookSnapshotReader.java`:

```java
package com.prizm.backend.notebook;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** papermill이 저장하는 executed.ipynb를 화면용 셀 목록으로 바꾼다. */
@Component
public class NotebookSnapshotReader {

    static final String ERROR_CELL_TAG = "papermill-error-cell-tag";
    private static final Pattern ANSI = Pattern.compile("\\[[0-9;]*[A-Za-z]");

    private final JsonMapper mapper;

    public NotebookSnapshotReader(JsonMapper mapper) {
        this.mapper = mapper;
    }

    /** 파일이 없거나 papermill이 쓰는 도중이라 JSON이 불완전하면 빈 값을 돌려준다. */
    public Optional<List<NotebookCell>> read(Path path) {
        if (!Files.isRegularFile(path)) {
            return Optional.empty();
        }
        try {
            return Optional.of(parse(mapper.readTree(Files.readString(path))));
        } catch (IOException | JacksonException e) {
            return Optional.empty();
        }
    }

    private List<NotebookCell> parse(JsonNode root) {
        List<NotebookCell> cells = new ArrayList<>();
        for (JsonNode cell : root.path("cells")) {
            List<String> tags = strings(cell.path("metadata").path("tags"));
            if (tags.contains(ERROR_CELL_TAG)) {
                continue;
            }
            String cellType = string(cell.path("cell_type"), "code");
            boolean code = "code".equals(cellType);
            JsonNode count = cell.path("execution_count");
            cells.add(new NotebookCell(
                    cells.size(),
                    cellType,
                    joined(cell.path("source")),
                    code && count.isIntegralNumber() ? Integer.valueOf(count.asInt()) : null,
                    code ? string(cell.path("metadata").path("papermill").path("status"), "pending") : "completed",
                    tags,
                    code ? outputs(cell.path("outputs")) : List.of()));
        }
        return List.copyOf(cells);
    }

    private List<CellOutput> outputs(JsonNode outputs) {
        List<CellOutput> result = new ArrayList<>();
        for (JsonNode output : outputs) {
            switch (string(output.path("output_type"), "")) {
                case "stream" -> result.add(CellOutput.stream(
                        string(output.path("name"), "stdout"), stripAnsi(joined(output.path("text")))));
                case "execute_result", "display_data" -> {
                    JsonNode data = output.path("data");
                    if (data.has("image/png")) {
                        result.add(CellOutput.image(joined(data.path("image/png")).replaceAll("\\s", "")));
                    } else if (data.has("text/plain")) {
                        result.add(CellOutput.text(stripAnsi(joined(data.path("text/plain")))));
                    }
                }
                case "error" -> result.add(CellOutput.error(
                        string(output.path("ename"), ""),
                        stripAnsi(string(output.path("evalue"), "")),
                        strings(output.path("traceback")).stream().map(NotebookSnapshotReader::stripAnsi).toList()));
                default -> {
                    // 알 수 없는 출력 형식은 무시한다
                }
            }
        }
        return List.copyOf(result);
    }

    private static String string(JsonNode node, String fallback) {
        return node.isString() ? node.stringValue() : fallback;
    }

    /** nbformat은 문자열 또는 문자열 배열을 모두 허용한다. */
    private static String joined(JsonNode node) {
        if (node.isString()) {
            return node.stringValue();
        }
        StringBuilder builder = new StringBuilder();
        for (JsonNode part : node) {
            if (part.isString()) {
                builder.append(part.stringValue());
            }
        }
        return builder.toString();
    }

    private static List<String> strings(JsonNode node) {
        List<String> values = new ArrayList<>();
        for (JsonNode value : node) {
            if (value.isString()) {
                values.add(value.stringValue());
            }
        }
        return List.copyOf(values);
    }

    static String stripAnsi(String value) {
        return ANSI.matcher(value).replaceAll("");
    }
}
```

- [ ] **Step 5: 통과 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests NotebookSnapshotReaderTest
```

Expected: PASS (5 tests)

- [ ] **Step 6: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "feat: papermill executed.ipynb 스냅샷 파서"
```

---

### Task 7: Airflow REST 클라이언트

**Files:**
- Create: `main/config/HttpClientConfig.java`, `main/airflow/AirflowTaskState.java`, `main/airflow/AirflowClient.java`
- Test: `test/airflow/AirflowTaskStateTest.java`, `test/airflow/AirflowClientTest.java`

**Interfaces:**
- Consumes: `PrizmProperties.Airflow`, `TestFixtures.properties(Path)`
- Produces:
  - `HttpClientConfig` — 빈 `RestClient airflowRestClient`, `RestClient mlflowRestClient`; 정적 `RestClient.Builder airflowBuilder(PrizmProperties.Airflow)`, `RestClient.Builder mlflowBuilder(PrizmProperties.Mlflow)`
  - `record AirflowTaskState(String dagRunState, Map<String, String> taskStates)` — 상수 `PREFLIGHT_CHECK`, `DOWNLOAD_NOTEBOOK`, `EXECUTE_NOTEBOOK`, `TASK_ORDER`; `String task(String taskId)`(없거나 null이면 `"none"`), `boolean hasStarted(String taskId)`(`none`·`scheduled`·`queued`·`upstream_failed`·`skipped`·`removed`가 아니면 true), `Optional<String> failedTask()`(DAG 순서상 첫 `failed`/`upstream_failed`), `boolean isFailed()`(dagRun `failed` 또는 실패 태스크 존재)
  - `AirflowClient` — `void triggerDagRun(String dagRunId, Map<String, Object> conf)`, `AirflowTaskState fetchState(String dagRunId)`, `List<String> fetchLogTail(String dagRunId, String taskId, int maxLines)`(try 1, UTF-8). 실패 시 Spring `RestClientException` 계열을 그대로 던진다. 테스트용 생성자 `AirflowClient(RestClient, String dagId)`(패키지 전용).

- [ ] **Step 1: 실패하는 테스트 작성**

`test/airflow/AirflowTaskStateTest.java`:

```java
package com.prizm.backend.airflow;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AirflowTaskStateTest {

    @Test
    void treatsMissingAndQueuedTasksAsNotStarted() {
        Map<String, String> tasks = new HashMap<>();
        tasks.put("preflight_check", "success");
        tasks.put("download_notebook", "queued");
        AirflowTaskState state = new AirflowTaskState("running", tasks);

        assertThat(state.hasStarted("preflight_check")).isTrue();
        assertThat(state.hasStarted("download_notebook")).isFalse();
        assertThat(state.task("execute_notebook")).isEqualTo("none");
        assertThat(state.hasStarted("execute_notebook")).isFalse();
        assertThat(state.isFailed()).isFalse();
    }

    @Test
    void findsFirstFailedTaskInDagOrder() {
        AirflowTaskState state = new AirflowTaskState("failed", Map.of(
                "preflight_check", "success",
                "download_notebook", "failed",
                "execute_notebook", "upstream_failed"));

        assertThat(state.failedTask()).contains("download_notebook");
        assertThat(state.isFailed()).isTrue();
        assertThat(state.hasStarted("download_notebook")).isTrue();
        assertThat(state.hasStarted("execute_notebook")).isFalse();
    }

    @Test
    void failedDagRunWithoutFailedTaskIsFailed() {
        AirflowTaskState state = new AirflowTaskState("failed", Map.of());

        assertThat(state.failedTask()).isEmpty();
        assertThat(state.isFailed()).isTrue();
    }
}
```

`test/airflow/AirflowClientTest.java`:

```java
package com.prizm.backend.airflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.prizm.backend.TestFixtures;
import com.prizm.backend.config.HttpClientConfig;
import com.prizm.backend.config.PrizmProperties;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

class AirflowClientTest {

    private static final String DAG_RUNS = "http://airflow.test/api/v1/dags/mlops_notebook_executor/dagRuns";

    private MockRestServiceServer server;
    private AirflowClient client;

    @BeforeEach
    void setUp() {
        PrizmProperties.Airflow airflow = TestFixtures.properties(null).airflow();
        RestClient.Builder builder = HttpClientConfig.airflowBuilder(airflow);
        server = MockRestServiceServer.bindTo(builder).build();
        client = new AirflowClient(builder.build(), airflow.dagId());
    }

    @Test
    void triggersDagRunWithBasicAuthAndConf() {
        server.expect(requestTo(DAG_RUNS))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Basic YWRtaW46YWRtaW4="))
                .andExpect(content().json("""
                        {"dag_run_id": "prizm_RUN-27000",
                         "conf": {"code_key": "demo.door_defect_yolov8_training", "code_version": "v2",
                                  "prizm_run_id": "RUN-27000",
                                  "extra_params": {"epochs": 3, "batch": 4, "imgsz": 320, "seed": 42}}}
                        """, JsonCompareMode.STRICT))
                .andRespond(withSuccess("{\"dag_run_id\":\"prizm_RUN-27000\",\"state\":\"queued\"}", MediaType.APPLICATION_JSON));

        client.triggerDagRun("prizm_RUN-27000", Map.of(
                "code_key", "demo.door_defect_yolov8_training",
                "code_version", "v2",
                "prizm_run_id", "RUN-27000",
                "extra_params", Map.of("epochs", 3, "batch", 4, "imgsz", 320, "seed", 42)));

        server.verify();
    }

    @Test
    void fetchesDagRunAndTaskStates() {
        server.expect(requestTo(DAG_RUNS + "/prizm_RUN-27000"))
                .andExpect(header("Authorization", "Basic YWRtaW46YWRtaW4="))
                .andRespond(withSuccess("{\"dag_run_id\":\"prizm_RUN-27000\",\"state\":\"running\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(DAG_RUNS + "/prizm_RUN-27000/taskInstances"))
                .andRespond(withSuccess("""
                        {"task_instances": [
                          {"task_id": "preflight_check", "state": "success"},
                          {"task_id": "download_notebook", "state": "running"},
                          {"task_id": "execute_notebook", "state": null}
                        ], "total_entries": 3}
                        """, MediaType.APPLICATION_JSON));

        AirflowTaskState state = client.fetchState("prizm_RUN-27000");

        assertThat(state.dagRunState()).isEqualTo("running");
        assertThat(state.task("preflight_check")).isEqualTo("success");
        assertThat(state.task("download_notebook")).isEqualTo("running");
        assertThat(state.task("execute_notebook")).isEqualTo("none");
        server.verify();
    }

    @Test
    void fetchesLastLogLinesAsUtf8Text() {
        server.expect(requestTo(DAG_RUNS + "/prizm_RUN-27000/taskInstances/execute_notebook/logs/1"))
                .andExpect(header("Accept", MediaType.TEXT_PLAIN_VALUE))
                .andRespond(withSuccess("line1\nline2\n\nValueError: epochs는 1 이상이어야 합니다\n", MediaType.TEXT_PLAIN));

        List<String> lines = client.fetchLogTail("prizm_RUN-27000", "execute_notebook", 2);

        assertThat(lines).containsExactly("", "ValueError: epochs는 1 이상이어야 합니다");
        server.verify();
    }

    @Test
    void propagatesConnectionFailure() {
        server.expect(requestTo(DAG_RUNS)).andRespond(withException(new IOException("Connection refused")));

        assertThatThrownBy(() -> client.triggerDagRun("prizm_RUN-27000", Map.of()))
                .isInstanceOf(ResourceAccessException.class);
    }

    @Test
    void propagatesServerError() {
        server.expect(requestTo(DAG_RUNS + "/prizm_RUN-27000")).andRespond(withServerError());

        assertThatThrownBy(() -> client.fetchState("prizm_RUN-27000"))
                .isInstanceOf(HttpServerErrorException.class);
    }
}
```

- [ ] **Step 2: 실패 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests 'com.prizm.backend.airflow.*'
```

Expected: FAIL — `cannot find symbol` (`AirflowClient`, `AirflowTaskState`, `HttpClientConfig`).

- [ ] **Step 3: 구현**

`main/config/HttpClientConfig.java`:

```java
package com.prizm.backend.config;

import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Boot 4의 spring-boot-starter-webmvc에는 RestClient.Builder 자동 구성이 없으므로 직접 만든다.
 * 테스트는 정적 builder 메서드에 MockRestServiceServer를 연결한다.
 */
@Configuration
public class HttpClientConfig {

    @Bean
    RestClient airflowRestClient(PrizmProperties properties) {
        return airflowBuilder(properties.airflow()).build();
    }

    @Bean
    RestClient mlflowRestClient(PrizmProperties properties) {
        return mlflowBuilder(properties.mlflow()).build();
    }

    public static RestClient.Builder airflowBuilder(PrizmProperties.Airflow airflow) {
        return RestClient.builder()
                .requestFactory(requestFactory())
                .baseUrl(airflow.baseUrl())
                .defaultHeaders(headers -> headers.setBasicAuth(airflow.username(), airflow.password()));
    }

    public static RestClient.Builder mlflowBuilder(PrizmProperties.Mlflow mlflow) {
        return RestClient.builder()
                .requestFactory(requestFactory())
                .baseUrl(mlflow.baseUrl());
    }

    private static SimpleClientHttpRequestFactory requestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(15));
        return factory;
    }
}
```

`main/airflow/AirflowTaskState.java`:

```java
package com.prizm.backend.airflow;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public record AirflowTaskState(String dagRunState, Map<String, String> taskStates) {

    public static final String PREFLIGHT_CHECK = "preflight_check";
    public static final String DOWNLOAD_NOTEBOOK = "download_notebook";
    public static final String EXECUTE_NOTEBOOK = "execute_notebook";
    public static final List<String> TASK_ORDER = List.of(PREFLIGHT_CHECK, DOWNLOAD_NOTEBOOK, EXECUTE_NOTEBOOK);

    /** upstream_failed·skipped·removed는 태스크가 실제로 실행되지 않았다는 뜻이다. */
    private static final Set<String> NOT_STARTED = Set.of("none", "scheduled", "queued", "upstream_failed", "skipped", "removed");
    private static final Set<String> FAILED = Set.of("failed", "upstream_failed");

    public String task(String taskId) {
        String state = taskStates.get(taskId);
        return state == null ? "none" : state;
    }

    public boolean hasStarted(String taskId) {
        return !NOT_STARTED.contains(task(taskId));
    }

    public Optional<String> failedTask() {
        return TASK_ORDER.stream().filter(taskId -> FAILED.contains(task(taskId))).findFirst();
    }

    public boolean isFailed() {
        return "failed".equals(dagRunState) || failedTask().isPresent();
    }
}
```

`main/airflow/AirflowClient.java`:

```java
package com.prizm.backend.airflow;

import com.prizm.backend.config.PrizmProperties;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

@Component
public class AirflowClient {

    private final RestClient restClient;
    private final String dagId;

    @Autowired
    public AirflowClient(@Qualifier("airflowRestClient") RestClient restClient, PrizmProperties properties) {
        this(restClient, properties.airflow().dagId());
    }

    AirflowClient(RestClient restClient, String dagId) {
        this.restClient = restClient;
        this.dagId = dagId;
    }

    public void triggerDagRun(String dagRunId, Map<String, Object> conf) {
        restClient.post()
                .uri("/api/v1/dags/{dagId}/dagRuns", dagId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("dag_run_id", dagRunId, "conf", conf))
                .retrieve()
                .toBodilessEntity();
    }

    public AirflowTaskState fetchState(String dagRunId) {
        JsonNode dagRun = restClient.get()
                .uri("/api/v1/dags/{dagId}/dagRuns/{dagRunId}", dagId, dagRunId)
                .retrieve()
                .body(JsonNode.class);
        JsonNode instances = restClient.get()
                .uri("/api/v1/dags/{dagId}/dagRuns/{dagRunId}/taskInstances", dagId, dagRunId)
                .retrieve()
                .body(JsonNode.class);

        Map<String, String> states = new HashMap<>();
        for (JsonNode instance : instances.path("task_instances")) {
            JsonNode taskId = instance.path("task_id");
            JsonNode state = instance.path("state");
            if (taskId.isString()) {
                states.put(taskId.stringValue(), state.isString() ? state.stringValue() : "none");
            }
        }
        JsonNode dagRunState = dagRun.path("state");
        return new AirflowTaskState(dagRunState.isString() ? dagRunState.stringValue() : "none", Map.copyOf(states));
    }

    public List<String> fetchLogTail(String dagRunId, String taskId, int maxLines) {
        byte[] body = restClient.get()
                .uri("/api/v1/dags/{dagId}/dagRuns/{dagRunId}/taskInstances/{taskId}/logs/{tryNumber}",
                        dagId, dagRunId, taskId, 1)
                .accept(MediaType.TEXT_PLAIN)
                .retrieve()
                .body(byte[].class);
        if (body == null) {
            return List.of();
        }
        List<String> lines = new String(body, StandardCharsets.UTF_8).lines().toList();
        return List.copyOf(lines.subList(Math.max(0, lines.size() - maxLines), lines.size()));
    }
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests 'com.prizm.backend.airflow.*'
```

Expected: PASS (8 tests). `header("Accept", …)` 불일치로만 실패하면, 실패 메시지의 실제 값을 확인하고 기대값을 `org.hamcrest.Matchers.containsString(MediaType.TEXT_PLAIN_VALUE)` 매처로 바꾼다.

- [ ] **Step 5: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "feat: Airflow REST 클라이언트(트리거·상태·로그)"
```

---

### Task 8: MLflow 결과 조회 클라이언트

**Files:**
- Create: `main/mlflow/MlflowRunResult.java`, `main/mlflow/MlflowClient.java`
- Test: `test/mlflow/MlflowClientTest.java`

**Interfaces:**
- Consumes: `HttpClientConfig.mlflowBuilder(PrizmProperties.Mlflow)` (Task 7)
- Produces:
  - `record MlflowRunResult(String runId, Double map50, String registeredModelName, String registeredModelVersion)` — 모델 버전이 아직 없으면 마지막 두 필드 null
  - `MlflowClient` — `Optional<MlflowRunResult> findResult(String prizmRunId)`: 실험 없음(404)·run 없음이면 empty. 그 외 오류는 `RestClientException` 전파. 테스트용 생성자 `MlflowClient(RestClient, String experimentName)`(패키지 전용).

- [ ] **Step 1: 실패하는 테스트 작성**

`test/mlflow/MlflowClientTest.java`:

```java
package com.prizm.backend.mlflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.prizm.backend.TestFixtures;
import com.prizm.backend.config.HttpClientConfig;
import com.prizm.backend.config.PrizmProperties;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.client.RequestMatcher;
import org.springframework.web.client.RestClient;

class MlflowClientTest {

    private static final String BASE = "http://mlflow.test/api/2.0/mlflow";

    private MockRestServiceServer server;
    private MlflowClient client;

    @BeforeEach
    void setUp() {
        PrizmProperties.Mlflow mlflow = TestFixtures.properties(null).mlflow();
        RestClient.Builder builder = HttpClientConfig.mlflowBuilder(mlflow);
        server = MockRestServiceServer.bindTo(builder).build();
        client = new MlflowClient(builder.build(), mlflow.experimentName());
    }

    private void expectExperiment() {
        server.expect(requestTo(startsWith(BASE + "/experiments/get-by-name")))
                .andExpect(queryParam("experiment_name", "prizm-weld-training"))
                .andRespond(withSuccess("{\"experiment\":{\"experiment_id\":\"7\",\"name\":\"prizm-weld-training\"}}", MediaType.APPLICATION_JSON));
    }

    private void expectRunSearch(String responseJson) {
        server.expect(requestTo(BASE + "/runs/search"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().json("""
                        {"experiment_ids": ["7"], "filter": "tags.prizm_run_id = 'RUN-27000'", "max_results": 1}
                        """, JsonCompareMode.STRICT))
                .andRespond(withSuccess(responseJson, MediaType.APPLICATION_JSON));
    }

    /** RestClient의 URI 인코딩 방식(= 인코딩 여부)에 흔들리지 않도록 디코딩 후 비교한다. */
    private static RequestMatcher decodedQuery(String expected) {
        return request -> assertThat(URLDecoder.decode(request.getURI().getRawQuery(), StandardCharsets.UTF_8))
                .isEqualTo(expected);
    }

    @Test
    void findsMetricAndRegisteredModelVersion() {
        expectExperiment();
        expectRunSearch("""
                {"runs": [{"info": {"run_id": "abc123"},
                           "data": {"metrics": [{"key": "loss", "value": 0.2}, {"key": "mAP50", "value": 0.4123}]}}]}
                """);
        server.expect(requestTo(startsWith(BASE + "/model-versions/search")))
                .andExpect(decodedQuery("filter=run_id='abc123'"))
                .andRespond(withSuccess("{\"model_versions\":[{\"name\":\"weld-bead-defect-detector\",\"version\":\"3\"}]}", MediaType.APPLICATION_JSON));

        assertThat(client.findResult("RUN-27000"))
                .contains(new MlflowRunResult("abc123", 0.4123, "weld-bead-defect-detector", "3"));
        server.verify();
    }

    @Test
    void returnsRunWithoutVersionWhenNotRegistered() {
        expectExperiment();
        expectRunSearch("{\"runs\":[{\"info\":{\"run_id\":\"abc123\"},\"data\":{}}]}");
        server.expect(requestTo(startsWith(BASE + "/model-versions/search")))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        assertThat(client.findResult("RUN-27000")).contains(new MlflowRunResult("abc123", null, null, null));
        server.verify();
    }

    @Test
    void returnsEmptyWhenRunNotFound() {
        expectExperiment();
        expectRunSearch("{}");

        assertThat(client.findResult("RUN-27000")).isEmpty();
        server.verify();
    }

    @Test
    void returnsEmptyWhenExperimentMissing() {
        server.expect(requestTo(startsWith(BASE + "/experiments/get-by-name")))
                .andRespond(withStatus(HttpStatus.NOT_FOUND)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error_code\":\"RESOURCE_DOES_NOT_EXIST\"}"));

        assertThat(client.findResult("RUN-27000")).isEmpty();
        server.verify();
    }
}
```

- [ ] **Step 2: 실패 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests MlflowClientTest
```

Expected: FAIL — `cannot find symbol` (`MlflowClient`, `MlflowRunResult`).

- [ ] **Step 3: 구현**

`main/mlflow/MlflowRunResult.java`:

```java
package com.prizm.backend.mlflow;

public record MlflowRunResult(String runId, Double map50, String registeredModelName, String registeredModelVersion) {
}
```

`main/mlflow/MlflowClient.java`:

```java
package com.prizm.backend.mlflow;

import com.prizm.backend.config.PrizmProperties;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

@Component
public class MlflowClient {

    private final RestClient restClient;
    private final String experimentName;

    @Autowired
    public MlflowClient(@Qualifier("mlflowRestClient") RestClient restClient, PrizmProperties properties) {
        this(restClient, properties.mlflow().experimentName());
    }

    MlflowClient(RestClient restClient, String experimentName) {
        this.restClient = restClient;
        this.experimentName = experimentName;
    }

    /** 노트북이 prizm_run_id 태그로 남긴 run과, 그 run으로 등록된 모델 버전을 찾는다. */
    public Optional<MlflowRunResult> findResult(String prizmRunId) {
        Optional<String> experimentId = experimentId();
        if (experimentId.isEmpty()) {
            return Optional.empty();
        }
        JsonNode search = restClient.post()
                .uri("/api/2.0/mlflow/runs/search")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "experiment_ids", List.of(experimentId.get()),
                        "filter", "tags.prizm_run_id = '" + prizmRunId + "'",
                        "max_results", 1))
                .retrieve()
                .body(JsonNode.class);
        JsonNode runs = search.path("runs");
        if (!runs.isArray() || runs.size() == 0) {
            return Optional.empty();
        }
        JsonNode run = runs.get(0);
        JsonNode runIdNode = run.path("info").path("run_id");
        if (!runIdNode.isString()) {
            return Optional.empty();
        }
        String runId = runIdNode.stringValue();

        Double map50 = null;
        for (JsonNode metric : run.path("data").path("metrics")) {
            JsonNode key = metric.path("key");
            if (key.isString() && "mAP50".equals(key.stringValue())) {
                map50 = metric.path("value").asDouble();
            }
        }

        JsonNode versions = restClient.get()
                .uri(builder -> builder.path("/api/2.0/mlflow/model-versions/search")
                        .queryParam("filter", "run_id='" + runId + "'")
                        .build())
                .retrieve()
                .body(JsonNode.class);
        JsonNode modelVersions = versions.path("model_versions");
        if (modelVersions.isArray() && modelVersions.size() > 0) {
            JsonNode name = modelVersions.get(0).path("name");
            JsonNode version = modelVersions.get(0).path("version");
            return Optional.of(new MlflowRunResult(runId, map50,
                    name.isString() ? name.stringValue() : null,
                    version.isString() ? version.stringValue() : null));
        }
        return Optional.of(new MlflowRunResult(runId, map50, null, null));
    }

    private Optional<String> experimentId() {
        try {
            JsonNode response = restClient.get()
                    .uri(builder -> builder.path("/api/2.0/mlflow/experiments/get-by-name")
                            .queryParam("experiment_name", experimentName)
                            .build())
                    .retrieve()
                    .body(JsonNode.class);
            JsonNode id = response.path("experiment").path("experiment_id");
            return id.isString() ? Optional.of(id.stringValue()) : Optional.empty();
        } catch (HttpClientErrorException.NotFound e) {
            return Optional.empty();
        }
    }
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests MlflowClientTest
```

Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "feat: MLflow run·모델 버전 조회 클라이언트"
```

---

### Task 9: 실행 도메인, ID 발급, 실행 생성 서비스

**Files:**
- Create: `main/api/RunNotFoundException.java`, `main/api/RunTriggerException.java`
- Create: `main/run/RunStatus.java`, `main/run/RunStage.java`, `main/run/Run.java`, `main/run/RunRepository.java`, `main/run/RunIdGenerator.java`, `main/run/CreateRunRequest.java`, `main/run/RunResponse.java`, `main/run/RunService.java`
- Modify: `test/PrizmBackendApplicationTests.java` (ID 발급 테스트 추가)
- Test: `test/run/RunServiceTest.java`

**Interfaces:**
- Consumes: `CodeAssetCatalog`, `InvalidRunRequestException`(Task 5), `AirflowClient`(Task 7), `MlflowRunResult`(Task 8), `TestFixtures`
- Produces:
  - `enum RunStatus { QUEUED, RUNNING, SUCCEEDED, FAILED; boolean isFinished() }`, `enum RunStage { PREPARING, DATA, TRAINING, REGISTERING, DONE }`
  - `Run` 엔티티(테이블 `prizm_run`) — `static Run queued(String id, CodeAssetProperties asset, String parametersJson, String resource, String environment, String requestedBy, Instant requestedAt)`(dagRunId `prizm_{id}`, QUEUED/PREPARING/0), `void applyProgress(RunStatus, RunStage, int progress, Instant now)`(첫 비-QUEUED 시 `startedAt`, 종료 상태 시 `finishedAt`), `void updateCellCounts(int executedCells, int totalCells)`, `void markFailed(String errorMessage, Instant now)`, `void markSucceeded(Instant now)`(SUCCEEDED/DONE/100), `void applyResult(MlflowRunResult)`, `int incrementResultLookupAttempts()`, `void setErrorMessage(String)`(2000자 초과 시 자름), 모든 필드 getter
  - `RunRepository` — `findByStatusIn(Collection<RunStatus>)`, `findByAssetIdOrderByRequestedAtDesc(String)`, `findAllByOrderByRequestedAtDesc()`
  - `RunIdGenerator(JdbcTemplate)` — `String nextId()` → `RUN-27000`, `RUN-27001`, …
  - `record CreateRunRequest(@NotBlank String assetId, @NotBlank String version, @NotNull Map<String, Object> parameters, String resource, String environment)`
  - `record RunResponse(...)` — 설계 4.3 JSON의 23개 필드를 같은 순서로, `static RunResponse from(Run run, JsonMapper mapper)`
  - `RunService` — `RunResponse create(CreateRunRequest)`, `List<RunResponse> list(String assetIdOrNull)`, `RunResponse get(String id)`, `Run getEntity(String id)`(없으면 `RunNotFoundException`), `RunResponse toResponse(Run)`
  - `RunNotFoundException(String runId)` 메시지 `"실행을 찾을 수 없습니다: {runId}"`, `RunTriggerException(String message)`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/run/RunServiceTest.java`:

```java
package com.prizm.backend.run;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.prizm.backend.TestFixtures;
import com.prizm.backend.airflow.AirflowClient;
import com.prizm.backend.api.InvalidRunRequestException;
import com.prizm.backend.api.RunNotFoundException;
import com.prizm.backend.api.RunTriggerException;
import com.prizm.backend.asset.CodeAssetCatalog;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.ResourceAccessException;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(MockitoExtension.class)
class RunServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-17T14:02:11Z");

    @Mock
    private RunRepository repository;
    @Mock
    private RunIdGenerator idGenerator;
    @Mock
    private AirflowClient airflow;

    private RunService service;

    @BeforeEach
    void setUp() {
        service = new RunService(repository, idGenerator, new CodeAssetCatalog(TestFixtures.properties(null)),
                airflow, JsonMapper.builder().build(), Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static CreateRunRequest request(String version) {
        return new CreateRunRequest("PRJ000212-C-0001", version, TestFixtures.validParameters(),
                "ml.a100.20gb", "pytorch-2.4-yolo12-py311-cu124");
    }

    @Test
    void createsQueuedRunAndTriggersDagWithMappedParameters() {
        when(idGenerator.nextId()).thenReturn("RUN-27000");
        when(repository.save(any(Run.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RunResponse response = service.create(request("v2.4.1"));

        assertThat(response.id()).isEqualTo("RUN-27000");
        assertThat(response.dagRunId()).isEqualTo("prizm_RUN-27000");
        assertThat(response.status()).isEqualTo(RunStatus.QUEUED);
        assertThat(response.stage()).isEqualTo(RunStage.PREPARING);
        assertThat(response.codeKey()).isEqualTo("demo.door_defect_yolov8_training");
        assertThat(response.codeVersion()).isEqualTo("v2");
        assertThat(response.parameters()).isEqualTo(TestFixtures.validParameters());
        assertThat(response.requestedBy()).isEqualTo("이학선");
        assertThat(response.resource()).isEqualTo("ml.a100.20gb");
        assertThat(response.requestedAt()).isEqualTo(NOW);
        verify(airflow).triggerDagRun(eq("prizm_RUN-27000"), eq(Map.of(
                "code_key", "demo.door_defect_yolov8_training",
                "code_version", "v2",
                "prizm_run_id", "RUN-27000",
                "extra_params", Map.of("epochs", 3, "batch", 4, "imgsz", 320, "seed", 42))));
    }

    @Test
    void savesFailedRunWhenTriggerFails() {
        when(idGenerator.nextId()).thenReturn("RUN-27000");
        when(repository.save(any(Run.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new ResourceAccessException("Connection refused")).when(airflow).triggerDagRun(anyString(), anyMap());

        assertThatThrownBy(() -> service.create(request("v2.4.1")))
                .isInstanceOf(RunTriggerException.class)
                .hasMessage("Airflow DAG 트리거 실패: Connection refused");

        ArgumentCaptor<Run> saved = ArgumentCaptor.forClass(Run.class);
        verify(repository, times(2)).save(saved.capture());
        Run run = saved.getValue();
        assertThat(run.getStatus()).isEqualTo(RunStatus.FAILED);
        assertThat(run.getErrorMessage()).isEqualTo("Airflow DAG 트리거 실패: Connection refused");
        assertThat(run.getFinishedAt()).isEqualTo(NOW);
    }

    @Test
    void rejectsUnknownAssetBeforeSavingOrTriggering() {
        assertThatThrownBy(() -> service.create(request("v9.9.9")))
                .isInstanceOf(InvalidRunRequestException.class);

        verifyNoInteractions(repository, idGenerator, airflow);
    }

    @Test
    void getThrowsNotFoundForUnknownRun() {
        when(repository.findById("RUN-1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get("RUN-1"))
                .isInstanceOf(RunNotFoundException.class)
                .hasMessage("실행을 찾을 수 없습니다: RUN-1");
    }

    @Test
    void listsRunsFilteredByAssetOrAll() {
        Run run = Run.queued("RUN-27000", TestFixtures.weldAsset(), "{\"epochs\":3}", "r", "e", "이학선", NOW);
        when(repository.findByAssetIdOrderByRequestedAtDesc("PRJ000212-C-0001")).thenReturn(List.of(run));
        when(repository.findAllByOrderByRequestedAtDesc()).thenReturn(List.of());

        assertThat(service.list("PRJ000212-C-0001")).extracting(RunResponse::id).containsExactly("RUN-27000");
        assertThat(service.list(null)).isEmpty();
    }
}
```

`test/PrizmBackendApplicationTests.java`에 import 한 줄, 필드, 테스트를 추가한다(기존 두 테스트는 유지).

```java
import com.prizm.backend.run.RunIdGenerator;
```

```java
    @Autowired
    private RunIdGenerator runIdGenerator;

    @Test
    void issuesSequentialRunIdsStartingAt27000() {
        assertThat(runIdGenerator.nextId()).isEqualTo("RUN-27000");
        assertThat(runIdGenerator.nextId()).isEqualTo("RUN-27001");
    }
```

- [ ] **Step 2: 실패 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests RunServiceTest --tests PrizmBackendApplicationTests
```

Expected: FAIL — `cannot find symbol` (`RunService`, `Run`, `RunIdGenerator` 등).

- [ ] **Step 3: 예외·열거형 구현**

`main/api/RunNotFoundException.java`:

```java
package com.prizm.backend.api;

/** 404 Not Found로 응답한다. */
public class RunNotFoundException extends RuntimeException {

    public RunNotFoundException(String runId) {
        super("실행을 찾을 수 없습니다: " + runId);
    }
}
```

`main/api/RunTriggerException.java`:

```java
package com.prizm.backend.api;

/** Airflow DAG 트리거 실패. 502 Bad Gateway로 응답한다. */
public class RunTriggerException extends RuntimeException {

    public RunTriggerException(String message) {
        super(message);
    }
}
```

`main/run/RunStatus.java`:

```java
package com.prizm.backend.run;

public enum RunStatus {
    QUEUED, RUNNING, SUCCEEDED, FAILED;

    public boolean isFinished() {
        return this == SUCCEEDED || this == FAILED;
    }
}
```

`main/run/RunStage.java`:

```java
package com.prizm.backend.run;

public enum RunStage {
    PREPARING, DATA, TRAINING, REGISTERING, DONE
}
```

- [ ] **Step 4: 엔티티·저장소·ID 발급 구현**

`main/run/Run.java`:

```java
package com.prizm.backend.run;

import com.prizm.backend.asset.CodeAssetProperties;
import com.prizm.backend.mlflow.MlflowRunResult;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "prizm_run")
public class Run {

    private static final int MESSAGE_LENGTH = 2000;

    @Id
    private String id;
    private String assetId;
    private String assetVersion;
    private String codeKey;
    private String codeVersion;
    @Column(length = MESSAGE_LENGTH)
    private String parameters;
    private String resource;
    private String environment;
    private String requestedBy;
    private String dagRunId;
    @Enumerated(EnumType.STRING)
    private RunStatus status;
    @Enumerated(EnumType.STRING)
    private RunStage stage;
    private int progress;
    private int executedCells;
    private int totalCells;
    private String mlflowRunId;
    private Double map50;
    private String registeredModelName;
    private String registeredModelVersion;
    private int resultLookupAttempts;
    @Column(length = MESSAGE_LENGTH)
    private String errorMessage;
    private Instant requestedAt;
    private Instant startedAt;
    private Instant finishedAt;

    protected Run() {
    }

    public static Run queued(String id, CodeAssetProperties asset, String parametersJson, String resource,
            String environment, String requestedBy, Instant requestedAt) {
        Run run = new Run();
        run.id = id;
        run.assetId = asset.assetId();
        run.assetVersion = asset.assetVersion();
        run.codeKey = asset.codeKey();
        run.codeVersion = asset.codeVersion();
        run.parameters = parametersJson;
        run.resource = resource;
        run.environment = environment;
        run.requestedBy = requestedBy;
        run.dagRunId = "prizm_" + id;
        run.status = RunStatus.QUEUED;
        run.stage = RunStage.PREPARING;
        run.progress = 0;
        run.requestedAt = requestedAt;
        return run;
    }

    public void applyProgress(RunStatus status, RunStage stage, int progress, Instant now) {
        this.status = status;
        this.stage = stage;
        this.progress = progress;
        if (startedAt == null && status != RunStatus.QUEUED) {
            startedAt = now;
        }
        if (status.isFinished() && finishedAt == null) {
            finishedAt = now;
        }
    }

    public void updateCellCounts(int executedCells, int totalCells) {
        this.executedCells = executedCells;
        this.totalCells = totalCells;
    }

    public void markFailed(String errorMessage, Instant now) {
        this.status = RunStatus.FAILED;
        setErrorMessage(errorMessage);
        if (finishedAt == null) {
            finishedAt = now;
        }
    }

    public void markSucceeded(Instant now) {
        this.status = RunStatus.SUCCEEDED;
        this.stage = RunStage.DONE;
        this.progress = 100;
        if (finishedAt == null) {
            finishedAt = now;
        }
    }

    public void applyResult(MlflowRunResult result) {
        this.mlflowRunId = result.runId();
        this.map50 = result.map50();
        this.registeredModelName = result.registeredModelName();
        this.registeredModelVersion = result.registeredModelVersion();
    }

    public int incrementResultLookupAttempts() {
        return ++resultLookupAttempts;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage == null || errorMessage.length() <= MESSAGE_LENGTH
                ? errorMessage
                : errorMessage.substring(0, MESSAGE_LENGTH - 3) + "...";
    }

    public String getId() { return id; }
    public String getAssetId() { return assetId; }
    public String getAssetVersion() { return assetVersion; }
    public String getCodeKey() { return codeKey; }
    public String getCodeVersion() { return codeVersion; }
    public String getParameters() { return parameters; }
    public String getResource() { return resource; }
    public String getEnvironment() { return environment; }
    public String getRequestedBy() { return requestedBy; }
    public String getDagRunId() { return dagRunId; }
    public RunStatus getStatus() { return status; }
    public RunStage getStage() { return stage; }
    public int getProgress() { return progress; }
    public int getExecutedCells() { return executedCells; }
    public int getTotalCells() { return totalCells; }
    public String getMlflowRunId() { return mlflowRunId; }
    public Double getMap50() { return map50; }
    public String getRegisteredModelName() { return registeredModelName; }
    public String getRegisteredModelVersion() { return registeredModelVersion; }
    public int getResultLookupAttempts() { return resultLookupAttempts; }
    public String getErrorMessage() { return errorMessage; }
    public Instant getRequestedAt() { return requestedAt; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
}
```

`main/run/RunRepository.java`:

```java
package com.prizm.backend.run;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RunRepository extends JpaRepository<Run, String> {

    List<Run> findByStatusIn(Collection<RunStatus> statuses);

    List<Run> findByAssetIdOrderByRequestedAtDesc(String assetId);

    List<Run> findAllByOrderByRequestedAtDesc();
}
```

`main/run/RunIdGenerator.java`:

```java
package com.prizm.backend.run;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** 문자열 PK "RUN-27000" 형식을 H2 시퀀스로 발급한다. */
@Component
public class RunIdGenerator {

    private final JdbcTemplate jdbcTemplate;

    public RunIdGenerator(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        jdbcTemplate.execute("CREATE SEQUENCE IF NOT EXISTS run_id_seq START WITH 27000");
    }

    public String nextId() {
        Long next = jdbcTemplate.queryForObject("SELECT NEXT VALUE FOR run_id_seq", Long.class);
        return "RUN-" + next;
    }
}
```

- [ ] **Step 5: 요청·응답·서비스 구현**

`main/run/CreateRunRequest.java`:

```java
package com.prizm.backend.run;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record CreateRunRequest(
        @NotBlank String assetId,
        @NotBlank String version,
        @NotNull Map<String, Object> parameters,
        String resource,
        String environment) {
}
```

`main/run/RunResponse.java`:

```java
package com.prizm.backend.run;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

public record RunResponse(
        String id,
        String assetId,
        String assetVersion,
        String codeKey,
        String codeVersion,
        Map<String, Object> parameters,
        String resource,
        String environment,
        String requestedBy,
        String dagRunId,
        RunStatus status,
        RunStage stage,
        int progress,
        int executedCells,
        int totalCells,
        String mlflowRunId,
        Double map50,
        String registeredModelName,
        String registeredModelVersion,
        String errorMessage,
        Instant requestedAt,
        Instant startedAt,
        Instant finishedAt) {

    private static final TypeReference<LinkedHashMap<String, Object>> PARAMETERS = new TypeReference<>() {
    };

    public static RunResponse from(Run run, JsonMapper mapper) {
        return new RunResponse(
                run.getId(), run.getAssetId(), run.getAssetVersion(), run.getCodeKey(), run.getCodeVersion(),
                mapper.readValue(run.getParameters(), PARAMETERS),
                run.getResource(), run.getEnvironment(), run.getRequestedBy(), run.getDagRunId(),
                run.getStatus(), run.getStage(), run.getProgress(), run.getExecutedCells(), run.getTotalCells(),
                run.getMlflowRunId(), run.getMap50(), run.getRegisteredModelName(), run.getRegisteredModelVersion(),
                run.getErrorMessage(), run.getRequestedAt(), run.getStartedAt(), run.getFinishedAt());
    }
}
```

`main/run/RunService.java`:

```java
package com.prizm.backend.run;

import com.prizm.backend.airflow.AirflowClient;
import com.prizm.backend.api.RunNotFoundException;
import com.prizm.backend.api.RunTriggerException;
import com.prizm.backend.asset.CodeAssetCatalog;
import com.prizm.backend.asset.CodeAssetProperties;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.json.JsonMapper;

@Service
public class RunService {

    static final String REQUESTED_BY = "이학선";

    private final RunRepository repository;
    private final RunIdGenerator idGenerator;
    private final CodeAssetCatalog catalog;
    private final AirflowClient airflow;
    private final JsonMapper mapper;
    private final Clock clock;

    public RunService(RunRepository repository, RunIdGenerator idGenerator, CodeAssetCatalog catalog,
            AirflowClient airflow, JsonMapper mapper, Clock clock) {
        this.repository = repository;
        this.idGenerator = idGenerator;
        this.catalog = catalog;
        this.airflow = airflow;
        this.mapper = mapper;
        this.clock = clock;
    }

    public RunResponse create(CreateRunRequest request) {
        CodeAssetProperties asset = catalog.find(request.assetId(), request.version());
        Map<String, Object> notebookParameters = catalog.toNotebookParameters(asset, request.parameters());

        Run run = Run.queued(idGenerator.nextId(), asset, mapper.writeValueAsString(request.parameters()),
                request.resource(), request.environment(), REQUESTED_BY, clock.instant());
        repository.save(run);

        Map<String, Object> conf = new LinkedHashMap<>();
        conf.put("code_key", asset.codeKey());
        conf.put("code_version", asset.codeVersion());
        conf.put("prizm_run_id", run.getId());
        conf.put("extra_params", notebookParameters);
        try {
            airflow.triggerDagRun(run.getDagRunId(), conf);
        } catch (RestClientException e) {
            run.markFailed("Airflow DAG 트리거 실패: " + e.getMessage(), clock.instant());
            repository.save(run);
            throw new RunTriggerException(run.getErrorMessage());
        }
        return toResponse(run);
    }

    public List<RunResponse> list(String assetId) {
        List<Run> runs = assetId == null || assetId.isBlank()
                ? repository.findAllByOrderByRequestedAtDesc()
                : repository.findByAssetIdOrderByRequestedAtDesc(assetId);
        return runs.stream().map(this::toResponse).toList();
    }

    public RunResponse get(String id) {
        return toResponse(getEntity(id));
    }

    public Run getEntity(String id) {
        return repository.findById(id).orElseThrow(() -> new RunNotFoundException(id));
    }

    public RunResponse toResponse(Run run) {
        return RunResponse.from(run, mapper);
    }
}
```

- [ ] **Step 6: 통과 확인 (전체 테스트)**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test
```

Expected: PASS — Task 4~9 누적 테스트 전부. `issuesSequentialRunIdsStartingAt27000`만 실패하면 H2(2.4.240) 오류 메시지에서 시퀀스 문법을 확인한다.

- [ ] **Step 7: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "feat: 실행 엔티티·ID 발급·실행 생성 서비스(Airflow 트리거)"
```

---

### Task 10: 단계·진행률 계산기

**Files:**
- Create: `main/run/monitor/RunProgress.java`, `main/run/monitor/RunProgressCalculator.java`
- Test: `test/run/monitor/RunProgressCalculatorTest.java`

**Interfaces:**
- Consumes: `AirflowTaskState`(Task 7), `RunStatus`, `RunStage`(Task 9)
- Produces:
  - `record RunProgress(RunStatus status, RunStage stage, int progress)`
  - `RunProgressCalculator.calculate(AirflowTaskState state, int completedCodeCells, int totalCodeCells, RunStage previousStage, int previousProgress)` — 설계 4.7 표. 판정 순서: ① 실패(`isFailed`) → `FAILED`, 이전 단계·진행률 유지 ② dagRun `success` → `RUNNING`/`REGISTERING`/95 ③ `execute_notebook` 시작됨 → `RUNNING`/`TRAINING`/`24 + 71 × 완료 ÷ 전체`(정수 나눗셈, 전체 0이면 24) ④ `download_notebook` success → `RUNNING`/`DATA`/24 ⑤ `preflight_check` success → `RUNNING`/`DATA`/10 ⑥ `preflight_check` 시작됨 → `RUNNING`/`PREPARING`/5 ⑦ 그 외 `QUEUED`/`PREPARING`/0. (`SUCCEEDED`/`DONE`/100은 MLflow 결과를 보는 Task 13 `RunMonitor`가 정한다.)

- [ ] **Step 1: 실패하는 테스트 작성**

`test/run/monitor/RunProgressCalculatorTest.java`:

```java
package com.prizm.backend.run.monitor;

import static org.assertj.core.api.Assertions.assertThat;

import com.prizm.backend.airflow.AirflowTaskState;
import com.prizm.backend.run.RunStage;
import com.prizm.backend.run.RunStatus;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RunProgressCalculatorTest {

    private final RunProgressCalculator calculator = new RunProgressCalculator();

    private static AirflowTaskState state(String dagRun, String preflight, String download, String execute) {
        Map<String, String> tasks = new HashMap<>();
        tasks.put("preflight_check", preflight);
        tasks.put("download_notebook", download);
        tasks.put("execute_notebook", execute);
        return new AirflowTaskState(dagRun, tasks);
    }

    private RunProgress calculate(AirflowTaskState state, int completed, int total) {
        return calculator.calculate(state, completed, total, RunStage.PREPARING, 0);
    }

    @Test
    void queuedDagRunWaitsInQueue() {
        assertThat(calculate(state("queued", null, null, null), 0, 0))
                .isEqualTo(new RunProgress(RunStatus.QUEUED, RunStage.PREPARING, 0));
    }

    @Test
    void preflightRunningIsPreparing() {
        assertThat(calculate(state("running", "running", null, null), 0, 0))
                .isEqualTo(new RunProgress(RunStatus.RUNNING, RunStage.PREPARING, 5));
    }

    @Test
    void preflightSucceededWhileDownloadingIsData() {
        assertThat(calculate(state("running", "success", "running", null), 0, 0))
                .isEqualTo(new RunProgress(RunStatus.RUNNING, RunStage.DATA, 10));
    }

    @Test
    void downloadSucceededBeforeExecuteStartsIsData24() {
        assertThat(calculate(state("running", "success", "success", "queued"), 0, 0))
                .isEqualTo(new RunProgress(RunStatus.RUNNING, RunStage.DATA, 24));
    }

    @Test
    void executeRunningAddsCompletedCodeCellShare() {
        assertThat(calculate(state("running", "success", "success", "running"), 4, 8))
                .isEqualTo(new RunProgress(RunStatus.RUNNING, RunStage.TRAINING, 59));
    }

    @Test
    void executeRunningWithoutSnapshotStaysAt24() {
        assertThat(calculate(state("running", "success", "success", "running"), 0, 0))
                .isEqualTo(new RunProgress(RunStatus.RUNNING, RunStage.TRAINING, 24));
    }

    @Test
    void dagRunSucceededWaitsForMlflowResult() {
        assertThat(calculate(state("success", "success", "success", "success"), 8, 8))
                .isEqualTo(new RunProgress(RunStatus.RUNNING, RunStage.REGISTERING, 95));
    }

    @Test
    void failedTaskKeepsPreviousStageAndProgress() {
        assertThat(calculator.calculate(state("failed", "success", "success", "failed"), 4, 8, RunStage.TRAINING, 52))
                .isEqualTo(new RunProgress(RunStatus.FAILED, RunStage.TRAINING, 52));
    }

    @Test
    void upstreamFailedWhileDagRunStillRunningIsFailed() {
        assertThat(calculator.calculate(state("running", "success", "failed", "upstream_failed"), 0, 0, RunStage.DATA, 10))
                .isEqualTo(new RunProgress(RunStatus.FAILED, RunStage.DATA, 10));
    }
}
```

- [ ] **Step 2: 실패 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests RunProgressCalculatorTest
```

Expected: FAIL — `cannot find symbol` (`RunProgressCalculator`, `RunProgress`).

- [ ] **Step 3: 구현**

`main/run/monitor/RunProgress.java`:

```java
package com.prizm.backend.run.monitor;

import com.prizm.backend.run.RunStage;
import com.prizm.backend.run.RunStatus;

public record RunProgress(RunStatus status, RunStage stage, int progress) {
}
```

`main/run/monitor/RunProgressCalculator.java`:

```java
package com.prizm.backend.run.monitor;

import static com.prizm.backend.airflow.AirflowTaskState.DOWNLOAD_NOTEBOOK;
import static com.prizm.backend.airflow.AirflowTaskState.EXECUTE_NOTEBOOK;
import static com.prizm.backend.airflow.AirflowTaskState.PREFLIGHT_CHECK;

import com.prizm.backend.airflow.AirflowTaskState;
import com.prizm.backend.run.RunStage;
import com.prizm.backend.run.RunStatus;
import org.springframework.stereotype.Component;

/** Airflow 상태와 노트북 셀 진행으로 화면용 상태·단계·진행률을 계산한다(설계 4.7). */
@Component
public class RunProgressCalculator {

    private static final int DATA_READY = 24;
    private static final int TRAINING_SPAN = 71;

    public RunProgress calculate(AirflowTaskState state, int completedCodeCells, int totalCodeCells,
            RunStage previousStage, int previousProgress) {
        if (state.isFailed()) {
            return new RunProgress(RunStatus.FAILED, previousStage, previousProgress);
        }
        if ("success".equals(state.dagRunState())) {
            return new RunProgress(RunStatus.RUNNING, RunStage.REGISTERING, 95);
        }
        if (state.hasStarted(EXECUTE_NOTEBOOK)) {
            int trained = totalCodeCells == 0 ? 0 : TRAINING_SPAN * completedCodeCells / totalCodeCells;
            return new RunProgress(RunStatus.RUNNING, RunStage.TRAINING, DATA_READY + trained);
        }
        if ("success".equals(state.task(DOWNLOAD_NOTEBOOK))) {
            return new RunProgress(RunStatus.RUNNING, RunStage.DATA, DATA_READY);
        }
        if ("success".equals(state.task(PREFLIGHT_CHECK))) {
            return new RunProgress(RunStatus.RUNNING, RunStage.DATA, 10);
        }
        if (state.hasStarted(PREFLIGHT_CHECK)) {
            return new RunProgress(RunStatus.RUNNING, RunStage.PREPARING, 5);
        }
        return new RunProgress(RunStatus.QUEUED, RunStage.PREPARING, 0);
    }
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests RunProgressCalculatorTest
```

Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "feat: Airflow 태스크 상태 기반 실행 단계·진행률 계산"
```

---

### Task 11: 노트북·로그·실행 스냅샷 캐시

**Files:**
- Create: `main/run/monitor/NotebookPayload.java`, `main/run/monitor/LogPayload.java`, `main/run/monitor/RunEvents.java`, `main/run/monitor/RunSnapshotStore.java`
- Test: `test/run/monitor/RunSnapshotStoreTest.java`

**Interfaces:**
- Consumes: `NotebookSnapshotReader`, `NotebookCell`(Task 6), `AirflowClient`, `AirflowTaskState.EXECUTE_NOTEBOOK`(Task 7), `Run`, `RunResponse`(Task 9)
- Produces:
  - `record NotebookPayload(List<NotebookCell> cells)` — `EMPTY`, `int codeCellCount()`, `int completedCodeCellCount()`
  - `record LogPayload(List<String> lines)` — `EMPTY`
  - `final class RunEvents` — `NOTEBOOK = "notebook"`, `LOG = "log"`, `RUN = "run"`
  - `RunSnapshotStore` — 상수 `LOG_TAIL_LINES = 200`; `Path notebookPath(String runId)`(`{runsDir}/{runId}/executed.ipynb`), `boolean refreshNotebook(String runId)`(수정 시각이 바뀌었고 파싱에 성공해 내용이 달라졌을 때만 true. 파싱 실패 시 수정 시각을 기록하지 않아 다음 주기에 재시도), `NotebookPayload notebook(String runId)`(캐시 → 파일 → `EMPTY`), `boolean updateLog(String runId, List<String> lines)`, `LogPayload log(Run run)`(캐시 → Airflow `execute_notebook` 로그 끝 200줄 → 실패 시 `EMPTY`), `boolean updateRun(RunResponse response)`. 테스트용 생성자 `RunSnapshotStore(NotebookSnapshotReader, AirflowClient, Path runsDir)`(패키지 전용).

- [ ] **Step 1: 실패하는 테스트 작성**

`test/run/monitor/RunSnapshotStoreTest.java`:

```java
package com.prizm.backend.run.monitor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.prizm.backend.TestFixtures;
import com.prizm.backend.airflow.AirflowClient;
import com.prizm.backend.notebook.NotebookSnapshotReader;
import com.prizm.backend.run.Run;
import com.prizm.backend.run.RunResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.ResourceAccessException;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(MockitoExtension.class)
class RunSnapshotStoreTest {

    @TempDir
    Path runsDir;

    @Mock
    private AirflowClient airflow;

    private final JsonMapper mapper = JsonMapper.builder().build();
    private RunSnapshotStore store;

    @BeforeEach
    void setUp() {
        store = new RunSnapshotStore(new NotebookSnapshotReader(mapper), airflow, runsDir);
    }

    private Path writeFixture(String runId, String fixture) throws Exception {
        Path target = store.notebookPath(runId);
        Files.createDirectories(target.getParent());
        Files.copy(Path.of(getClass().getResource("/notebooks/" + fixture).toURI()), target,
                StandardCopyOption.REPLACE_EXISTING);
        return target;
    }

    private static Run run() {
        return Run.queued("RUN-27000", TestFixtures.weldAsset(), "{\"epochs\":3}", "ml.a100.20gb",
                "pytorch-2.4-yolo12-py311-cu124", "이학선", Instant.parse("2026-09-17T14:02:11Z"));
    }

    @Test
    void refreshReportsChangeOnlyWhenFileChanges() throws Exception {
        writeFixture("RUN-27000", "running.ipynb");

        assertThat(store.refreshNotebook("RUN-27000")).isTrue();
        assertThat(store.refreshNotebook("RUN-27000")).isFalse();

        NotebookPayload notebook = store.notebook("RUN-27000");
        assertThat(notebook.cells()).hasSize(6);
        assertThat(notebook.codeCellCount()).isEqualTo(5);
        assertThat(notebook.completedCodeCellCount()).isEqualTo(3);
    }

    @Test
    void keepsLastGoodSnapshotWhenFileIsPartiallyWritten() throws Exception {
        Path file = writeFixture("RUN-27000", "running.ipynb");
        store.refreshNotebook("RUN-27000");

        Files.copy(Path.of(getClass().getResource("/notebooks/partial.ipynb").toURI()), file,
                StandardCopyOption.REPLACE_EXISTING);
        Files.setLastModifiedTime(file, FileTime.fromMillis(Files.getLastModifiedTime(file).toMillis() + 5_000));

        assertThat(store.refreshNotebook("RUN-27000")).isFalse();
        assertThat(store.notebook("RUN-27000").cells()).hasSize(6);
    }

    @Test
    void readsFileWhenCacheIsEmpty() throws Exception {
        writeFixture("RUN-27000", "running.ipynb");

        assertThat(store.notebook("RUN-27000").cells()).hasSize(6);
    }

    @Test
    void returnsEmptyNotebookWhenFileMissing() {
        assertThat(store.notebook("RUN-404")).isEqualTo(NotebookPayload.EMPTY);
        assertThat(store.refreshNotebook("RUN-404")).isFalse();
    }

    @Test
    void updateLogReportsOnlyChanges() {
        assertThat(store.updateLog("RUN-27000", List.of("a"))).isTrue();
        assertThat(store.updateLog("RUN-27000", List.of("a"))).isFalse();
        assertThat(store.updateLog("RUN-27000", List.of("a", "b"))).isTrue();
        assertThat(store.log(run()).lines()).containsExactly("a", "b");
    }

    @Test
    void logFallsBackToAirflowWhenNotCached() {
        when(airflow.fetchLogTail("prizm_RUN-27000", "execute_notebook", 200)).thenReturn(List.of("epoch 1/3"));

        assertThat(store.log(run()).lines()).containsExactly("epoch 1/3");
    }

    @Test
    void logIsEmptyWhenAirflowUnavailable() {
        when(airflow.fetchLogTail("prizm_RUN-27000", "execute_notebook", 200))
                .thenThrow(new ResourceAccessException("Connection refused"));

        assertThat(store.log(run())).isEqualTo(LogPayload.EMPTY);
    }

    @Test
    void updateRunReportsOnlyChanges() {
        Run run = run();

        assertThat(store.updateRun(RunResponse.from(run, mapper))).isTrue();
        assertThat(store.updateRun(RunResponse.from(run, mapper))).isFalse();
    }
}
```

- [ ] **Step 2: 실패 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests RunSnapshotStoreTest
```

Expected: FAIL — `cannot find symbol` (`RunSnapshotStore`, `NotebookPayload`, `LogPayload`).

- [ ] **Step 3: 구현**

`main/run/monitor/NotebookPayload.java`:

```java
package com.prizm.backend.run.monitor;

import com.prizm.backend.notebook.NotebookCell;
import java.util.List;

/** SSE notebook 이벤트와 GET /api/runs/{id}/notebook 응답 본문. */
public record NotebookPayload(List<NotebookCell> cells) {

    public static final NotebookPayload EMPTY = new NotebookPayload(List.of());

    public int codeCellCount() {
        return (int) cells.stream().filter(cell -> "code".equals(cell.cellType())).count();
    }

    public int completedCodeCellCount() {
        return (int) cells.stream()
                .filter(cell -> "code".equals(cell.cellType()) && "completed".equals(cell.status()))
                .count();
    }
}
```

`main/run/monitor/LogPayload.java`:

```java
package com.prizm.backend.run.monitor;

import java.util.List;

/** SSE log 이벤트와 GET /api/runs/{id}/log 응답 본문. */
public record LogPayload(List<String> lines) {

    public static final LogPayload EMPTY = new LogPayload(List.of());
}
```

`main/run/monitor/RunEvents.java`:

```java
package com.prizm.backend.run.monitor;

/** SSE 이벤트 이름. 한 번에 여러 개를 보낼 때는 항상 RUN을 마지막에 보낸다. */
public final class RunEvents {

    public static final String NOTEBOOK = "notebook";
    public static final String LOG = "log";
    public static final String RUN = "run";

    private RunEvents() {
    }
}
```

`main/run/monitor/RunSnapshotStore.java`:

```java
package com.prizm.backend.run.monitor;

import com.prizm.backend.airflow.AirflowClient;
import com.prizm.backend.airflow.AirflowTaskState;
import com.prizm.backend.config.PrizmProperties;
import com.prizm.backend.notebook.NotebookCell;
import com.prizm.backend.notebook.NotebookSnapshotReader;
import com.prizm.backend.run.Run;
import com.prizm.backend.run.RunResponse;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;

/**
 * 마지막으로 읽은 노트북·로그·실행 응답을 메모리에 두고, 바뀌었는지 판단한다.
 * 캐시가 비어 있으면(백엔드 재시작 직후) 파일과 Airflow에서 다시 읽는다.
 */
@Component
public class RunSnapshotStore {

    public static final int LOG_TAIL_LINES = 200;

    private final NotebookSnapshotReader reader;
    private final AirflowClient airflow;
    private final Path runsDir;
    private final Map<String, NotebookPayload> notebooks = new ConcurrentHashMap<>();
    private final Map<String, Long> notebookModifiedAt = new ConcurrentHashMap<>();
    private final Map<String, LogPayload> logs = new ConcurrentHashMap<>();
    private final Map<String, RunResponse> runs = new ConcurrentHashMap<>();

    @Autowired
    public RunSnapshotStore(NotebookSnapshotReader reader, AirflowClient airflow, PrizmProperties properties) {
        this(reader, airflow, properties.runsDir());
    }

    RunSnapshotStore(NotebookSnapshotReader reader, AirflowClient airflow, Path runsDir) {
        this.reader = reader;
        this.airflow = airflow;
        this.runsDir = runsDir;
    }

    public Path notebookPath(String runId) {
        return runsDir.resolve(runId).resolve("executed.ipynb");
    }

    public boolean refreshNotebook(String runId) {
        Path path = notebookPath(runId);
        long modifiedAt;
        try {
            modifiedAt = Files.getLastModifiedTime(path).toMillis();
        } catch (IOException e) {
            return false;
        }
        if (Long.valueOf(modifiedAt).equals(notebookModifiedAt.get(runId))) {
            return false;
        }
        Optional<List<NotebookCell>> cells = reader.read(path);
        if (cells.isEmpty()) {
            return false; // papermill이 쓰는 도중 - 마지막 정상 스냅샷을 유지하고 다음 주기에 다시 읽는다
        }
        notebookModifiedAt.put(runId, modifiedAt);
        NotebookPayload payload = new NotebookPayload(cells.get());
        return !payload.equals(notebooks.put(runId, payload));
    }

    public NotebookPayload notebook(String runId) {
        NotebookPayload cached = notebooks.get(runId);
        if (cached != null) {
            return cached;
        }
        return reader.read(notebookPath(runId)).map(NotebookPayload::new).orElse(NotebookPayload.EMPTY);
    }

    public boolean updateLog(String runId, List<String> lines) {
        LogPayload payload = new LogPayload(List.copyOf(lines));
        return !payload.equals(logs.put(runId, payload));
    }

    public LogPayload log(Run run) {
        LogPayload cached = logs.get(run.getId());
        if (cached != null) {
            return cached;
        }
        try {
            return new LogPayload(airflow.fetchLogTail(
                    run.getDagRunId(), AirflowTaskState.EXECUTE_NOTEBOOK, LOG_TAIL_LINES));
        } catch (RestClientException e) {
            return LogPayload.EMPTY;
        }
    }

    public boolean updateRun(RunResponse response) {
        return !response.equals(runs.put(response.id(), response));
    }
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests RunSnapshotStoreTest
```

Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "feat: 노트북·로그·실행 스냅샷 캐시와 변경 감지"
```

---

### Task 12: SSE 구독자 관리

**Files:**
- Create: `main/run/monitor/RunEventBroadcaster.java`
- Test: `test/run/monitor/RunEventBroadcasterTest.java`

**Interfaces:**
- Consumes: `NotebookPayload`, `LogPayload`, `RunEvents`(Task 11), `RunResponse`(Task 9)
- Produces: `RunEventBroadcaster` —
  - `SseEmitter subscribe(String runId, NotebookPayload notebook, LogPayload log, RunResponse run)` — 등록 후 `notebook` → `log` → `run` 순으로 즉시 전송. 완료·타임아웃·오류 콜백에서 구독 해제. 전송 실패 시 해제.
  - `void publishNotebook(String runId, NotebookPayload)`, `void publishLog(String runId, LogPayload)`, `void publishRun(String runId, RunResponse)`
  - `@Scheduled(fixedRate = 15000) void heartbeat()` — `: ping` 주석 전송
  - `int subscriberCount(String runId)`
  - 테스트 확장 지점(protected): `SseEmitter newEmitter()`(타임아웃 30분), `void sendEvent(SseEmitter, String name, Object data) throws IOException`, `void sendHeartbeat(SseEmitter) throws IOException`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/run/monitor/RunEventBroadcasterTest.java`:

```java
package com.prizm.backend.run.monitor;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class RunEventBroadcasterTest {

    private final List<String> sent = new ArrayList<>();
    private final List<RecordingEmitter> emitters = new ArrayList<>();
    private boolean failSends;

    private final RunEventBroadcaster broadcaster = new RunEventBroadcaster() {
        @Override
        protected SseEmitter newEmitter() {
            RecordingEmitter emitter = new RecordingEmitter();
            emitters.add(emitter);
            return emitter;
        }

        @Override
        protected void sendEvent(SseEmitter emitter, String name, Object data) throws IOException {
            if (failSends) {
                throw new IOException("Broken pipe");
            }
            sent.add(name);
        }

        @Override
        protected void sendHeartbeat(SseEmitter emitter) throws IOException {
            if (failSends) {
                throw new IOException("Broken pipe");
            }
            sent.add("ping");
        }
    };

    /** 서블릿 없이 완료 콜백을 직접 실행하기 위해 콜백을 붙잡아 둔다. */
    static class RecordingEmitter extends SseEmitter {
        Runnable completion;

        @Override
        public synchronized void onCompletion(Runnable callback) {
            this.completion = callback;
            super.onCompletion(callback);
        }
    }

    @Test
    void subscribeSendsSnapshotWithRunLast() {
        broadcaster.subscribe("RUN-1", NotebookPayload.EMPTY, LogPayload.EMPTY, null);

        assertThat(sent).containsExactly("notebook", "log", "run");
        assertThat(broadcaster.subscriberCount("RUN-1")).isEqualTo(1);
    }

    @Test
    void publishReachesOnlySubscribersOfThatRun() {
        broadcaster.subscribe("RUN-1", NotebookPayload.EMPTY, LogPayload.EMPTY, null);
        broadcaster.subscribe("RUN-2", NotebookPayload.EMPTY, LogPayload.EMPTY, null);
        sent.clear();

        broadcaster.publishLog("RUN-1", LogPayload.EMPTY);

        assertThat(sent).containsExactly("log");
    }

    @Test
    void completionRemovesSubscriber() {
        broadcaster.subscribe("RUN-1", NotebookPayload.EMPTY, LogPayload.EMPTY, null);

        emitters.getFirst().completion.run();

        assertThat(broadcaster.subscriberCount("RUN-1")).isZero();
    }

    @Test
    void failedSendRemovesSubscriber() {
        broadcaster.subscribe("RUN-1", NotebookPayload.EMPTY, LogPayload.EMPTY, null);
        failSends = true;

        broadcaster.publishRun("RUN-1", null);

        assertThat(broadcaster.subscriberCount("RUN-1")).isZero();
    }

    @Test
    void heartbeatPingsEverySubscriber() {
        broadcaster.subscribe("RUN-1", NotebookPayload.EMPTY, LogPayload.EMPTY, null);
        broadcaster.subscribe("RUN-2", NotebookPayload.EMPTY, LogPayload.EMPTY, null);
        sent.clear();

        broadcaster.heartbeat();

        assertThat(sent).containsExactly("ping", "ping");
    }
}
```

- [ ] **Step 2: 실패 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests RunEventBroadcasterTest
```

Expected: FAIL — `cannot find symbol` (`RunEventBroadcaster`).

- [ ] **Step 3: 구현**

`main/run/monitor/RunEventBroadcaster.java`:

```java
package com.prizm.backend.run.monitor;

import com.prizm.backend.run.RunResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class RunEventBroadcaster {

    private static final Logger log = LoggerFactory.getLogger(RunEventBroadcaster.class);
    static final long TIMEOUT_MILLIS = Duration.ofMinutes(30).toMillis();

    private final Map<String, Set<SseEmitter>> subscribers = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String runId, NotebookPayload notebook, LogPayload logPayload, RunResponse run) {
        SseEmitter emitter = newEmitter();
        subscribers.computeIfAbsent(runId, key -> ConcurrentHashMap.newKeySet()).add(emitter);
        emitter.onCompletion(() -> remove(runId, emitter));
        emitter.onTimeout(() -> remove(runId, emitter));
        emitter.onError(error -> remove(runId, emitter));
        // 프론트는 종료 상태의 run을 받으면 연결을 닫으므로 run을 마지막에 보낸다
        if (deliver(runId, emitter, RunEvents.NOTEBOOK, notebook) && deliver(runId, emitter, RunEvents.LOG, logPayload)) {
            deliver(runId, emitter, RunEvents.RUN, run);
        }
        return emitter;
    }

    public void publishNotebook(String runId, NotebookPayload notebook) {
        publish(runId, RunEvents.NOTEBOOK, notebook);
    }

    public void publishLog(String runId, LogPayload logPayload) {
        publish(runId, RunEvents.LOG, logPayload);
    }

    public void publishRun(String runId, RunResponse run) {
        publish(runId, RunEvents.RUN, run);
    }

    @Scheduled(fixedRate = 15_000)
    public void heartbeat() {
        subscribers.forEach((runId, emitters) -> emitters.forEach(emitter -> {
            try {
                sendHeartbeat(emitter);
            } catch (IOException | IllegalStateException e) {
                drop(runId, emitter, e);
            }
        }));
    }

    public int subscriberCount(String runId) {
        return subscribers.getOrDefault(runId, Set.of()).size();
    }

    protected SseEmitter newEmitter() {
        return new SseEmitter(TIMEOUT_MILLIS);
    }

    protected void sendEvent(SseEmitter emitter, String name, Object data) throws IOException {
        emitter.send(SseEmitter.event().name(name).data(data, MediaType.APPLICATION_JSON));
    }

    protected void sendHeartbeat(SseEmitter emitter) throws IOException {
        emitter.send(SseEmitter.event().comment("ping"));
    }

    private void publish(String runId, String name, Object data) {
        for (SseEmitter emitter : subscribers.getOrDefault(runId, Set.of())) {
            deliver(runId, emitter, name, data);
        }
    }

    private boolean deliver(String runId, SseEmitter emitter, String name, Object data) {
        try {
            sendEvent(emitter, name, data);
            return true;
        } catch (IOException | IllegalStateException e) {
            drop(runId, emitter, e);
            return false;
        }
    }

    private void drop(String runId, SseEmitter emitter, Exception cause) {
        log.debug("SSE 구독 해제 {}: {}", runId, cause.getMessage());
        remove(runId, emitter);
        try {
            emitter.completeWithError(cause);
        } catch (RuntimeException ignored) {
            // 이미 끝난 emitter
        }
    }

    private void remove(String runId, SseEmitter emitter) {
        subscribers.computeIfPresent(runId, (key, emitters) -> {
            emitters.remove(emitter);
            return emitters.isEmpty() ? null : emitters;
        });
    }
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests RunEventBroadcasterTest
```

Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "feat: 실행별 SSE 구독자 관리와 heartbeat"
```

---

### Task 13: 실행 모니터

**Files:**
- Create: `main/run/monitor/RunMonitor.java`
- Test: `test/run/monitor/RunMonitorTest.java`

**Interfaces:**
- Consumes: `RunRepository`, `Run`, `RunResponse`(Task 9), `AirflowClient`, `AirflowTaskState`(Task 7), `MlflowClient`, `MlflowRunResult`(Task 8), `RunProgressCalculator`(Task 10), `RunSnapshotStore`, `NotebookPayload`(Task 11), `RunEventBroadcaster`(Task 12)
- Produces: `RunMonitor(RunRepository, AirflowClient, MlflowClient, RunProgressCalculator, RunSnapshotStore, RunEventBroadcaster, JsonMapper, Clock)` —
  - `@Scheduled(fixedDelay = 2000) void poll()` — `QUEUED`·`RUNNING` run마다 독립 처리, 예외는 경고 로그만
  - 상수 `MAX_RESULT_LOOKUP_ATTEMPTS = 30`, `MISSING_RESULT_MESSAGE = "MLflow에서 모델 등록 정보를 찾지 못했습니다"`
  - 실패 메시지: `"{task_id} 실패: {오류 줄}"`, 오류 줄은 로그의 마지막 `\w+(Error|Exception): .+` 매치, 없으면 마지막 비어있지 않은 줄, 로그가 없으면 `"{task_id} 실패"`, 실패 태스크 없이 dagRun만 failed면 `"DAG 실행 실패"`
  - 한 주기 푸시 순서: `notebook` → `log` → `run`(각각 바뀐 경우만)

- [ ] **Step 1: 실패하는 테스트 작성**

`test/run/monitor/RunMonitorTest.java`:

```java
package com.prizm.backend.run.monitor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.prizm.backend.TestFixtures;
import com.prizm.backend.airflow.AirflowClient;
import com.prizm.backend.airflow.AirflowTaskState;
import com.prizm.backend.mlflow.MlflowClient;
import com.prizm.backend.mlflow.MlflowRunResult;
import com.prizm.backend.notebook.NotebookSnapshotReader;
import com.prizm.backend.run.Run;
import com.prizm.backend.run.RunRepository;
import com.prizm.backend.run.RunStage;
import com.prizm.backend.run.RunStatus;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.ResourceAccessException;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(MockitoExtension.class)
class RunMonitorTest {

    private static final Instant NOW = Instant.parse("2026-09-17T14:05:00Z");

    @TempDir
    Path runsDir;

    @Mock
    private RunRepository repository;
    @Mock
    private AirflowClient airflow;
    @Mock
    private MlflowClient mlflow;
    @Mock
    private RunEventBroadcaster broadcaster;

    private final JsonMapper mapper = JsonMapper.builder().build();
    private RunSnapshotStore snapshots;
    private RunMonitor monitor;

    @BeforeEach
    void setUp() {
        snapshots = new RunSnapshotStore(new NotebookSnapshotReader(mapper), airflow, runsDir);
        monitor = new RunMonitor(repository, airflow, mlflow, new RunProgressCalculator(), snapshots, broadcaster,
                mapper, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static Run queuedRun(String id) {
        return Run.queued(id, TestFixtures.weldAsset(), "{\"epochs\":3}", "ml.a100.20gb",
                "pytorch-2.4-yolo12-py311-cu124", "이학선", Instant.parse("2026-09-17T14:02:11Z"));
    }

    private static AirflowTaskState state(String dagRun, String preflight, String download, String execute) {
        Map<String, String> tasks = new HashMap<>();
        tasks.put("preflight_check", preflight);
        tasks.put("download_notebook", download);
        tasks.put("execute_notebook", execute);
        return new AirflowTaskState(dagRun, tasks);
    }

    private void writeRunningNotebook(String runId) throws Exception {
        Path target = snapshots.notebookPath(runId);
        Files.createDirectories(target.getParent());
        Files.copy(Path.of(getClass().getResource("/notebooks/running.ipynb").toURI()), target,
                StandardCopyOption.REPLACE_EXISTING);
    }

    private void givenActiveRuns(Run... runs) {
        when(repository.findByStatusIn(any())).thenReturn(List.of(runs));
    }

    @Test
    void publishesNotebookLogAndRunWhileTraining() throws Exception {
        Run run = queuedRun("RUN-27000");
        givenActiveRuns(run);
        writeRunningNotebook("RUN-27000");
        when(airflow.fetchState("prizm_RUN-27000")).thenReturn(state("running", "success", "success", "running"));
        when(airflow.fetchLogTail("prizm_RUN-27000", "execute_notebook", 200)).thenReturn(List.of("epoch 1/3"));

        monitor.poll();

        assertThat(run.getStatus()).isEqualTo(RunStatus.RUNNING);
        assertThat(run.getStage()).isEqualTo(RunStage.TRAINING);
        assertThat(run.getExecutedCells()).isEqualTo(3);
        assertThat(run.getTotalCells()).isEqualTo(5);
        assertThat(run.getProgress()).isEqualTo(66);
        assertThat(run.getStartedAt()).isEqualTo(NOW);
        verify(repository).save(run);
        InOrder order = inOrder(broadcaster);
        order.verify(broadcaster).publishNotebook(eq("RUN-27000"), any());
        order.verify(broadcaster).publishLog(eq("RUN-27000"), any());
        order.verify(broadcaster).publishRun(eq("RUN-27000"), any());
    }

    @Test
    void publishesOnlyChangesOnNextPoll() throws Exception {
        Run run = queuedRun("RUN-27000");
        givenActiveRuns(run);
        writeRunningNotebook("RUN-27000");
        when(airflow.fetchState("prizm_RUN-27000")).thenReturn(state("running", "success", "success", "running"));
        when(airflow.fetchLogTail("prizm_RUN-27000", "execute_notebook", 200)).thenReturn(List.of("epoch 1/3"));

        monitor.poll();
        monitor.poll();

        verify(broadcaster, times(1)).publishNotebook(eq("RUN-27000"), any());
        verify(broadcaster, times(1)).publishLog(eq("RUN-27000"), any());
        verify(broadcaster, times(1)).publishRun(eq("RUN-27000"), any());
    }

    @Test
    void isolatesFailureOfOneRun() {
        Run broken = queuedRun("RUN-A");
        Run healthy = queuedRun("RUN-B");
        givenActiveRuns(broken, healthy);
        when(airflow.fetchState("prizm_RUN-A")).thenThrow(new ResourceAccessException("Connection refused"));
        when(airflow.fetchState("prizm_RUN-B")).thenReturn(state("queued", null, null, null));

        monitor.poll();

        verify(repository, never()).save(broken);
        verify(repository).save(healthy);
        verify(broadcaster).publishRun(eq("RUN-B"), any());
    }

    @Test
    void marksSucceededWhenMlflowResultFound() {
        Run run = queuedRun("RUN-27000");
        givenActiveRuns(run);
        when(airflow.fetchState("prizm_RUN-27000")).thenReturn(state("success", "success", "success", "success"));
        when(airflow.fetchLogTail("prizm_RUN-27000", "execute_notebook", 200)).thenReturn(List.of("done"));
        when(mlflow.findResult("RUN-27000")).thenReturn(Optional.of(
                new MlflowRunResult("abc123", 0.4123, "weld-bead-defect-detector", "3")));

        monitor.poll();

        assertThat(run.getStatus()).isEqualTo(RunStatus.SUCCEEDED);
        assertThat(run.getStage()).isEqualTo(RunStage.DONE);
        assertThat(run.getProgress()).isEqualTo(100);
        assertThat(run.getMlflowRunId()).isEqualTo("abc123");
        assertThat(run.getMap50()).isEqualTo(0.4123);
        assertThat(run.getRegisteredModelVersion()).isEqualTo("3");
        assertThat(run.getErrorMessage()).isNull();
        assertThat(run.getFinishedAt()).isEqualTo(NOW);
    }

    @Test
    void keepsRegisteringWhileResultIsMissing() {
        Run run = queuedRun("RUN-27000");
        givenActiveRuns(run);
        when(airflow.fetchState("prizm_RUN-27000")).thenReturn(state("success", "success", "success", "success"));
        when(airflow.fetchLogTail("prizm_RUN-27000", "execute_notebook", 200)).thenReturn(List.of("done"));
        when(mlflow.findResult("RUN-27000")).thenReturn(Optional.empty());

        monitor.poll();

        assertThat(run.getStatus()).isEqualTo(RunStatus.RUNNING);
        assertThat(run.getStage()).isEqualTo(RunStage.REGISTERING);
        assertThat(run.getProgress()).isEqualTo(95);
        assertThat(run.getResultLookupAttempts()).isEqualTo(1);
        assertThat(run.getFinishedAt()).isNull();
    }

    @Test
    void finishesWithWarningAfterMaxLookupAttempts() {
        Run run = queuedRun("RUN-27000");
        for (int i = 0; i < RunMonitor.MAX_RESULT_LOOKUP_ATTEMPTS - 1; i++) {
            run.incrementResultLookupAttempts();
        }
        givenActiveRuns(run);
        when(airflow.fetchState("prizm_RUN-27000")).thenReturn(state("success", "success", "success", "success"));
        when(airflow.fetchLogTail("prizm_RUN-27000", "execute_notebook", 200)).thenReturn(List.of("done"));
        when(mlflow.findResult("RUN-27000")).thenReturn(Optional.empty());

        monitor.poll();

        assertThat(run.getStatus()).isEqualTo(RunStatus.SUCCEEDED);
        assertThat(run.getStage()).isEqualTo(RunStage.DONE);
        assertThat(run.getProgress()).isEqualTo(100);
        assertThat(run.getResultLookupAttempts()).isEqualTo(30);
        assertThat(run.getErrorMessage()).isEqualTo("MLflow에서 모델 등록 정보를 찾지 못했습니다");
    }

    @Test
    void marksFailedWithErrorLineFromExecuteLog() {
        Run run = queuedRun("RUN-27000");
        run.applyProgress(RunStatus.RUNNING, RunStage.TRAINING, 52, Instant.parse("2026-09-17T14:03:00Z"));
        givenActiveRuns(run);
        when(airflow.fetchState("prizm_RUN-27000")).thenReturn(state("failed", "success", "success", "failed"));
        when(airflow.fetchLogTail("prizm_RUN-27000", "execute_notebook", 200)).thenReturn(List.of(
                "Traceback (most recent call last):",
                "ValueError: epochs는 1 이상이어야 합니다",
                "[2026-09-17, 14:04:59 UTC] {local_task_job_runner.py:266} INFO - Task exited with return code 1",
                ""));

        monitor.poll();

        assertThat(run.getStatus()).isEqualTo(RunStatus.FAILED);
        assertThat(run.getStage()).isEqualTo(RunStage.TRAINING);
        assertThat(run.getProgress()).isEqualTo(52);
        assertThat(run.getErrorMessage()).isEqualTo("execute_notebook 실패: ValueError: epochs는 1 이상이어야 합니다");
        assertThat(run.getFinishedAt()).isEqualTo(NOW);
    }

    @Test
    void failedPreflightUsesItsOwnTaskLog() {
        Run run = queuedRun("RUN-27000");
        givenActiveRuns(run);
        when(airflow.fetchState("prizm_RUN-27000"))
                .thenReturn(state("failed", "failed", "upstream_failed", "upstream_failed"));
        when(airflow.fetchLogTail("prizm_RUN-27000", "preflight_check", 200)).thenReturn(List.of(
                "requests.exceptions.ConnectionError: AI Hub unreachable",
                "INFO - Task exited with return code 1"));

        monitor.poll();

        assertThat(run.getStatus()).isEqualTo(RunStatus.FAILED);
        assertThat(run.getErrorMessage()).isEqualTo("preflight_check 실패: ConnectionError: AI Hub unreachable");
    }
}
```

- [ ] **Step 2: 실패 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests RunMonitorTest
```

Expected: FAIL — `cannot find symbol` (`RunMonitor`).

- [ ] **Step 3: 구현**

`main/run/monitor/RunMonitor.java`:

```java
package com.prizm.backend.run.monitor;

import com.prizm.backend.airflow.AirflowClient;
import com.prizm.backend.airflow.AirflowTaskState;
import com.prizm.backend.mlflow.MlflowClient;
import com.prizm.backend.run.Run;
import com.prizm.backend.run.RunRepository;
import com.prizm.backend.run.RunResponse;
import com.prizm.backend.run.RunStage;
import com.prizm.backend.run.RunStatus;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.json.JsonMapper;

/** 진행 중인 실행의 Airflow 상태·로그·노트북 스냅샷·MLflow 결과를 모아 저장하고 바뀐 것만 SSE로 푸시한다. */
@Component
public class RunMonitor {

    private static final Logger log = LoggerFactory.getLogger(RunMonitor.class);
    static final int MAX_RESULT_LOOKUP_ATTEMPTS = 30;
    static final String MISSING_RESULT_MESSAGE = "MLflow에서 모델 등록 정보를 찾지 못했습니다";
    private static final Pattern ERROR_LINE = Pattern.compile("\\w+(?:Error|Exception): .+");

    private final RunRepository repository;
    private final AirflowClient airflow;
    private final MlflowClient mlflow;
    private final RunProgressCalculator calculator;
    private final RunSnapshotStore snapshots;
    private final RunEventBroadcaster broadcaster;
    private final JsonMapper mapper;
    private final Clock clock;

    public RunMonitor(RunRepository repository, AirflowClient airflow, MlflowClient mlflow,
            RunProgressCalculator calculator, RunSnapshotStore snapshots, RunEventBroadcaster broadcaster,
            JsonMapper mapper, Clock clock) {
        this.repository = repository;
        this.airflow = airflow;
        this.mlflow = mlflow;
        this.calculator = calculator;
        this.snapshots = snapshots;
        this.broadcaster = broadcaster;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Scheduled(fixedDelay = 2000)
    public void poll() {
        for (Run run : repository.findByStatusIn(List.of(RunStatus.QUEUED, RunStatus.RUNNING))) {
            try {
                refresh(run);
            } catch (RuntimeException e) {
                log.warn("실행 {} 모니터링 실패, 다음 주기에 재시도: {}", run.getId(), e.getMessage());
            }
        }
    }

    private void refresh(Run run) {
        Instant now = clock.instant();
        AirflowTaskState state = airflow.fetchState(run.getDagRunId());

        boolean notebookChanged = false;
        boolean logChanged = false;
        List<String> executeLog = List.of();
        if (state.hasStarted(AirflowTaskState.EXECUTE_NOTEBOOK)) {
            notebookChanged = snapshots.refreshNotebook(run.getId());
            NotebookPayload notebook = snapshots.notebook(run.getId());
            run.updateCellCounts(notebook.completedCodeCellCount(), notebook.codeCellCount());
            try {
                executeLog = airflow.fetchLogTail(
                        run.getDagRunId(), AirflowTaskState.EXECUTE_NOTEBOOK, RunSnapshotStore.LOG_TAIL_LINES);
                logChanged = snapshots.updateLog(run.getId(), executeLog);
            } catch (RestClientException e) {
                executeLog = snapshots.log(run).lines();
            }
        }

        RunProgress progress = calculator.calculate(
                state, run.getExecutedCells(), run.getTotalCells(), run.getStage(), run.getProgress());
        run.applyProgress(progress.status(), progress.stage(), progress.progress(), now);
        if (progress.status() == RunStatus.FAILED) {
            run.setErrorMessage(failureMessage(run, state, executeLog));
        } else if (progress.stage() == RunStage.REGISTERING) {
            collectResult(run, now);
        }
        repository.save(run);

        if (notebookChanged) {
            broadcaster.publishNotebook(run.getId(), snapshots.notebook(run.getId()));
        }
        if (logChanged) {
            broadcaster.publishLog(run.getId(), snapshots.log(run));
        }
        RunResponse response = RunResponse.from(run, mapper);
        if (snapshots.updateRun(response)) {
            broadcaster.publishRun(run.getId(), response);
        }
    }

    private void collectResult(Run run, Instant now) {
        int attempts = run.incrementResultLookupAttempts();
        try {
            mlflow.findResult(run.getId()).ifPresent(run::applyResult);
        } catch (RestClientException e) {
            log.warn("실행 {} MLflow 결과 조회 실패({}회): {}", run.getId(), attempts, e.getMessage());
        }
        if (run.getRegisteredModelVersion() != null) {
            run.markSucceeded(now);
        } else if (attempts >= MAX_RESULT_LOOKUP_ATTEMPTS) {
            run.markSucceeded(now);
            run.setErrorMessage(MISSING_RESULT_MESSAGE);
        }
    }

    private String failureMessage(Run run, AirflowTaskState state, List<String> executeLog) {
        Optional<String> failedTask = state.failedTask();
        if (failedTask.isEmpty()) {
            return "DAG 실행 실패";
        }
        String taskId = failedTask.get();
        List<String> lines = AirflowTaskState.EXECUTE_NOTEBOOK.equals(taskId) ? executeLog : taskLog(run, taskId);
        return errorLine(lines).map(line -> taskId + " 실패: " + line).orElse(taskId + " 실패");
    }

    private List<String> taskLog(Run run, String taskId) {
        try {
            return airflow.fetchLogTail(run.getDagRunId(), taskId, RunSnapshotStore.LOG_TAIL_LINES);
        } catch (RestClientException e) {
            return List.of();
        }
    }

    /** Airflow 로그 마지막 줄은 보통 "Task exited with return code 1"이므로 예외 줄을 먼저 찾는다. */
    static Optional<String> errorLine(List<String> lines) {
        for (int i = lines.size() - 1; i >= 0; i--) {
            Matcher matcher = ERROR_LINE.matcher(lines.get(i));
            if (matcher.find()) {
                return Optional.of(matcher.group().strip());
            }
        }
        for (int i = lines.size() - 1; i >= 0; i--) {
            if (!lines.get(i).isBlank()) {
                return Optional.of(lines.get(i).strip());
            }
        }
        return Optional.empty();
    }
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests RunMonitorTest
```

Expected: PASS (8 tests). `UnnecessaryStubbingException`이 나면 해당 테스트가 스텁한 호출을 구현이 실제로 하지 않는다는 뜻이므로, 설계(4.9: `execute_notebook` 시작 후에만 로그 조회)와 구현 중 어느 쪽이 틀렸는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "feat: 실행 모니터(상태 수집·실패 메시지·MLflow 결과·변경 푸시)"
```

---

### Task 14: 실행 API, 오류 규약, CORS

**Files:**
- Create: `main/api/ApiError.java`, `main/api/ApiExceptionHandler.java`, `main/run/RunController.java`, `main/config/WebConfig.java`
- Test: `test/run/RunControllerTest.java`

**Interfaces:**
- Consumes: `RunService`, `Run`, `RunResponse`, `CreateRunRequest`(Task 9), `RunSnapshotStore`, `NotebookPayload`, `LogPayload`(Task 11), `RunEventBroadcaster`(Task 12), 예외 3종
- Produces (HTTP 계약, 프론트 Task 16이 사용):
  - `POST /api/runs` → 201 + `Location: /api/runs/{id}` + `RunResponse` / 400 `{"message"}` / 502 `{"message"}`
  - `GET /api/runs?assetId=` → 200 `RunResponse[]` 최신순
  - `GET /api/runs/{id}` → 200 / 404 `{"message"}`
  - `GET /api/runs/{id}/notebook` → `{"cells": NotebookCell[]}`
  - `GET /api/runs/{id}/log` → `{"lines": string[]}`
  - `GET /api/runs/{id}/stream` → `text/event-stream`
  - 400 메시지: 검증 실패 `"요청 값이 올바르지 않습니다: {필드들}"`, 본문 파싱 실패 `"요청 본문을 읽을 수 없습니다"`, 그 외 `InvalidRunRequestException` 메시지
  - CORS: `/api/**`, origin `prizm.cors.allowed-origins`, 메서드 GET·POST

- [ ] **Step 1: 실패하는 테스트 작성**

`test/run/RunControllerTest.java`:

```java
package com.prizm.backend.run;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.prizm.backend.TestFixtures;
import com.prizm.backend.api.ApiExceptionHandler;
import com.prizm.backend.api.InvalidRunRequestException;
import com.prizm.backend.api.RunNotFoundException;
import com.prizm.backend.api.RunTriggerException;
import com.prizm.backend.notebook.NotebookCell;
import com.prizm.backend.run.monitor.LogPayload;
import com.prizm.backend.run.monitor.NotebookPayload;
import com.prizm.backend.run.monitor.RunEventBroadcaster;
import com.prizm.backend.run.monitor.RunSnapshotStore;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@ExtendWith(MockitoExtension.class)
class RunControllerTest {

    private static final Instant REQUESTED_AT = Instant.parse("2026-09-17T14:02:11Z");
    private static final String BODY = """
            {"assetId": "PRJ000212-C-0001", "version": "v2.4.1",
             "parameters": {"epochs": 3, "batch_size": 4, "image_size": 320, "seed": 42},
             "resource": "ml.a100.20gb", "environment": "pytorch-2.4-yolo12-py311-cu124"}
            """;

    @Mock
    private RunService runService;
    @Mock
    private RunSnapshotStore snapshots;
    @Mock
    private RunEventBroadcaster broadcaster;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new RunController(runService, snapshots, broadcaster))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    private static RunResponse response(String id) {
        return new RunResponse(id, "PRJ000212-C-0001", "v2.4.1", "demo.door_defect_yolov8_training", "v2",
                Map.of("epochs", 3), "ml.a100.20gb", "pytorch-2.4-yolo12-py311-cu124", "이학선", "prizm_" + id,
                RunStatus.QUEUED, RunStage.PREPARING, 0, 0, 0, null, null, null, null, null,
                REQUESTED_AT, null, null);
    }

    private static Run run() {
        return Run.queued("RUN-27000", TestFixtures.weldAsset(), "{\"epochs\":3}", "ml.a100.20gb",
                "pytorch-2.4-yolo12-py311-cu124", "이학선", REQUESTED_AT);
    }

    @Test
    void createReturns201WithLocation() throws Exception {
        when(runService.create(any())).thenReturn(response("RUN-27000"));

        mockMvc.perform(post("/api/runs").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/runs/RUN-27000"))
                .andExpect(jsonPath("$.id").value("RUN-27000"))
                .andExpect(jsonPath("$.dagRunId").value("prizm_RUN-27000"))
                .andExpect(jsonPath("$.status").value("QUEUED"))
                .andExpect(jsonPath("$.requestedAt").value("2026-09-17T14:02:11Z"));

        ArgumentCaptor<CreateRunRequest> request = ArgumentCaptor.forClass(CreateRunRequest.class);
        verify(runService).create(request.capture());
        assertThat(request.getValue().parameters()).containsEntry("epochs", 3).containsEntry("batch_size", 4);
    }

    @Test
    void createReturns400WhenAssetIdMissing() throws Exception {
        mockMvc.perform(post("/api/runs").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":\"v2.4.1\",\"parameters\":{}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다: assetId"));

        verifyNoInteractions(runService);
    }

    @Test
    void createReturns400ForUnreadableBody() throws Exception {
        mockMvc.perform(post("/api/runs").contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("요청 본문을 읽을 수 없습니다"));
    }

    @Test
    void createReturns400ForUnknownAsset() throws Exception {
        when(runService.create(any()))
                .thenThrow(new InvalidRunRequestException("등록되지 않은 코드 자산입니다: PRJ000212-C-0001@v2.4.1"));

        mockMvc.perform(post("/api/runs").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("등록되지 않은 코드 자산입니다: PRJ000212-C-0001@v2.4.1"));
    }

    @Test
    void createReturns502WhenTriggerFails() throws Exception {
        when(runService.create(any())).thenThrow(new RunTriggerException("Airflow DAG 트리거 실패: Connection refused"));

        mockMvc.perform(post("/api/runs").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.message").value("Airflow DAG 트리거 실패: Connection refused"));
    }

    @Test
    void getReturns404ForUnknownRun() throws Exception {
        when(runService.get("RUN-1")).thenThrow(new RunNotFoundException("RUN-1"));

        mockMvc.perform(get("/api/runs/RUN-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("실행을 찾을 수 없습니다: RUN-1"));
    }

    @Test
    void listPassesAssetFilter() throws Exception {
        when(runService.list("PRJ000212-C-0001")).thenReturn(List.of(response("RUN-27000")));

        mockMvc.perform(get("/api/runs").param("assetId", "PRJ000212-C-0001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("RUN-27000"));
    }

    @Test
    void notebookReturnsSnapshotCells() throws Exception {
        when(runService.getEntity("RUN-27000")).thenReturn(run());
        when(snapshots.notebook("RUN-27000")).thenReturn(new NotebookPayload(List.of(
                new NotebookCell(0, "code", "epochs = 3", 1, "completed", List.of("parameters"), List.of()))));

        mockMvc.perform(get("/api/runs/RUN-27000/notebook"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cells[0].status").value("completed"))
                .andExpect(jsonPath("$.cells[0].tags[0]").value("parameters"));
    }

    @Test
    void logReturnsLines() throws Exception {
        Run run = run();
        when(runService.getEntity("RUN-27000")).thenReturn(run);
        when(snapshots.log(run)).thenReturn(new LogPayload(List.of("epoch 1/3")));

        mockMvc.perform(get("/api/runs/RUN-27000/log"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines[0]").value("epoch 1/3"));
    }

    @Test
    void streamSubscribesWithCurrentSnapshot() throws Exception {
        Run run = run();
        RunResponse response = response("RUN-27000");
        when(runService.getEntity("RUN-27000")).thenReturn(run);
        when(runService.toResponse(run)).thenReturn(response);
        when(snapshots.notebook("RUN-27000")).thenReturn(NotebookPayload.EMPTY);
        when(snapshots.log(run)).thenReturn(LogPayload.EMPTY);
        when(broadcaster.subscribe("RUN-27000", NotebookPayload.EMPTY, LogPayload.EMPTY, response))
                .thenReturn(new SseEmitter());

        mockMvc.perform(get("/api/runs/RUN-27000/stream").accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted());

        verify(broadcaster).subscribe("RUN-27000", NotebookPayload.EMPTY, LogPayload.EMPTY, response);
    }
}
```

- [ ] **Step 2: 실패 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test --tests RunControllerTest
```

Expected: FAIL — `cannot find symbol` (`RunController`, `ApiExceptionHandler`).

- [ ] **Step 3: 구현**

`main/api/ApiError.java`:

```java
package com.prizm.backend.api;

public record ApiError(String message) {
}
```

`main/api/ApiExceptionHandler.java`:

```java
package com.prizm.backend.api;

import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(InvalidRunRequestException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiError invalidRequest(InvalidRunRequestException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiError invalidBody(MethodArgumentNotValidException e) {
        String fields = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getField)
                .distinct()
                .sorted()
                .collect(Collectors.joining(", "));
        return new ApiError("요청 값이 올바르지 않습니다: " + fields);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiError unreadableBody(HttpMessageNotReadableException e) {
        return new ApiError("요청 본문을 읽을 수 없습니다");
    }

    @ExceptionHandler(RunNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiError notFound(RunNotFoundException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(RunTriggerException.class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    public ApiError triggerFailed(RunTriggerException e) {
        return new ApiError(e.getMessage());
    }
}
```

`main/run/RunController.java`:

```java
package com.prizm.backend.run;

import com.prizm.backend.run.monitor.LogPayload;
import com.prizm.backend.run.monitor.NotebookPayload;
import com.prizm.backend.run.monitor.RunEventBroadcaster;
import com.prizm.backend.run.monitor.RunSnapshotStore;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/runs")
public class RunController {

    private final RunService runService;
    private final RunSnapshotStore snapshots;
    private final RunEventBroadcaster broadcaster;

    public RunController(RunService runService, RunSnapshotStore snapshots, RunEventBroadcaster broadcaster) {
        this.runService = runService;
        this.snapshots = snapshots;
        this.broadcaster = broadcaster;
    }

    @PostMapping
    public ResponseEntity<RunResponse> create(@Valid @RequestBody CreateRunRequest request) {
        RunResponse response = runService.create(request);
        return ResponseEntity.created(URI.create("/api/runs/" + response.id())).body(response);
    }

    @GetMapping
    public List<RunResponse> list(@RequestParam(required = false) String assetId) {
        return runService.list(assetId);
    }

    @GetMapping("/{id}")
    public RunResponse get(@PathVariable String id) {
        return runService.get(id);
    }

    @GetMapping("/{id}/notebook")
    public NotebookPayload notebook(@PathVariable String id) {
        runService.getEntity(id);
        return snapshots.notebook(id);
    }

    @GetMapping("/{id}/log")
    public LogPayload log(@PathVariable String id) {
        return snapshots.log(runService.getEntity(id));
    }

    @GetMapping(path = "/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String id) {
        Run run = runService.getEntity(id);
        return broadcaster.subscribe(id, snapshots.notebook(id), snapshots.log(run), runService.toResponse(run));
    }
}
```

`main/config/WebConfig.java`:

```java
package com.prizm.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final PrizmProperties properties;

    public WebConfig(PrizmProperties properties) {
        this.properties = properties;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(properties.cors().allowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST");
    }
}
```

- [ ] **Step 4: 통과 확인 (전체)**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh" && ./gradlew test
```

Expected: PASS — 전체(Task 4~14). `createReturns201WithLocation`에서 `requestedAt`이 숫자로 나오면 Jackson 3 기본값이 바뀐 것이므로 `application.yml`에 `spring.jackson.serialization.write-dates-as-timestamps: false`를 추가하고, standalone 테스트는 `MockMvcBuilders…setMessageConverters(new JacksonJsonHttpMessageConverter(JsonMapper.builder().disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS).build()))`로 맞춘다.

- [ ] **Step 5: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "feat: 실행 REST·SSE API, 오류 응답 규약, CORS"
```

---

### Task 15: 백엔드 실연동 검증과 README (Docker 필요)

**Files:**
- Create: `BACKEND/README.md`
- 실패 시 원인이 된 Task의 파일을 수정

**Interfaces:**
- Consumes: Task 3에서 검증된 인프라, Task 4~14 백엔드
- Produces: 실제 Airflow·MLflow와 연결된 `http://localhost:8081` API(프론트 Task 16~20이 사용)

- [ ] **Step 1: 인프라 기동 확인과 백엔드 실행**

```bash
open -a Docker; until docker info >/dev/null 2>&1; do sleep 3; done
cd ~/Workspace/notebook/prototype && docker compose up -d minio minio-init ai-hub mlflow airflow
until curl -sf -u admin:admin localhost:8080/api/v1/health >/dev/null; do sleep 5; done
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh"
nohup ./gradlew bootRun > "$TMPDIR/prizm-backend.log" 2>&1 &
until curl -sf localhost:8081/api/runs >/dev/null; do sleep 2; done; echo backend up
```

Expected: `backend up`

- [ ] **Step 2: CORS와 400 응답 확인**

```bash
curl -s -i -H 'Origin: http://localhost:3000' localhost:8081/api/runs | grep -i '^access-control-allow-origin'
curl -s -w '\n%{http_code}\n' -X POST localhost:8081/api/runs -H 'Content-Type: application/json' \
  -d '{"assetId":"PRJ000212-C-0001","version":"v9.9.9","parameters":{"epochs":1,"batch_size":4,"image_size":320,"seed":42}}'
```

Expected: `Access-Control-Allow-Origin: http://localhost:3000`; `{"message":"등록되지 않은 코드 자산입니다: PRJ000212-C-0001@v9.9.9"}` + `400`

- [ ] **Step 3: 실제 실행 생성과 진행 관찰**

```bash
ID=$(curl -s -X POST localhost:8081/api/runs -H 'Content-Type: application/json' \
  -d '{"assetId":"PRJ000212-C-0001","version":"v2.4.1","parameters":{"epochs":2,"batch_size":4,"image_size":320,"seed":42},"resource":"ml.a100.20gb","environment":"pytorch-2.4-yolo12-py311-cu124"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "$ID"
curl -s -N --max-time 15 "localhost:8081/api/runs/$ID/stream" | grep '^event:' | head -5
LAST=""
for i in $(seq 1 400); do
  NOW=$(curl -s "localhost:8081/api/runs/$ID" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r['status'], r['stage'], r['progress'], f\"{r['executedCells']}/{r['totalCells']}\", r['registeredModelVersion'], r['map50'], r['errorMessage'])")
  [ "$NOW" != "$LAST" ] && echo "$(date +%H:%M:%S) $NOW" && LAST="$NOW"
  case "$NOW" in SUCCEEDED*|FAILED*) break;; esac
  sleep 3
done
```

Expected: `RUN-27000` 형식 ID, 스트림 첫 이벤트가 `event:notebook`, `event:log`, `event:run` 순서(진행 중인 실행에 나중에 붙어도 전체 스냅샷을 먼저 받는다 = SSE 재연결 동작). 상태가 `QUEUED PREPARING 0` → `RUNNING PREPARING 5`/`DATA 10`/`DATA 24` → `RUNNING TRAINING …`(셀 수가 증가) → `RUNNING REGISTERING 95` → `SUCCEEDED DONE 100 … <버전> <mAP50> None` 순으로 바뀐다. 실패하면 `$TMPDIR/prizm-backend.log`와 `errorMessage`로 원인을 확인한다.

- [ ] **Step 4: 노트북·로그 API와 재시작 후 유지 확인**

```bash
curl -s "localhost:8081/api/runs/$ID/notebook" | python3 -c "import json,sys; c=json.load(sys.stdin)['cells']; print(len(c), sorted({x['status'] for x in c}), [x['tags'] for x in c if 'injected-parameters' in x['tags']])"
curl -s "localhost:8081/api/runs/$ID/log" | python3 -c "import json,sys; l=json.load(sys.stdin)['lines']; print(len(l), l[-1] if l else None)"
pkill -f 'com.prizm.backend.PrizmBackendApplication' || pkill -f 'gradlew bootRun'
sleep 3
source "$HOME/.sdkman/bin/sdkman-init.sh" && nohup ./gradlew bootRun > "$TMPDIR/prizm-backend.log" 2>&1 &
until curl -sf localhost:8081/api/runs >/dev/null; do sleep 2; done
curl -s "localhost:8081/api/runs/$ID" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r['status'], r['registeredModelVersion'], r['map50'])"
```

Expected: 셀 목록(상태 `completed`만), injected-parameters 태그 셀 1개, 로그 줄 수 > 0, 재시작 후에도 `SUCCEEDED <버전> <mAP50>`. 진행 중인 실행이 있는 상태에서 재시작하면 `$TMPDIR/prizm-backend.log`에 모니터가 그 실행을 계속 갱신하는 로그가 남고 진행률이 다시 올라간다(설계 4.9의 재개 동작).

- [ ] **Step 5: Airflow 중단 시 502 확인**

```bash
cd ~/Workspace/notebook/prototype && docker compose stop airflow
curl -s -w '\n%{http_code}\n' -X POST localhost:8081/api/runs -H 'Content-Type: application/json' \
  -d '{"assetId":"PRJ000212-C-0001","version":"v2.4.1","parameters":{"epochs":1,"batch_size":4,"image_size":320,"seed":42}}'
docker compose start airflow
```

Expected: `{"message":"Airflow DAG 트리거 실패: ..."}` + `502`. 이 실행은 `FAILED`로 목록에 남는다.

- [ ] **Step 6: README 작성**

`BACKEND/README.md`:

````markdown
# prizm-backend

PRIZM 포털의 "즉시 실행"을 실제 Airflow DAG(papermill)로 실행하고, 실행 중인 노트북 셀·로그·MLflow 결과를 SSE로 전달하는 Spring Boot 백엔드.

- 설계: `prizm-portal/docs/superpowers/specs/2026-09-17-airflow-live-run-design.md`
- 포트 8081, H2 파일 DB `./data/prizm-backend`

## 요구 사항

- JDK 21 (SDKMAN: `sdk install java 21.x.x-tem`)
- `~/Workspace/notebook/prototype`의 Docker 스택(Airflow 8080, MLflow 5050, AI Hub 8000)과 노트북 v2 등록

## 실행

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
./gradlew bootRun
```

## 테스트

```bash
./gradlew test
```

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/runs` | 실행 생성 + DAG 트리거 (201 / 400 / 502) |
| GET | `/api/runs?assetId=` | 실행 목록(최신순) |
| GET | `/api/runs/{id}` | 단건 |
| GET | `/api/runs/{id}/notebook` | 최신 노트북 스냅샷 |
| GET | `/api/runs/{id}/log` | `execute_notebook` 로그 끝 200줄 |
| GET | `/api/runs/{id}/stream` | SSE `notebook` · `log` · `run` |

## 설정

`src/main/resources/application.yml`의 `prizm.*` — Airflow·MLflow 주소, 실행 스냅샷 폴더(`runs-dir`), CORS, 자산 매핑(`code-assets`).
````

- [ ] **Step 7: 커밋과 원격 저장소 연결 (사용자 작업 포함)**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
git add -A
git commit -m "docs: 백엔드 실행·API 안내"
git log --oneline | head -15
```

원격 push는 사용자가 github.com에서 빈 저장소 `prizm-backend`를 만든 뒤에만 한다(`gh` CLI 없음). 저장소 URL을 받으면:

```bash
git remote add origin <사용자가 알려준 URL>
git push -u origin main
```

---

## Part C — 프론트엔드 (`PORTAL`)

모든 명령은 `cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal`에서 실행하고, 현재 브랜치가 `feature/airflow-live-run`인지 먼저 확인한다(`git branch --show-current`).

### Task 16: 백엔드 API 클라이언트와 SSE 구독 훅

**Files:**
- Create: `lib/prizm-api.ts`, `hooks/use-run-stream.ts`

**Interfaces:**
- Consumes: Task 14 HTTP 계약
- Produces:
  - 타입 `RunStatus`, `RunStage`, `RunParameters = { epochs: number; batch_size: number; image_size: number; seed: number }`, `Run`(백엔드 `RunResponse` 23개 필드), `CellOutput`(판별 유니온 `stream`·`text`·`image`·`error`), `NotebookCell`, `CreateRunInput`
  - 상수 `PRIZM_API_BASE`, `MLFLOW_UI_BASE = 'http://localhost:5050'`
  - `class PrizmApiError extends Error`
  - `createRun(input: CreateRunInput): Promise<Run>` — 연결 실패 시 `PrizmApiError('실행 서버(8081)에 연결할 수 없습니다')`, 4xx/5xx면 응답 `message`
  - `listRuns(assetId?: string): Promise<Run[]>`, `runStreamUrl(runId: string): string`, `isFinishedRun(run: Pick<Run, 'status'>): boolean`
  - `useRunStream(initialRun: Run): { run: Run; cells: NotebookCell[]; log: string[]; connected: boolean }` — 종료 상태 `run` 수신 시 연결 종료. 다른 실행을 보여줄 때는 호출 컴포넌트를 `key`로 다시 만든다.

- [ ] **Step 1: 기준선 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
git branch --show-current
npx tsc --noEmit && echo TSC_OK
npx oxlint components/code-assets-workspace.tsx | grep -c error
```

Expected: `feature/airflow-live-run`, `TSC_OK`, `14` (이후 이 파일의 기준값)

- [ ] **Step 2: `lib/prizm-api.ts` 작성**

```ts
export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type RunStage = 'PREPARING' | 'DATA' | 'TRAINING' | 'REGISTERING' | 'DONE';

export type RunParameters = { epochs: number; batch_size: number; image_size: number; seed: number };

export type Run = {
  id: string;
  assetId: string;
  assetVersion: string;
  codeKey: string;
  codeVersion: string;
  parameters: Record<string, number>;
  resource: string;
  environment: string;
  requestedBy: string;
  dagRunId: string;
  status: RunStatus;
  stage: RunStage;
  progress: number;
  executedCells: number;
  totalCells: number;
  mlflowRunId: string | null;
  map50: number | null;
  registeredModelName: string | null;
  registeredModelVersion: string | null;
  errorMessage: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type CellOutput =
  | { type: 'stream'; name: string; text: string }
  | { type: 'text'; text: string }
  | { type: 'image'; imagePng: string }
  | { type: 'error'; ename: string; evalue: string; traceback: string[] };

export type NotebookCell = {
  index: number;
  cellType: 'code' | 'markdown';
  source: string;
  executionCount: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  tags: string[];
  outputs: CellOutput[];
};

export type CreateRunInput = {
  assetId: string;
  version: string;
  parameters: RunParameters;
  resource: string;
  environment: string;
};

function configuredApiBase(): string | undefined {
  try {
    // vinext는 정의된 NEXT_PUBLIC_* 값만 빌드 시 문자열로 치환한다.
    // 정의되지 않았으면 브라우저에 process가 없어 ReferenceError가 나므로 기본값으로 대체한다.
    return process.env.NEXT_PUBLIC_PRIZM_API_BASE;
  } catch {
    return undefined;
  }
}

export const PRIZM_API_BASE = configuredApiBase() || 'http://localhost:8081';
export const MLFLOW_UI_BASE = 'http://localhost:5050';

export class PrizmApiError extends Error {}

export async function createRun(input: CreateRunInput): Promise<Run> {
  let response: Response;
  try {
    response = await fetch(`${PRIZM_API_BASE}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new PrizmApiError('실행 서버(8081)에 연결할 수 없습니다');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new PrizmApiError(body?.message ?? `실행 요청에 실패했습니다 (${response.status})`);
  }
  return (await response.json()) as Run;
}

export async function listRuns(assetId?: string): Promise<Run[]> {
  const query = assetId ? `?assetId=${encodeURIComponent(assetId)}` : '';
  const response = await fetch(`${PRIZM_API_BASE}/api/runs${query}`);
  if (!response.ok) throw new PrizmApiError(`실행 목록을 불러오지 못했습니다 (${response.status})`);
  return (await response.json()) as Run[];
}

export function runStreamUrl(runId: string) {
  return `${PRIZM_API_BASE}/api/runs/${encodeURIComponent(runId)}/stream`;
}

export function isFinishedRun(run: Pick<Run, 'status'>) {
  return run.status === 'SUCCEEDED' || run.status === 'FAILED';
}
```

- [ ] **Step 3: `hooks/use-run-stream.ts` 작성**

```ts
'use client';

import { useEffect, useState } from 'react';
import { isFinishedRun, runStreamUrl, type NotebookCell, type Run } from '@/lib/prizm-api';

export type RunStreamState = { run: Run; cells: NotebookCell[]; log: string[]; connected: boolean };

/** 실행 하나의 SSE를 구독한다. 다른 실행을 보여줄 때는 호출 컴포넌트를 key로 다시 만든다. */
export function useRunStream(initialRun: Run): RunStreamState {
  const [state, setState] = useState<RunStreamState>({ run: initialRun, cells: [], log: [], connected: false });
  const runId = initialRun.id;

  useEffect(() => {
    const source = new EventSource(runStreamUrl(runId));
    source.onopen = () => setState((current) => ({ ...current, connected: true }));
    source.onerror = () => setState((current) => ({ ...current, connected: false }));
    source.addEventListener('notebook', (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as { cells: NotebookCell[] };
      setState((current) => ({ ...current, cells: payload.cells }));
    });
    source.addEventListener('log', (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as { lines: string[] };
      setState((current) => ({ ...current, log: payload.lines }));
    });
    // 백엔드는 notebook·log 다음에 run을 보낸다. 종료 상태면 셀·로그를 받은 뒤 연결을 닫는다.
    source.addEventListener('run', (event: MessageEvent<string>) => {
      const run = JSON.parse(event.data) as Run;
      const finished = isFinishedRun(run);
      if (finished) source.close();
      setState((current) => ({ ...current, run, connected: finished ? false : current.connected }));
    });
    return () => source.close();
  }, [runId]);

  return state;
}
```

- [ ] **Step 4: 타입·린트 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
npx tsc --noEmit && echo TSC_OK
npx oxlint lib/prizm-api.ts hooks/use-run-stream.ts
```

Expected: `TSC_OK`, oxlint `Found 0 warnings and 0 errors`(오류 0건). 오류가 나면 규칙 이름에 맞춰 코드를 고친다(`eslint-disable` 주석 추가 금지).

- [ ] **Step 5: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
git add lib/prizm-api.ts hooks/use-run-stream.ts
git commit -m "feat: PRIZM 실행 백엔드 API 클라이언트와 SSE 구독 훅"
```

---

### Task 17: 실시간 노트북 셀 렌더러

**Files:**
- Create: `components/live-notebook.tsx`
- Modify: `app/prizm-design-system.css` (파일 끝에 `live-notebook-*` 추가)

**Interfaces:**
- Consumes: `NotebookCell`, `CellOutput`(Task 16)
- Produces: `LiveNotebook({ cells }: { cells: NotebookCell[] })` — 코드 셀(실행 번호·상태 배지·소스·출력), 마크다운 셀(`#` 제목과 본문 텍스트), `parameters`/`injected-parameters` 셀 배지 "Papermill 주입 파라미터", 실행 중 셀 강조와 자동 스크롤(사용자가 위로 휠 스크롤하면 중지, 맨 아래 근처로 돌아오면 재개). 셀 요소에 `data-cell-index`, 출력 클래스 `live-notebook-stream`·`live-notebook-text`·`live-notebook-image`·`live-notebook-error`(Task 20 Playwright가 사용).

- [ ] **Step 1: 컴포넌트 작성**

`components/live-notebook.tsx`:

```tsx
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
```

- [ ] **Step 2: 스타일 추가**

`app/prizm-design-system.css` 파일 끝에 추가:

```css
/* ── Live notebook (실제 Airflow 실행 스냅샷) ───────────────────────── */
.live-notebook { position: relative; height: min(72vh, 54rem); overflow-y: auto; padding: 1rem; display: grid; align-content: start; gap: .75rem; background: #fbfbfa; }
.live-notebook-empty { padding: 3rem 1rem; color: var(--muted); font-size: .8rem; text-align: center; }
.live-notebook-cell { min-width: 0; background: white; border: 1px solid var(--line); border-radius: .5rem; overflow: hidden; }
.live-notebook-cell.is-markdown { padding: .75rem 1rem; background: transparent; border-color: transparent; }
.live-notebook-cell.is-running { border-color: var(--active-blue); box-shadow: 0 0 0 3px rgba(0,170,210,.12); }
.live-notebook-cell.is-failed { border-color: #e5a3a3; box-shadow: 0 0 0 3px rgba(209,67,67,.1); }
.live-notebook-cell.is-pending { opacity: .62; }
.live-notebook-cell > header { min-height: 2.1rem; padding: .35rem .75rem; display: flex; align-items: center; gap: .5rem; background: #f6f6f4; border-bottom: 1px solid var(--line); }
.live-notebook-count { color: #6c7f8b; font: 600 .72rem/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.live-notebook-param-badge { padding: .15rem .45rem; color: var(--hyundai-blue); background: rgba(0,44,95,.07); border-radius: 999px; font-size: .68rem; font-weight: 620; }
.live-notebook-status { margin-left: auto; padding: .15rem .45rem; border-radius: 999px; background: #eef0f2; color: #5c6b75; font-size: .68rem; font-weight: 620; }
.live-notebook-status.is-completed { background: #e7f4ef; color: #357865; }
.live-notebook-status.is-running { background: rgba(0,170,210,.12); color: #006d88; }
.live-notebook-status.is-failed { background: #fbeaea; color: #b42318; }
.live-notebook-source,
.live-notebook-stream,
.live-notebook-text,
.live-notebook-error { margin: 0; padding: .7rem .9rem; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font: .74rem/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
.live-notebook-source { color: var(--ink); }
.live-notebook-outputs { border-top: 1px dashed var(--line); }
.live-notebook-stream { color: #33424b; }
.live-notebook-stream.is-stderr { color: #7a5b1f; background: #fffaf0; }
.live-notebook-error { color: #b42318; background: #fdf3f3; }
.live-notebook-image { width: 100%; max-width: 40rem; height: auto; padding: .7rem .9rem; display: block; }
.live-notebook-markdown p { margin: 0 0 .35rem; color: var(--muted); font-size: .8rem; line-height: 1.6; }
.live-notebook-markdown .live-notebook-heading { color: var(--ink); font-weight: 650; }
.live-notebook-markdown .live-notebook-heading.level-1 { font-size: 1.05rem; }
.live-notebook-markdown .live-notebook-heading.level-2 { font-size: .95rem; }
.live-notebook-markdown .live-notebook-heading.level-3 { font-size: .86rem; }
```

- [ ] **Step 3: 타입·린트 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
npx tsc --noEmit && echo TSC_OK
npx oxlint components/live-notebook.tsx
```

Expected: `TSC_OK`, 오류 0건. `jsx-a11y` 규칙이 `onWheel`/`onScroll`이 붙은 `div`를 오류로 보고하면, 컨테이너를 `<section aria-label="실시간 노트북 셀" …>`으로 바꾸고 다시 확인한다.

- [ ] **Step 4: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
git add components/live-notebook.tsx app/prizm-design-system.css
git commit -m "feat: 실시간 노트북 셀 렌더러"
```

---

### Task 18: 실제 실행 상세 화면

**Files:**
- Create: `components/live-run-detail.tsx`
- Modify: `app/prizm-design-system.css` (파일 끝에 `live-run-*` 추가)

**Interfaces:**
- Consumes: `useRunStream`, `Run`, `RunStage`, `MLFLOW_UI_BASE`(Task 16), `LiveNotebook`(Task 17)
- Produces: `LiveRunDetail({ run, title, project, onBack }: { run: Run; title: string; project: string; onBack: () => void })` — `PortalDetailFrame` 안에 넣는 조각(fragment). 진행 카드(실제 진행률·4단계 트랙·실패 표시), 실시간 노트북, 실행 조건 패널, Airflow 로그(접이식), `SUCCEEDED` 결과 스트립(클래스 `live-run-result`: mAP50, `{모델} v{N}`, 주 버튼 "모델 자산 확인" → `/assets/models`, 보조 링크 "MLflow 원본"). "동일 조건으로 다시 실행"·"실행 중지"는 비활성.

- [ ] **Step 1: 컴포넌트 작성**

`components/live-run-detail.tsx`:

```tsx
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
```

- [ ] **Step 2: 스타일 추가**

`app/prizm-design-system.css` 파일 끝에 추가:

```css
/* ── Live run detail ───────────────────────────────────────────── */
.run-live-dot.is-failed { background: #d14343; animation: none; }
.run-stage-track span.is-failed { color: #b42318; font-weight: 620; }
.live-run-progress.is-failed { border-color: #e5a3a3; }
.live-run-progress.is-failed .run-large-progress i { background: #d14343; }
.run-header-actions button:disabled { cursor: not-allowed; opacity: .5; }
.live-run-result-actions { display: flex; align-items: center; gap: .6rem; }
.live-run-result-actions a { display: inline-flex; align-items: center; gap: .3rem; font-size: .76rem; font-weight: 620; white-space: nowrap; }
.live-run-result-actions a:first-child { height: 2.3rem; padding: 0 .8rem; color: white; background: var(--hyundai-blue); border-radius: .35rem; }
.live-run-result-actions a:last-child:not(:first-child) { color: var(--muted); text-decoration: underline; text-underline-offset: 2px; }
.pipeline-status.state-실패 { color: #b42318; }
.pipeline-status.state-실패 i { background: #d14343; }
.execution-sheet-footer:has(.execution-run-error) { flex-wrap: wrap !important; }
.execution-run-error { flex-basis: 100%; margin: 0; padding: .55rem .75rem; color: #b42318; background: #fdf3f3; border: 1px solid #f1c4c4; border-radius: .35rem; font-size: .76rem; }
```

- [ ] **Step 3: 타입·린트 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
npx tsc --noEmit && echo TSC_OK
npx oxlint components/live-run-detail.tsx
```

Expected: `TSC_OK`, 오류 0건. `restrict-template-expressions`가 나오면 템플릿에 들어간 `string | null` 값을 `?? ''`로 좁힌다.

- [ ] **Step 4: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
git add components/live-run-detail.tsx app/prizm-design-system.css
git commit -m "feat: 실제 실행 상세 화면(진행·노트북·로그·결과)"
```

---

### Task 19: 코드 자산 워크스페이스 연동

**Files:**
- Modify: `components/code-assets-workspace.tsx` (아래 앵커 문자열 기준. 모든 앵커는 파일에서 1회만 등장함을 확인했다)

**Interfaces:**
- Consumes: `createRun`, `listRuns`, `isFinishedRun`, `PrizmApiError`, `Run`, `RunParameters`(Task 16), `LiveRunDetail`(Task 18)
- Produces: 화면 동작 — 시트 파라미터 controlled(기본 3·4·320·42), "즉시 실행" = 사전 점검 애니메이션 → `createRun` → 실행 상세 이동(실패 시 시트 하단 오류), 실험 대시보드에 live run 병합(진행 중 live run이 있을 때만 5초 재조회), live run 상세는 `LiveRunDetail`, mock 진행 타이머는 mock run에만 적용.

- [ ] **Step 1: import 추가**

앵커 `import { AssetSdkDialog } from '@/components/asset-sdk-dialog';`를 아래로 바꾼다.

```tsx
import { AssetSdkDialog } from '@/components/asset-sdk-dialog';
import { LiveRunDetail } from '@/components/live-run-detail';
import { createRun, isFinishedRun, listRuns, PrizmApiError, type Run, type RunParameters } from '@/lib/prizm-api';
```

- [ ] **Step 2: `RunRecord` 확장과 변환 함수 추가**

앵커

```tsx
  status: '요청 접수' | '자원 준비' | '실행 중' | '완료';
  mode: '즉시 실행' | '예약 실행';
  requestedAt: string;
  progress: number;
};
```

를 아래로 바꾼다.

```tsx
  status: '요청 접수' | '자원 준비' | '실행 중' | '완료' | '실패';
  mode: '즉시 실행' | '예약 실행';
  requestedAt: string;
  progress: number;
  source: 'mock' | 'live';
  live?: Run;
};

type RunParameterName = keyof RunParameters;

const runParameterNames: RunParameterName[] = ['epochs', 'batch_size', 'image_size', 'seed'];

function liveRunStatus(run: Run): RunRecord['status'] {
  if (run.status === 'QUEUED') return '요청 접수';
  if (run.status === 'SUCCEEDED') return '완료';
  if (run.status === 'FAILED') return '실패';
  return run.stage === 'PREPARING' || run.stage === 'DATA' ? '자원 준비' : '실행 중';
}

function formatRunRequestedAt(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toRunRecord(run: Run, assets: CodeAsset[]): RunRecord {
  const asset = assets.find((item) => item.id === run.assetId);
  return {
    id: run.id,
    assetId: run.assetId,
    project: asset?.project ?? '용접 품질 고도화',
    title: asset?.title ?? run.codeKey,
    version: run.assetVersion,
    data: 'demo.door_defect · v1',
    environment: run.environment,
    resource: run.resource,
    status: liveRunStatus(run),
    mode: '즉시 실행',
    requestedAt: formatRunRequestedAt(run.requestedAt),
    progress: run.progress,
    source: 'live',
    live: run,
  };
}
```

- [ ] **Step 3: mock 실행 레코드에 `source` 표시**

앵커 `requestedAt: '09.08 09:42', progress: 100 },` → `requestedAt: '09.08 09:42', progress: 100, source: 'mock' },`

앵커 `requestedAt: '09.06 02:00', progress: 100 },` → `requestedAt: '09.06 02:00', progress: 100, source: 'mock' },`

- [ ] **Step 4: 실행 설정 상태 추가**

앵커 `  const [executionRuntime, setExecutionRuntime] = useState('yolo12-14');`를 아래로 바꾼다.

```tsx
  const [executionRuntime, setExecutionRuntime] = useState('yolo12-14');
  const [runParameterInputs, setRunParameterInputs] = useState<Record<RunParameterName, string>>({ epochs: '3', batch_size: '4', image_size: '320', seed: '42' });
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
```

- [ ] **Step 5: 진행 타이머를 mock 전용으로 바꾸고 live 목록 조회 추가**

앵커

```tsx
  const hasActiveRuns = runRecords.some((run) => run.status !== '완료');

  useEffect(() => {
    if (!hasActiveRuns) return;
    const timer = window.setInterval(() => {
      setRunRecords((current) => current.map((run) => {
        if (run.status === '완료') return run;
```

를 아래로 바꾼다.

```tsx
  // 시연용 mock run만 진행을 시뮬레이션한다. live run은 백엔드 값을 그대로 쓴다.
  const hasActiveMockRuns = runRecords.some((run) => run.source === 'mock' && run.status !== '완료');
  const hasActiveLiveRuns = runRecords.some((run) => run.live !== undefined && !isFinishedRun(run.live));

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listRuns()
        .then((runs) => {
          if (cancelled) return;
          setRunRecords((current) => [...runs.map((run) => toRunRecord(run, initialAssets)), ...current.filter((record) => record.source === 'mock')]);
        })
        .catch(() => undefined); // 실행 서버가 꺼져 있으면 mock 목록만 보여준다
    };
    load();
    const timer = hasActiveLiveRuns ? window.setInterval(load, 5000) : undefined;
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [hasActiveLiveRuns]);

  useEffect(() => {
    if (!hasActiveMockRuns) return;
    const timer = window.setInterval(() => {
      setRunRecords((current) => current.map((run) => {
        if (run.source !== 'mock' || run.status === '완료') return run;
```

그리고 앵커 `  }, [hasActiveRuns]);` → `  }, [hasActiveMockRuns]);`

- [ ] **Step 6: 실행 상세 URL이 새 실행 ID를 쓰도록 수정**

앵커 `const navigateWorkspace = (nextScreen: WorkspaceScreen) => {` → `const navigateWorkspace = (nextScreen: WorkspaceScreen, runId = activeRunId) => {`

앵커 ``if (nextScreen === 'run') window.history.replaceState(null, '', `/assets/code?run=${activeRunId}`);`` → ``if (nextScreen === 'run') window.history.replaceState(null, '', `/assets/code?run=${runId}`);``

앵커 `onOpenRun={(id) => { setActiveRunId(id); navigateWorkspace('run'); }}` → `onOpenRun={(id) => { setActiveRunId(id); navigateWorkspace('run', id); }}`

- [ ] **Step 7: `beginRun`을 실제 실행 호출로 교체**

앵커(740~767행 전체)

```tsx
  const beginRun = () => {
    const runId = `RUN-${26902 + runRecords.length}`;
    const newRun: RunRecord = {
      id: runId, assetId: selectedAsset.id, project: selectedAsset.project, title: selectedAsset.title, version: selectedVersion,
      data: 'PRJ000212-D-0001 · 최신 버전',
      environment: executionRuntime === 'yolo12-14' ? 'pytorch-2.4-yolo12-py311-cu124' : 'pytorch-2.4-vision-py312-cu124',
      resource: executionResource === 'a100-10' ? 'ml.a100.10gb' : executionResource === 'a100-20' ? 'ml.a100.20gb' : 'ml.a100.48gb',
      status: '요청 접수', mode: '즉시 실행', requestedAt: '방금', progress: 4,
    };
    setRunRecords((current) => [newRun, ...current]);
    setActiveRunId(runId);
    setPipelineView('runs');
    setExecutionOpen(false);
    setNotice('코드 실행이 요청되었습니다. Airflow에서 실행 준비를 시작합니다.');
  };

  const launchWithPreflight = () => {
    if (preflightPassed) {
      beginRun();
      return;
    }
    setPreflightRunning(true);
    window.setTimeout(() => {
      setPreflightRunning(false);
      setPreflightPassed(true);
      beginRun();
    }, 700);
  };
```

를 아래로 바꾼다.

```tsx
  const beginRun = async () => {
    setRunSubmitting(true);
    setRunError(null);
    try {
      const run = await createRun({
        assetId: selectedAsset.id,
        version: selectedVersion,
        // 빈 값·소수는 NaN/정수가 아닌 값으로 전송되어 백엔드가 400 메시지를 돌려준다
        parameters: {
          epochs: Number(runParameterInputs.epochs),
          batch_size: Number(runParameterInputs.batch_size),
          image_size: Number(runParameterInputs.image_size),
          seed: Number(runParameterInputs.seed),
        },
        environment: executionRuntime === 'yolo12-14' ? 'pytorch-2.4-yolo12-py311-cu124' : 'pytorch-2.4-vision-py312-cu124',
        resource: executionResource === 'a100-10' ? 'ml.a100.10gb' : executionResource === 'a100-20' ? 'ml.a100.20gb' : 'ml.a100.48gb',
      });
      setRunRecords((current) => [toRunRecord(run, assets), ...current.filter((record) => record.id !== run.id)]);
      setActiveRunId(run.id);
      setPipelineView('runs');
      setExecutionOpen(false);
      setNotice('코드 실행이 요청되었습니다. Airflow에서 실행 준비를 시작합니다.');
      navigateWorkspace('run', run.id);
    } catch (error) {
      setRunError(error instanceof PrizmApiError ? error.message : '실행 요청 중 알 수 없는 오류가 발생했습니다');
    } finally {
      setRunSubmitting(false);
    }
  };

  const launchWithPreflight = () => {
    if (preflightPassed) {
      void beginRun();
      return;
    }
    setPreflightRunning(true);
    window.setTimeout(() => {
      setPreflightRunning(false);
      setPreflightPassed(true);
      void beginRun();
    }, 700);
  };
```

- [ ] **Step 8: 대시보드 "실행 중" 집계에서 실패 제외**

앵커 `projectRuns.filter((run) => run.status !== '완료').length` → `projectRuns.filter((run) => run.status !== '완료' && run.status !== '실패').length`

- [ ] **Step 9: 실행 상세 분기**

앵커 `{!visionDemoOpen && screen === 'run' && <PortalDetailFrame className="run-detail-page">`를 아래로 바꾼다.

```tsx
{!visionDemoOpen && screen === 'run' && <PortalDetailFrame className="run-detail-page">{activeRun.live ? <LiveRunDetail key={activeRun.id} run={activeRun.live} title={activeRun.title} project={activeRun.project} onBack={() => navigateWorkspace('pipeline')} /> : <>
```

그리고 앵커(줄바꿈 포함)

```tsx
모델 자산 확인 <ArrowRight size={14} /></button></section>}
        </PortalDetailFrame>}
```

를 아래로 바꾼다.

```tsx
모델 자산 확인 <ArrowRight size={14} /></button></section>}
        </>}</PortalDetailFrame>}
```

- [ ] **Step 10: 실행 설정 시트 파라미터·예상 시간·오류·버튼**

앵커(한 줄)

```tsx
<div className="parameter-grid parameter-asset-grid"><label><span>data_id</span><input type="text" defaultValue="PRJ000212-D-0001" /></label><label><span>model_id</span><input type="text" defaultValue="PRJ000001-M-0012" /></label><label><span>model_version</span><input type="text" defaultValue="v12.0.0" /></label></div><div className="parameter-grid parameter-value-grid"><label><span>epochs</span><input type="number" defaultValue="80" /></label><label><span>batch_size</span><input type="number" defaultValue="16" /></label><label><span>image_size</span><input type="number" defaultValue="1024" /></label><label><span>seed</span><input type="number" defaultValue="42" /></label></div>
```

를 아래로 바꾼다.

```tsx
<div className="parameter-grid parameter-asset-grid"><label><span>data_id</span><input type="text" value="PRJ000212-D-0001" readOnly /></label><label><span>model_id</span><input type="text" value="PRJ000001-M-0012" readOnly /></label><label><span>model_version</span><input type="text" value="v12.0.0" readOnly /></label></div><div className="parameter-grid parameter-value-grid">{runParameterNames.map((name) => <label key={name}><span>{name}</span><input type="number" min={1} step={1} value={runParameterInputs[name]} onChange={(event) => { const { value } = event.target; setRunParameterInputs((current) => ({ ...current, [name]: value })); }} /></label>)}</div>
```

앵커 `<strong>약 1시간 45분</strong>` → `<strong>약 3~5분 (CPU)</strong>`

앵커 `<SheetFooter className="execution-sheet-footer">` → `<SheetFooter className="execution-sheet-footer">{runError && <p className="execution-run-error" role="alert">{runError}</p>}`

앵커 `disabled={preflightRunning} onClick={launchWithPreflight}><Play size={14} fill="currentColor" /> 즉시 실행</button>` → `disabled={preflightRunning || runSubmitting} onClick={launchWithPreflight}><Play size={14} fill="currentColor" /> {runSubmitting ? '실행 요청 중' : '즉시 실행'}</button>`

- [ ] **Step 11: 타입·린트 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
grep -c "hasActiveRuns" components/code-assets-workspace.tsx
npx tsc --noEmit && echo TSC_OK
npx oxlint components/code-assets-workspace.tsx | grep -c error
npx oxlint lib/prizm-api.ts hooks/use-run-stream.ts components/live-notebook.tsx components/live-run-detail.tsx
```

Expected: `0`, `TSC_OK`, `14` 이하, 신규 파일 오류 0건. 워크스페이스 파일 오류가 늘었으면 `npx oxlint components/code-assets-workspace.tsx`로 새 오류 줄 번호를 보고 이번 변경분만 고친다.

- [ ] **Step 12: 개발 서버 렌더링 확인**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
lsof -ti tcp:3000 >/dev/null || nohup npm run dev > "$TMPDIR/prizm-portal.log" 2>&1 &
until curl -s -o /dev/null -w '%{http_code}' localhost:3000/assets/code | grep -q 200; do sleep 2; done
curl -s -o /dev/null -w '%{http_code}\n' "localhost:3000/assets/code?pipeline=1"
grep -iE "error|failed to" "$TMPDIR/prizm-portal.log" | tail -5
```

Expected: `200`, 로그에 컴파일 오류 없음. 화면 동작(기본값·백엔드 미기동 오류·실시간 상세)은 Task 20 Playwright에서 확인한다. 개발 서버는 Task 20에서 계속 쓰므로 켜 둔다.

- [ ] **Step 13: 커밋**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
git add components/code-assets-workspace.tsx
git commit -m "feat: 즉시 실행을 실제 Airflow 실행과 실시간 상세 화면에 연결"
```

---

### Task 20: E2E 완료 기준 검증 (Docker 필요)

**Files:**
- Create(저장소 밖): `$TMPDIR/prizm-e2e/package.json`, `$TMPDIR/prizm-e2e/e2e.mjs`, 스크린샷 `$TMPDIR/prizm-e2e/shots/*.png`
- 실패 시 원인이 된 Task의 파일을 수정

**Interfaces:**
- Consumes: Part A·B·C 전체
- Produces: 설계 8.4 완료 기준 1~6의 증거(명령 출력·스크린샷)

- [ ] **Step 1: 전체 기동**

```bash
open -a Docker; until docker info >/dev/null 2>&1; do sleep 3; done
cd ~/Workspace/notebook/prototype && docker compose up -d minio minio-init ai-hub mlflow airflow
until curl -sf -u admin:admin localhost:8080/api/v1/health >/dev/null; do sleep 5; done
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source "$HOME/.sdkman/bin/sdkman-init.sh"
lsof -ti tcp:8081 >/dev/null || nohup ./gradlew bootRun > "$TMPDIR/prizm-backend.log" 2>&1 &
until curl -sf localhost:8081/api/runs >/dev/null; do sleep 2; done
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
lsof -ti tcp:3000 >/dev/null || nohup npm run dev > "$TMPDIR/prizm-portal.log" 2>&1 &
until curl -sf localhost:3000/assets/code >/dev/null; do sleep 2; done; echo all up
```

Expected: `all up`

- [ ] **Step 2: Playwright 준비 (저장소 밖)**

```bash
mkdir -p "$TMPDIR/prizm-e2e/shots" && cd "$TMPDIR/prizm-e2e"
[ -f package.json ] || npm init -y >/dev/null
npm install playwright >/dev/null && npx playwright install chromium
```

`$TMPDIR/prizm-e2e/e2e.mjs`:

```js
import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const shots = new URL('./shots/', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (error) => console.log('PAGEERROR', error.message));

await page.goto(`${base}/assets/code?asset=PRJ000212-C-0001`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '이 버전으로 실행' }).click();
const epochs = page.locator('.parameter-value-grid label', { hasText: 'epochs' }).locator('input');
console.log('DEFAULTS', await page.locator('.parameter-value-grid input').evaluateAll((inputs) => inputs.map((input) => input.value)));
await epochs.fill('2');
await page.screenshot({ path: `${shots}1-sheet.png` });
await page.getByRole('button', { name: '즉시 실행' }).click();

await page.getByText('실시간 Notebook').waitFor({ timeout: 30_000 });
const runId = new URL(page.url()).searchParams.get('run');
console.log('RUN_ID', runId);
await page.getByText('Papermill 주입 파라미터').first().waitFor({ timeout: 300_000 });
await page.screenshot({ path: `${shots}2-notebook.png`, fullPage: true });
await page.locator('.live-notebook-stream', { hasText: 'epoch 1/2' }).first().waitFor({ timeout: 900_000 });
await page.screenshot({ path: `${shots}3-epoch.png`, fullPage: true });
await page.locator('.live-run-result').waitFor({ timeout: 900_000 });
console.log('RESULT', (await page.locator('.live-run-result').innerText()).replace(/\s+/g, ' '));
await page.screenshot({ path: `${shots}4-done.png`, fullPage: true });
await browser.close();
```

- [ ] **Step 3: 완료 기준 1·2·4 — 화면에서 실행**

```bash
cd "$TMPDIR/prizm-e2e" && node e2e.mjs | tee run.log
RUN_ID=$(grep '^RUN_ID' run.log | awk '{print $2}'); echo "$RUN_ID"
curl -s -u admin:admin "localhost:8080/api/v1/dags/mlops_notebook_executor/dagRuns/prizm_$RUN_ID" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['dag_run_id'], d['state'])"
```

Expected: `DEFAULTS [ '3', '4', '320', '42' ]`, `PAGEERROR` 없음, `RUN_ID RUN-27xxx`, `RESULT … mAP50 0.xxx … weld-bead-defect-detector v<N> …`, Airflow에 `prizm_RUN-27xxx success`. `shots/3-epoch.png`에서 학습 셀 출력에 `epoch 1/2 · box_loss …` 줄이 보인다(Read 도구로 스크린샷을 열어 확인).

- [ ] **Step 4: 완료 기준 3·4 — 파라미터와 Registry 교차 확인**

```bash
curl -s "localhost:8081/api/runs/$RUN_ID/notebook" | python3 -c "import json,sys; c=[x for x in json.load(sys.stdin)['cells'] if 'injected-parameters' in x['tags']]; print(c[0]['source'])"
curl -s "localhost:8081/api/runs/$RUN_ID" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r['mlflowRunId'], r['registeredModelName'], r['registeredModelVersion'], r['map50'])" | tee run.result
MLFLOW_RUN=$(awk '{print $1}' run.result); VERSION=$(awk '{print $3}' run.result)
curl -s "localhost:5050/api/2.0/mlflow/runs/get?run_id=$MLFLOW_RUN" | python3 -c "import json,sys; print([p for p in json.load(sys.stdin)['run']['data']['params'] if p['key']=='epochs'])"
curl -s "localhost:5050/api/2.0/mlflow/model-versions/get?name=weld-bead-defect-detector&version=$VERSION" | python3 -c "import json,sys; v=json.load(sys.stdin)['model_version']; print(v['version'], v['run_id'])"
```

Expected: injected-parameters에 `epochs = 2`, MLflow params `epochs` = `2`, Registry 버전의 `run_id`가 백엔드 `mlflowRunId`와 같고, 버전 번호가 Step 3 `RESULT`의 `v<N>`과 같다.

- [ ] **Step 5: 완료 기준 5 — 백엔드 재시작 후 이력 유지**

```bash
pkill -f 'com.prizm.backend.PrizmBackendApplication' || pkill -f 'gradlew bootRun'
sleep 3
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend && source "$HOME/.sdkman/bin/sdkman-init.sh"
nohup ./gradlew bootRun > "$TMPDIR/prizm-backend.log" 2>&1 &
until curl -sf localhost:8081/api/runs >/dev/null; do sleep 2; done
cd "$TMPDIR/prizm-e2e" && node --input-type=module -e "
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:3000/assets/code?pipeline=1&project=PRJ000212', { waitUntil: 'networkidle' });
const row = page.locator('.pipeline-table tr', { hasText: '$RUN_ID' });
await row.waitFor({ timeout: 20000 });
console.log('ROW', (await row.innerText()).replace(/\s+/g, ' '));
await page.screenshot({ path: 'shots/5-dashboard.png', fullPage: true });
await browser.close();
"
```

Expected: `ROW 완료 … RUN-27xxx … 100%`

- [ ] **Step 6: 완료 기준 6 — `epochs: 0` 실패 표시**

```bash
FAIL_ID=$(curl -s -X POST localhost:8081/api/runs -H 'Content-Type: application/json' \
  -d '{"assetId":"PRJ000212-C-0001","version":"v2.4.1","parameters":{"epochs":0,"batch_size":4,"image_size":320,"seed":42},"resource":"ml.a100.20gb","environment":"pytorch-2.4-yolo12-py311-cu124"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
until curl -s "localhost:8081/api/runs/$FAIL_ID" | grep -Eq '"status":"(FAILED|SUCCEEDED)"'; do sleep 5; done
curl -s "localhost:8081/api/runs/$FAIL_ID" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r['status'], r['stage'], r['errorMessage'])"
cd "$TMPDIR/prizm-e2e" && node --input-type=module -e "
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:3000/assets/code?run=$FAIL_ID', { waitUntil: 'networkidle' });
await page.getByText('실행 실패').first().waitFor({ timeout: 20000 });
await page.locator('.live-notebook-cell.is-failed .live-notebook-error').first().waitFor({ timeout: 20000 });
console.log('ERROR_CELL', (await page.locator('.live-notebook-error').first().innerText()).split('\n')[0]);
await page.screenshot({ path: 'shots/6-failed.png', fullPage: true });
await browser.close();
"
```

Expected: `FAILED TRAINING execute_notebook 실패: ValueError: epochs는 1 이상이어야 합니다`(모니터가 학습 단계를 관측하기 전에 실패했다면 단계는 `DATA`일 수 있다), `ERROR_CELL ValueError: epochs는 1 이상이어야 합니다`.

- [ ] **Step 7: 오류 처리 — 백엔드 미기동 시 시트 오류**

```bash
pkill -f 'com.prizm.backend.PrizmBackendApplication' || pkill -f 'gradlew bootRun'
sleep 3
cd "$TMPDIR/prizm-e2e" && node --input-type=module -e "
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (error) => console.log('PAGEERROR', error.message));
await page.goto('http://localhost:3000/assets/code?pipeline=1&project=PRJ000212', { waitUntil: 'networkidle' });
console.log('MOCK_ROWS', await page.locator('.pipeline-table tbody tr').count());
await page.goto('http://localhost:3000/assets/code?asset=PRJ000212-C-0001', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '이 버전으로 실행' }).click();
await page.getByRole('button', { name: '즉시 실행' }).click();
await page.locator('.execution-run-error').waitFor({ timeout: 10000 });
console.log('SHEET_ERROR', await page.locator('.execution-run-error').innerText());
await page.screenshot({ path: 'shots/7-backend-down.png' });
await browser.close();
"
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend && source "$HOME/.sdkman/bin/sdkman-init.sh"
nohup ./gradlew bootRun > "$TMPDIR/prizm-backend.log" 2>&1 &
until curl -sf localhost:8081/api/runs >/dev/null; do sleep 2; done; echo backend restarted
```

Expected: `PAGEERROR` 없음, `MOCK_ROWS 2`(mock 실행만), `SHEET_ERROR 실행 서버(8081)에 연결할 수 없습니다`, `backend restarted`.

- [ ] **Step 8: 정리와 결과 기록**

```bash
ls "$TMPDIR/prizm-e2e/shots"
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal && git status --short && git log --oneline before-airflow-live-run..HEAD
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend && git status --short && ./gradlew test -q && echo BACKEND_TESTS_OK
```

Expected: 스크린샷 7장, 두 저장소 모두 작업 트리 깨끗함, `BACKEND_TESTS_OK`. 완료 기준 1~6과 백엔드 미기동 확인 결과(명령 출력 핵심 줄·스크린샷 경로)를 사용자에게 보고한다. `feature/airflow-live-run` 병합 여부는 사용자가 결정한다(superpowers:finishing-a-development-branch).
