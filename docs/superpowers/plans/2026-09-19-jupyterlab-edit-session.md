# JupyterLab 편집 세션 (Phase 2) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 코드 자산 상세 화면의 "코드 편집" 버튼이 JupyterLab 편집 세션을 열고, 포털이 그 세션을 동일 오리진으로 중계하며, 저장은 드래프트로만 반영되고 "새 버전으로 등록"을 눌러야 자산 버전이 된다.

**Architecture:** `prizm-backend`에 `edit` 패키지를 추가해 세션 생성·소유권 판정·유휴 회수를 맡긴다(Phase 1의 `environment` 패키지와 정확히 같은 패턴: 엔티티+리포지토리+서비스+컨트롤러+리컨사일러). 포털(Next.js/vinext)에 두 개의 Route Handler를 추가한다 — 하나는 세션 생성을 백엔드로 위임하며 사용자 식별 쿠키를 심고(`/api/edit-sessions`), 하나는 그 세션의 JupyterLab 컨테이너로 HTTP·WebSocket을 그대로 중계한다(`/edit/[sessionId]/[...path]`). 베이스 런타임 이미지의 도구 venv에 jupyterlab을 추가해 Phase 1의 파생 이미지를 그대로 재사용한다.

**Tech Stack:** Spring Boot 4.1.1 · Java 21 · H2 · JPA (백엔드, Phase 1과 동일) · Next.js(vinext, Cloudflare Workers 호환 런타임) · React 19 · TypeScript 5.9 · Docker

**Spec:** `docs/superpowers/specs/2026-09-19-jupyterlab-edit-session-design.md` (그리고 이 문서가 재사용하는 패턴의 원본인 `docs/superpowers/specs/2026-09-19-notebook-edit-environment-design.md`)

## Global Constraints

- 백엔드: Spring Boot 4.1.1, Java 21(Temurin, SDKMAN). 빌드·테스트는 `source ~/.sdkman/bin/sdkman-init.sh && ./gradlew test`
- Jackson 3: 처리 API는 `tools.jackson.*`, 애너테이션은 `com.fasterxml.jackson.annotation.*`
- 사용자에게 보이는 에러 메시지는 한국어
- JPA 엔티티에 primitive `int`/`long` 필드를 추가하면 `@ColumnDefault("0")`를 반드시 붙인다
- 백엔드 테스트는 JUnit 5 + AssertJ + Mockito. 외부 명령(`docker` 등) 실행은 Phase 1의 `CommandRunner` seam을 그대로 재사용한다 — 새 seam을 만들지 않는다
- 포털: TypeScript 5.9, React 19. 테스트 프레임워크 없음 — 검증은 `tsc --noEmit` + `oxlint`, 실제 동작은 Playwright로 직접 확인
- **사용자당 세션 1개.** 다른 (자산, 버전)을 편집 요청하면 기존 세션을 종료(드래프트 flush 후 컨테이너 정지)하고 새로 만든다
- **Jupyter 자체 토큰은 브라우저에 노출하지 않는다.** 프록시가 서버 사이드로 매 요청에 주입한다
- **인가는 매 요청마다 백엔드에 확인한다(캐싱 없음)** — 지금은 YAGNI, 느려지면 나중에 캐싱
- 커밋 메시지는 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`로 끝낸다
- `~/Workspace/notebook/prototype`은 git 저장소가 아니다. 수정 전 `prototype/.backup-2026-09-19/`가 이미 있으면 그 안에 베이스 이미지 Dockerfile을 추가로 백업한다(파일명 충돌 시 타임스탬프를 붙인다)

## 파일 구조

### prizm-backend (git)

| 파일 | 책임 |
|---|---|
| `edit/EditSessionStatus.java` | CREATING / READY / FAILED / TERMINATED |
| `edit/EditSession.java` | JPA 엔티티. 세션 1건의 상태·소유자·컨테이너 정보 |
| `edit/EditSessionRepository.java` | `findByOwnerIdAndStatusIn`, `findByStatus` |
| `edit/EditSessionService.java` | 생성·재사용·종료·소유권 판정 오케스트레이션 |
| `edit/EditSessionScheduler.java` | 유휴 30분 회수 (`@Scheduled`) |
| `edit/EditSessionReconciler.java` | 기동 시 `docker ps` 대조 (`ApplicationRunner`) |
| `edit/CreateEditSessionRequest.java` | API 요청 본문 |
| `edit/EditSessionResponse.java` | API 응답 본문 |
| `edit/EditSessionController.java` | `POST /api/edit-sessions`, `GET /api/edit-sessions/{id}` |
| `api/EditSessionNotFoundException.java` | 404 |
| `api/ApiExceptionHandler.java` (수정) | 위 예외 핸들러 추가 |
| `config/PrizmProperties.java` (수정) | `EditSession` 설정 레코드 추가 |
| `application.yml` (수정) | `edit-session` 블록 추가 |

### prototype (git 아님)

| 파일 | 책임 |
|---|---|
| `runtime/base/Dockerfile` (수정) | 도구 venv에 jupyterlab·jupyter-server 추가 |

### prizm-portal (git)

| 파일 | 책임 |
|---|---|
| `app/api/edit-sessions/route.ts` | 세션 생성 릴레이 — 쿠키 확인/발급, 백엔드로 위임 |
| `app/edit/[sessionId]/[...path]/route.ts` | JupyterLab 컨테이너로의 HTTP+WS 프록시 |
| `lib/edit-session-api.ts` | 브라우저에서 `/api/edit-sessions`를 부르는 타입 있는 클라이언트 |
| `components/code-assets-workspace.tsx` (수정) | "코드 편집" 버튼 → 편집 패널, "새 버전으로 등록" 버튼 |

---
### Task 1: WebSocket 프록시 실현 가능성 검증 (게이트)

**목적:** `vinext dev`의 로컬 런타임이 Cloudflare Workers의 `fetch()` + `WebSocketPair` 패턴으로 임의의 로컬 WebSocket 서버(다른 Worker가 아닌 진짜 프로세스)를 중계할 수 있는지 확인한다. 이 태스크가 실패하면 **Task 8을 다시 설계해야 한다** — 나머지 태스크(2~7, 9~10)는 이 결과와 무관하게 그대로 진행 가능하다.

**Files:**
- Create: `app/_ws-spike/route.ts` (임시 — Task 8에서 실제 프록시로 대체된 뒤 삭제)
- Create: `scripts/ws-spike/echo-server.mjs` (임시 검증용 — 이 태스크 안에서만 쓰고 커밋하지 않는다)

**Interfaces:**
- Consumes: 없음
- Produces: 검증 결과(성공/실패)와, 성공 시 Task 8이 그대로 재사용할 WS 브릿지 코드 패턴

- [ ] **Step 1: 독립 WebSocket 에코 서버 작성 (커밋하지 않음)**

`scripts/ws-spike/echo-server.mjs`:

```javascript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8765 });
wss.on('connection', (socket) => {
  socket.on('message', (data) => {
    socket.send(`echo:${data.toString()}`);
  });
});
console.log('echo server listening on 8765');
```

Run: `node scripts/ws-spike/echo-server.mjs &` (백그라운드로 띄워둔다. `ws` 패키지는 이미 `node_modules`에 전이 의존성으로 있으므로 추가 설치 없이 동작해야 한다 — 안 되면 `npm install --no-save ws`로 임시 설치)

- [ ] **Step 2: 확인 — 에코 서버 자체가 동작하는지**

```bash
node -e "
const ws = new WebSocket('ws://localhost:8765');
ws.onopen = () => ws.send('hello');
ws.onmessage = (e) => { console.log('received:', e.data); process.exit(0); };
setTimeout(() => { console.error('timeout'); process.exit(1); }, 5000);
"
```

Expected: `received: echo:hello` 출력 후 정상 종료. (Node 22+엔 전역 `WebSocket`이 내장돼 있다 — `node --version`으로 22 이상인지 먼저 확인한다.)

- [ ] **Step 3: Route Handler로 브릿지 작성**

`app/_ws-spike/route.ts`:

```typescript
export const runtime = 'edge';

export async function GET(request: Request) {
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected websocket', { status: 426 });
  }

  const upstreamResponse = await fetch('http://localhost:8765/', {
    headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
  });
  const upstreamSocket = (upstreamResponse as unknown as { webSocket: WebSocket | null }).webSocket;
  if (!upstreamSocket) {
    return new Response('업스트림이 WebSocket을 반환하지 않았습니다', { status: 502 });
  }
  upstreamSocket.accept();

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
  server.accept();

  server.addEventListener('message', (event: MessageEvent) => upstreamSocket.send(event.data));
  upstreamSocket.addEventListener('message', (event: MessageEvent) => server.send(event.data));
  server.addEventListener('close', () => upstreamSocket.close());
  upstreamSocket.addEventListener('close', () => server.close());

  return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
}
```

`WebSocketPair`가 TypeScript에서 타입 에러가 나면 `next-env.d.ts` 또는 이 파일 상단에 `/// <reference types="@cloudflare/workers-types" />`를 추가해본다. 그래도 안 되면 `// @ts-expect-error` 주석으로 타입만 우회하고(런타임 동작이 먼저다) 이 사실을 보고서에 남긴다.

- [ ] **Step 4: `vinext dev`로 브라우저에서 왕복 확인**

```bash
node scripts/ws-spike/echo-server.mjs &
npm run dev &
sleep 3
node -e "
const ws = new WebSocket('ws://localhost:3000/_ws-spike');
ws.onopen = () => { console.log('OPEN'); ws.send('ping'); };
ws.onmessage = (e) => { console.log('MESSAGE:', e.data); process.exit(e.data === 'echo:ping' ? 0 : 1); };
ws.onerror = (e) => { console.error('ERROR', e); process.exit(1); };
setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 8000);
"
```

Expected(성공): `OPEN` 다음 `MESSAGE: echo:ping` 출력, exit code 0.

- [ ] **Step 5: 결과 기록**

**성공한 경우**: Step 3의 코드가 실제로 동작하는 브릿지 패턴이다. Task 8은 이 패턴을 그대로 가져가되, 대상 URL을 고정된 `http://localhost:8765`가 아니라 세션별 JupyterLab 컨테이너 주소로, 그리고 GET 외 모든 HTTP 메서드까지 처리하도록 확장한다.

**실패한 경우** (연결이 아예 안 되거나, `upstreamResponse.webSocket`이 항상 `null`이거나, 메시지가 왕복하지 않음): 정확히 어느 단계에서 실패했는지(Step 3의 업스트림 fetch 자체가 실패했는지, 아니면 `WebSocketPair`/`Response({webSocket})` 자체가 vinext 런타임에서 지원되지 않는지)를 보고서에 정확히 남긴다. 이 경우 컨트롤러가 판정을 내려야 한다 — 유력한 대안은 백엔드가 프록시하고 iframe이 다른 오리진을 허용하는 방향으로 §5의 설계를 되돌리는 것이다(설계 문서의 "실패 시 대안" 참고).

- [ ] **Step 6: 정리**

```bash
kill %1 %2 2>/dev/null  # echo-server, dev 서버 백그라운드 job 종료
rm -f scripts/ws-spike/echo-server.mjs
rmdir scripts/ws-spike 2>/dev/null
# app/_ws-spike/route.ts는 성공했다면 유지한다 (Task 8이 코드를 옮겨간 뒤 그때 삭제) — 이번 태스크에서는 지우지 않는다
```

이 태스크는 애플리케이션 코드를 실질적으로 바꾸지 않으므로(스파이크 산출물은 `app/_ws-spike/`에 격리) 별도 커밋 없이 다음 단계로 넘어간다. 단, Step 3의 코드가 성공했다면 `app/_ws-spike/route.ts` 하나만 커밋해 둔다(Task 8이 시작점으로 참고할 수 있도록):

```bash
git add app/_ws-spike/route.ts
git commit -m "spike: WebSocket 프록시가 vinext dev 런타임에서 동작함을 검증

Cloudflare Workers 스타일 WebSocketPair + fetch().webSocket 패턴으로
로컬 WS 에코 서버를 성공적으로 중계했다. Task 8이 이 패턴을 그대로
가져가 실제 JupyterLab 프록시로 확장한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---
### Task 2: EditSession 엔티티·상태·저장소

**Files:**
- Create: `src/main/java/com/prizm/backend/edit/EditSessionStatus.java`
- Create: `src/main/java/com/prizm/backend/edit/EditSession.java`
- Create: `src/main/java/com/prizm/backend/edit/EditSessionRepository.java`
- Test: `src/test/java/com/prizm/backend/edit/EditSessionTest.java`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `EditSessionStatus` enum: `CREATING`, `READY`, `FAILED`, `TERMINATED`
  - `EditSession.creating(String sessionId, String ownerId, String assetId, String assetVersion, Instant now)` → `EditSession`
  - 인스턴스 메서드: `markReady(String containerId, int hostPort, String jupyterToken, Instant now)`, `markFailed(String errorMessage, Instant now)`, `markTerminated(Instant now)`, `touch(Instant now)`(마지막 활동 시각 갱신)
  - getter: `getSessionId()`, `getOwnerId()`, `getAssetId()`, `getAssetVersion()`, `getContainerId()`, `getHostPort()`, `getJupyterToken()`, `getStatus()`, `getErrorMessage()`, `getCreatedAt()`, `getLastActivityAt()`, `getTerminatedAt()`
  - `EditSessionRepository extends JpaRepository<EditSession, String>` with `List<EditSession> findByOwnerIdAndStatusIn(String ownerId, Collection<EditSessionStatus> statuses)`, `List<EditSession> findByStatus(EditSessionStatus status)`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/edit/EditSessionTest.java`:

```java
package com.prizm.backend.edit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class EditSessionTest {

    private static final Instant CREATED = Instant.parse("2026-09-19T01:00:00Z");
    private static final Instant READY_AT = Instant.parse("2026-09-19T01:00:07Z");

    private EditSession creating() {
        return EditSession.creating("SESSION-1", "user-abc", "PRJ000212-C-0001", "v2.4.1", CREATED);
    }

    @Test
    void startsInCreatingWithoutContainerInfo() {
        EditSession session = creating();

        assertThat(session.getStatus()).isEqualTo(EditSessionStatus.CREATING);
        assertThat(session.getSessionId()).isEqualTo("SESSION-1");
        assertThat(session.getOwnerId()).isEqualTo("user-abc");
        assertThat(session.getAssetId()).isEqualTo("PRJ000212-C-0001");
        assertThat(session.getAssetVersion()).isEqualTo("v2.4.1");
        assertThat(session.getCreatedAt()).isEqualTo(CREATED);
        assertThat(session.getLastActivityAt()).isEqualTo(CREATED);
        assertThat(session.getContainerId()).isNull();
        assertThat(session.getTerminatedAt()).isNull();
    }

    @Test
    void markReadyRecordsContainerAndToken() {
        EditSession session = creating();

        session.markReady("abc123containerid", 49234, "onetime-token", READY_AT);

        assertThat(session.getStatus()).isEqualTo(EditSessionStatus.READY);
        assertThat(session.getContainerId()).isEqualTo("abc123containerid");
        assertThat(session.getHostPort()).isEqualTo(49234);
        assertThat(session.getJupyterToken()).isEqualTo("onetime-token");
    }

    @Test
    void markFailedRecordsErrorAndTerminatedAt() {
        EditSession session = creating();

        session.markFailed("이미지를 찾을 수 없습니다", READY_AT);

        assertThat(session.getStatus()).isEqualTo(EditSessionStatus.FAILED);
        assertThat(session.getErrorMessage()).isEqualTo("이미지를 찾을 수 없습니다");
        assertThat(session.getTerminatedAt()).isEqualTo(READY_AT);
    }

    @Test
    void markTerminatedRecordsTerminatedAt() {
        EditSession session = creating();
        session.markReady("abc123containerid", 49234, "onetime-token", READY_AT);

        session.markTerminated(Instant.parse("2026-09-19T01:30:00Z"));

        assertThat(session.getStatus()).isEqualTo(EditSessionStatus.TERMINATED);
        assertThat(session.getTerminatedAt()).isEqualTo(Instant.parse("2026-09-19T01:30:00Z"));
    }

    @Test
    void touchUpdatesLastActivityOnly() {
        EditSession session = creating();
        session.markReady("abc123containerid", 49234, "onetime-token", READY_AT);

        session.touch(Instant.parse("2026-09-19T01:15:00Z"));

        assertThat(session.getLastActivityAt()).isEqualTo(Instant.parse("2026-09-19T01:15:00Z"));
        assertThat(session.getStatus()).isEqualTo(EditSessionStatus.READY);
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*EditSessionTest'`
Expected: 컴파일 실패 — `EditSession`, `EditSessionStatus` 없음

- [ ] **Step 3: 상태 enum 작성**

`src/main/java/com/prizm/backend/edit/EditSessionStatus.java`:

```java
package com.prizm.backend.edit;

public enum EditSessionStatus {
    CREATING,
    READY,
    FAILED,
    TERMINATED
}
```

- [ ] **Step 4: 엔티티 작성**

`src/main/java/com/prizm/backend/edit/EditSession.java`:

```java
package com.prizm.backend.edit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.ColumnDefault;

/** 편집 세션 1건. 사용자당(ownerId) 동시에 READY/CREATING인 세션은 하나만 허용된다. */
@Entity
@Table(name = "edit_session")
public class EditSession {

    private static final int MESSAGE_LENGTH = 2000;

    @Id
    private String sessionId;
    private String ownerId;
    private String assetId;
    private String assetVersion;
    private String containerId;
    @ColumnDefault("0")
    private int hostPort;
    private String jupyterToken;
    @Enumerated(EnumType.STRING)
    private EditSessionStatus status;
    @Column(length = MESSAGE_LENGTH)
    private String errorMessage;
    private Instant createdAt;
    private Instant lastActivityAt;
    private Instant terminatedAt;

    protected EditSession() {
    }

    public static EditSession creating(String sessionId, String ownerId, String assetId, String assetVersion,
            Instant now) {
        EditSession session = new EditSession();
        session.sessionId = sessionId;
        session.ownerId = ownerId;
        session.assetId = assetId;
        session.assetVersion = assetVersion;
        session.status = EditSessionStatus.CREATING;
        session.createdAt = now;
        session.lastActivityAt = now;
        return session;
    }

    public void markReady(String containerId, int hostPort, String jupyterToken, Instant now) {
        this.status = EditSessionStatus.READY;
        this.containerId = containerId;
        this.hostPort = hostPort;
        this.jupyterToken = jupyterToken;
        this.lastActivityAt = now;
    }

    public void markFailed(String errorMessage, Instant now) {
        this.status = EditSessionStatus.FAILED;
        this.errorMessage = errorMessage;
        this.terminatedAt = now;
    }

    public void markTerminated(Instant now) {
        this.status = EditSessionStatus.TERMINATED;
        this.terminatedAt = now;
    }

    public void touch(Instant now) {
        this.lastActivityAt = now;
    }

    public String getSessionId() { return sessionId; }
    public String getOwnerId() { return ownerId; }
    public String getAssetId() { return assetId; }
    public String getAssetVersion() { return assetVersion; }
    public String getContainerId() { return containerId; }
    public int getHostPort() { return hostPort; }
    public String getJupyterToken() { return jupyterToken; }
    public EditSessionStatus getStatus() { return status; }
    public String getErrorMessage() { return errorMessage; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastActivityAt() { return lastActivityAt; }
    public Instant getTerminatedAt() { return terminatedAt; }
}
```

- [ ] **Step 5: 저장소 작성**

`src/main/java/com/prizm/backend/edit/EditSessionRepository.java`:

```java
package com.prizm.backend.edit;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EditSessionRepository extends JpaRepository<EditSession, String> {

    List<EditSession> findByOwnerIdAndStatusIn(String ownerId, Collection<EditSessionStatus> statuses);

    List<EditSession> findByStatus(EditSessionStatus status);
}
```

- [ ] **Step 6: 테스트 전체 실행**

Run: `./gradlew test`
Expected: 전부 PASS (`EditSessionTest` 5개 포함, 저장소 파생 쿼리는 Task 5에서 스프링 컨텍스트로 검증)

- [ ] **Step 7: 커밋**

```bash
git add src/main/java/com/prizm/backend/edit/ src/test/java/com/prizm/backend/edit/EditSessionTest.java
git commit -m "feat: 편집 세션 엔티티·상태·저장소 추가

사용자당(ownerId) 세션 1개 정책의 기반이 되는 엔티티. Phase 1의
EnvironmentBuild와 정확히 같은 패턴 — 정적 팩토리로 초기 상태를
만들고 인스턴스 메서드로만 상태를 바꾼다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---
### Task 3: 베이스 이미지에 JupyterLab 추가

**Files:**
- Modify: `~/Workspace/notebook/prototype/runtime/base/Dockerfile`

> **주의:** `prototype`은 git 저장소가 아니다. Step 1에서 반드시 백업한다.

**Interfaces:**
- Consumes: 없음
- Produces: `prizm/runtime-base:v1` 이미지의 도구 venv에 `jupyter lab` 실행 파일. 새 이미지 ID(캐시 키가 여기서 파생되므로, 이후 모든 파생 이미지가 재빌드된다 — 의도된 동작)

- [ ] **Step 1: 백업**

```bash
cd ~/Workspace/notebook/prototype
cp runtime/base/Dockerfile .backup-2026-09-19/Dockerfile.before-jupyterlab
ls -l .backup-2026-09-19/
```

- [ ] **Step 2: Dockerfile의 도구 venv 절 수정**

`~/Workspace/notebook/prototype/runtime/base/Dockerfile`에서 다음 블록을 찾는다:

```dockerfile
# ── 도구 venv ───────────────────────────────────────────────
RUN python -m venv /opt/prizm/tools \
    && /opt/prizm/tools/bin/pip install --no-cache-dir papermill==2.6.0
```

아래로 교체한다:

```dockerfile
# ── 도구 venv ───────────────────────────────────────────────
RUN python -m venv /opt/prizm/tools \
    && /opt/prizm/tools/bin/pip install --no-cache-dir \
         papermill==2.6.0 \
         jupyterlab==4.2.5 \
         jupyter-server==2.14.2
```

주석도 파일 상단에서 갱신한다 — 기존:

```dockerfile
#   - 도구 venv(/opt/prizm/tools): papermill (Phase 2에서 jupyterlab 추가).
```

를:

```dockerfile
#   - 도구 venv(/opt/prizm/tools): papermill, jupyterlab, jupyter-server.
```

로 바꾼다.

- [ ] **Step 3: 이미지 재빌드**

```bash
cd ~/Workspace/notebook/prototype
docker build -f runtime/base/Dockerfile -t prizm/runtime-base:v1 .
```

Expected: 성공. jupyterlab 설치 때문에 몇 분 더 걸릴 수 있다(의존성이 많다).

- [ ] **Step 4: jupyter lab 실행 파일이 도구 venv에만 있는지 확인**

```bash
docker run --rm prizm/runtime-base:v1 /opt/prizm/tools/bin/jupyter lab --version
docker run --rm prizm/runtime-base:v1 python -c "import jupyterlab" 2>&1 | tail -1
```

Expected: 첫 줄은 버전 문자열(`4.2.5`) 출력. 두 번째는 `ModuleNotFoundError: No module named 'jupyterlab'` — 사용자 환경(맨 `python`)엔 jupyterlab이 없어야 한다. Phase 1의 격리 원칙(도구와 사용자 환경 분리)이 안 깨졌다는 증거다.

- [ ] **Step 5: papermill이 여전히 정상 동작하는지 회귀 확인**

```bash
docker run --rm prizm/runtime-base:v1 papermill --version
docker run --rm prizm/runtime-base:v1 python -c "import ultralytics, mlflow, mlops, yaml; print('user env ok')"
```

Expected: 첫 줄 `2.6.0`, 둘째 줄 `user env ok`. Phase 1에서 이미 확인했던 것과 같은 결과여야 한다 — jupyterlab 추가가 papermill/사용자 환경에 영향을 주면 안 된다.

- [ ] **Step 6: JupyterLab 서버가 실제로 뜨는지 확인**

```bash
docker run --rm -d --name jlab-smoke -p 18888:8888 prizm/runtime-base:v1 \
  /opt/prizm/tools/bin/jupyter lab --ip=0.0.0.0 --port=8888 --no-browser \
  --IdentityProvider.token=smoke-test-token --ServerApp.allow_origin='*'
sleep 4
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:18888/lab?token=smoke-test-token"
docker logs jlab-smoke 2>&1 | tail -15
docker stop jlab-smoke
```

Expected: `200`. 로그에 커널스펙 관련 에러가 없어야 한다(있다면 `JUPYTER_PATH` 설정이 도구 venv에서도 사용자 환경의 커널스펙을 찾는지 확인 — Phase 1에서 이미 papermill로 검증됐던 것과 같은 메커니즘이다).

- [ ] **Step 7: 이미지 ID 기록**

```bash
docker image inspect -f '{{.Id}}' prizm/runtime-base:v1
```

이 값을 메모해 둔다 — Task 10에서 파생 이미지가 이 새 베이스로 재빌드되는지 확인할 때 쓴다.

이 태스크는 git 커밋이 없다(prototype은 git 저장소가 아니다).

---
### Task 4: 세션 컨테이너 런처 + 준비 상태 확인 + 설정

**Files:**
- Create: `src/main/java/com/prizm/backend/edit/EditSessionContainerLauncher.java`
- Create: `src/main/java/com/prizm/backend/edit/JupyterReadinessChecker.java`
- Create: `src/main/java/com/prizm/backend/edit/HttpJupyterReadinessChecker.java`
- Modify: `src/main/java/com/prizm/backend/config/PrizmProperties.java`
- Modify: `src/main/resources/application.yml`
- Modify: `src/test/java/com/prizm/backend/TestFixtures.java`
- Test: `src/test/java/com/prizm/backend/edit/EditSessionContainerLauncherTest.java`

**Interfaces:**
- Consumes: `CommandRunner`(Phase 1) — 재사용, 새 seam을 만들지 않는다
- Produces:
  - `EditSessionContainerLauncher.launch(String sessionId, String imageRef, Path hostSessionDir)` → `LaunchOutcome(boolean succeeded, String containerId, int hostPort, String jupyterToken, String log)`
  - `EditSessionContainerLauncher.stop(String containerId)` → `void`(실패해도 예외를 던지지 않고 로그만 남긴다 — 정리 경로에서 예외로 흐름이 끊기면 안 된다)
  - `JupyterReadinessChecker.isReady(int hostPort, String jupyterToken, Duration timeout)` → `boolean`
  - `PrizmProperties.EditSession(Path hostSessionsRoot, Duration idleTimeout, Duration readyTimeout)` — 새 설정
  - `PrizmProperties.MlopsSdk(String aiHubUrl, String s3Endpoint, String s3AccessKey, String s3SecretKey, String bucket)` — 컨테이너에 주입할 MinIO/AI Hub 자격증명(Phase 1의 `prototype/docker-compose.yml`이 Airflow에 주던 것과 같은 값)

**중요 — 이 두 클래스가 왜 필요한지:** `prizm-backend`는 MinIO·AI Hub에 직접 접근하는 클라이언트가 없다(Phase 1 전체가 Airflow 컨테이너 안의 `mlops` Python SDK로만 접근했다). Task 5에서 노트북을 내려받을 때도 새 Java 클라이언트를 추가하지 않고, 파생 이미지 안에 이미 설치된 `mlops` SDK를 일회성 컨테이너로 실행해 재사용한다 — 그래서 `MlopsSdk` 설정이 필요하다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/edit/EditSessionContainerLauncherTest.java`:

```java
package com.prizm.backend.edit;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class EditSessionContainerLauncherTest {

    private final List<List<String>> commands = new ArrayList<>();
    private CommandRunner.CommandResult nextResult = new CommandRunner.CommandResult(0, "abc123containerid\n");
    private CommandRunner.CommandResult portResult = new CommandRunner.CommandResult(0, "127.0.0.1:49234\n");

    @TempDir
    Path hostSessionDir;

    private final CommandRunner runner = (command, workingDirectory, timeout) -> {
        commands.add(List.copyOf(command));
        return command.get(0).equals("docker") && command.size() > 1 && "port".equals(command.get(1))
                ? portResult
                : nextResult;
    };

    private EditSessionContainerLauncher launcher() {
        return new EditSessionContainerLauncher(runner,
                new PrizmProperties.MlopsSdk("http://ai-hub.test:8000", "http://minio.test:9000",
                        "minioadmin", "minioadmin", "mlops-assets"),
                Duration.ofSeconds(20));
    }

    @Test
    void runsDockerRunWithLabelAndBindMountAndReturnsPortAndToken() {
        EditSessionContainerLauncher.LaunchOutcome outcome =
                launcher().launch("SESSION-1", "prizm/env/abc", hostSessionDir);

        assertThat(outcome.succeeded()).isTrue();
        assertThat(outcome.containerId()).isEqualTo("abc123containerid");
        assertThat(outcome.hostPort()).isEqualTo(49234);
        assertThat(outcome.jupyterToken()).isNotBlank();

        List<String> runCommand = commands.get(0);
        assertThat(runCommand).contains("docker", "run", "-d",
                "--label", "prizm-edit-session=SESSION-1",
                "--name", "prizm-edit-SESSION-1",
                "-p", "127.0.0.1:0:8888",
                "-v", hostSessionDir + ":/opt/prizm/edit",
                "-e", "MLOPS_AI_HUB_URL=http://ai-hub.test:8000",
                "-e", "MLOPS_S3_ENDPOINT=http://minio.test:9000",
                "-e", "MLOPS_S3_ACCESS_KEY=minioadmin",
                "-e", "MLOPS_S3_SECRET_KEY=minioadmin",
                "-e", "MLOPS_BUCKET=mlops-assets",
                "prizm/env/abc");
        assertThat(runCommand).contains("/opt/prizm/tools/bin/jupyter", "lab",
                "--ip=0.0.0.0", "--port=8888", "--no-browser",
                "--notebook-dir=/opt/prizm/edit",
                "--ServerApp.allow_origin=*");
        assertThat(runCommand.stream().anyMatch(arg -> arg.startsWith("--IdentityProvider.token="))).isTrue();

        List<String> portCommand = commands.get(1);
        assertThat(portCommand).containsExactly("docker", "port", "abc123containerid", "8888/tcp");
    }

    @Test
    void reportsFailureWithoutParsingPortWhenRunFails() {
        nextResult = new CommandRunner.CommandResult(1, "docker: image not found");

        EditSessionContainerLauncher.LaunchOutcome outcome =
                launcher().launch("SESSION-1", "prizm/env/abc", hostSessionDir);

        assertThat(outcome.succeeded()).isFalse();
        assertThat(outcome.log()).contains("image not found");
        assertThat(commands).hasSize(1);
    }

    @Test
    void stopRunsDockerStopAndRmWithoutThrowingOnFailure() {
        nextResult = new CommandRunner.CommandResult(1, "no such container");

        launcher().stop("gone-container");

        assertThat(commands.get(0)).containsExactly("docker", "stop", "gone-container");
        assertThat(commands.get(1)).containsExactly("docker", "rm", "-f", "gone-container");
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*EditSessionContainerLauncherTest'`
Expected: 컴파일 실패 — `EditSessionContainerLauncher` 없음, `PrizmProperties.MlopsSdk` 없음

- [ ] **Step 3: 설정 레코드에 `EditSession`·`MlopsSdk` 추가**

`src/main/java/com/prizm/backend/config/PrizmProperties.java`의 레코드 선언과 중첩 레코드에 추가한다. `import java.nio.file.Path;`와 `import java.time.Duration;`는 이미 있다.

```java
@ConfigurationProperties(prefix = "prizm")
public record PrizmProperties(
        Airflow airflow,
        Mlflow mlflow,
        Path runsDir,
        Cors cors,
        Monitor monitor,
        Environment environment,
        EditSession editSession,
        MlopsSdk mlopsSdk,
        List<CodeAssetProperties> codeAssets) {

    // ... 기존 중첩 레코드들 그대로 ...

    /** 편집 세션 정책. hostSessionsRoot는 호스트 경로(컨테이너 bind mount의 source). */
    public record EditSession(Path hostSessionsRoot, Duration idleTimeout, Duration readyTimeout) {
    }

    /** 세션 컨테이너에 주입할 MinIO/AI Hub 자격증명. prototype/docker-compose.yml이
     * Airflow 서비스에 주는 값과 같다. */
    public record MlopsSdk(String aiHubUrl, String s3Endpoint, String s3AccessKey, String s3SecretKey,
            String bucket) {
    }
}
```

- [ ] **Step 4: application.yml에 두 블록 추가**

`src/main/resources/application.yml`의 `environment:` 블록 다음, `code-assets:` 앞에 넣는다:

```yaml
  edit-session:
    host-sessions-root: ${user.home}/Workspace/notebook/prototype/edit-sessions
    idle-timeout: 30m
    ready-timeout: 20s
  mlops-sdk:
    ai-hub-url: http://localhost:8000
    s3-endpoint: http://localhost:9000
    s3-access-key: minioadmin
    s3-secret-key: minioadmin
    bucket: mlops-assets
```

- [ ] **Step 5: 준비 상태 확인 인터페이스와 실제 구현 작성**

`src/main/java/com/prizm/backend/edit/JupyterReadinessChecker.java`:

```java
package com.prizm.backend.edit;

import java.time.Duration;

/** JupyterLab 서버가 요청을 받을 준비가 됐는지 확인하는 지점. 테스트에서는 이 인터페이스를
 * 대체해 실제 HTTP 호출 없이 EditSessionService를 검증한다. */
@FunctionalInterface
public interface JupyterReadinessChecker {

    boolean isReady(int hostPort, String jupyterToken, Duration timeout);
}
```

`src/main/java/com/prizm/backend/edit/HttpJupyterReadinessChecker.java`:

```java
package com.prizm.backend.edit;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class HttpJupyterReadinessChecker implements JupyterReadinessChecker {

    private static final Duration POLL_INTERVAL = Duration.ofMillis(500);

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();

    @Override
    public boolean isReady(int hostPort, String jupyterToken, Duration timeout) {
        Instant deadline = Instant.now().plus(timeout);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + hostPort + "/api?token=" + jupyterToken))
                .timeout(Duration.ofSeconds(2))
                .GET()
                .build();
        while (Instant.now().isBefore(deadline)) {
            try {
                HttpResponse<Void> response = client.send(request, HttpResponse.BodyHandlers.discarding());
                if (response.statusCode() == 200) {
                    return true;
                }
            } catch (Exception e) {
                // 아직 안 떴을 수 있다 - 계속 폴링한다
            }
            try {
                Thread.sleep(POLL_INTERVAL.toMillis());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return false;
    }
}
```

- [ ] **Step 6: 컨테이너 런처 작성**

`src/main/java/com/prizm/backend/edit/EditSessionContainerLauncher.java`:

```java
package com.prizm.backend.edit;

import com.prizm.backend.config.PrizmProperties;
import com.prizm.backend.environment.CommandRunner;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** 편집 세션의 JupyterLab 컨테이너를 기동·정지한다. 도커 명령 실행은 Phase 1의 CommandRunner
 * seam을 그대로 쓴다 - 새 seam을 만들지 않는다. */
@Component
public class EditSessionContainerLauncher {

    private static final String CONTAINER_PATH = "/opt/prizm/edit";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CommandRunner runner;
    private final PrizmProperties.MlopsSdk mlopsSdk;
    private final Duration commandTimeout;

    @Autowired
    public EditSessionContainerLauncher(CommandRunner runner, PrizmProperties properties) {
        this(runner, properties.mlopsSdk(), Duration.ofSeconds(30));
    }

    EditSessionContainerLauncher(CommandRunner runner, PrizmProperties.MlopsSdk mlopsSdk, Duration commandTimeout) {
        this.runner = runner;
        this.mlopsSdk = mlopsSdk;
        this.commandTimeout = commandTimeout;
    }

    public LaunchOutcome launch(String sessionId, String imageRef, Path hostSessionDir) {
        String token = generateToken();
        List<String> command = new ArrayList<>(List.of(
                "docker", "run", "-d",
                "--label", "prizm-edit-session=" + sessionId,
                "--name", "prizm-edit-" + sessionId,
                "-p", "127.0.0.1:0:8888",
                "-v", hostSessionDir + ":" + CONTAINER_PATH,
                "-e", "MLOPS_AI_HUB_URL=" + mlopsSdk.aiHubUrl(),
                "-e", "MLOPS_S3_ENDPOINT=" + mlopsSdk.s3Endpoint(),
                "-e", "MLOPS_S3_ACCESS_KEY=" + mlopsSdk.s3AccessKey(),
                "-e", "MLOPS_S3_SECRET_KEY=" + mlopsSdk.s3SecretKey(),
                "-e", "MLOPS_BUCKET=" + mlopsSdk.bucket(),
                imageRef,
                "/opt/prizm/tools/bin/jupyter", "lab",
                "--ip=0.0.0.0", "--port=8888", "--no-browser",
                "--notebook-dir=" + CONTAINER_PATH,
                "--IdentityProvider.token=" + token,
                "--ServerApp.allow_origin=*"));

        CommandRunner.CommandResult runResult = runner.run(command, hostSessionDir, commandTimeout);
        if (!runResult.succeeded()) {
            return new LaunchOutcome(false, null, 0, null, runResult.output());
        }
        String containerId = runResult.output().trim();

        CommandRunner.CommandResult portResult = runner.run(
                List.of("docker", "port", containerId, "8888/tcp"), hostSessionDir, commandTimeout);
        if (!portResult.succeeded()) {
            return new LaunchOutcome(false, containerId, 0, null, portResult.output());
        }
        int hostPort = parsePort(portResult.output());
        return new LaunchOutcome(true, containerId, hostPort, token, runResult.output());
    }

    /** 정지 실패는 예외를 던지지 않는다 - 정리 경로(유휴 회수 등)가 여기서 끊기면 안 된다. */
    public void stop(String containerId) {
        runner.run(List.of("docker", "stop", containerId), Path.of("."), commandTimeout);
        runner.run(List.of("docker", "rm", "-f", containerId), Path.of("."), commandTimeout);
    }

    private static String generateToken() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    /** "127.0.0.1:49234" 형태의 docker port 출력에서 포트 숫자만 뽑는다. */
    private static int parsePort(String dockerPortOutput) {
        String trimmed = dockerPortOutput.trim();
        int colon = trimmed.lastIndexOf(':');
        return Integer.parseInt(colon >= 0 ? trimmed.substring(colon + 1) : trimmed);
    }

    public record LaunchOutcome(boolean succeeded, String containerId, int hostPort, String jupyterToken,
            String log) {
    }
}
```

- [ ] **Step 7: TestFixtures에 EditSession/MlopsSdk 설정 추가**

`src/test/java/com/prizm/backend/TestFixtures.java`의 `properties(Path runsDir)` 메서드가 이제 `EditSession`·`MlopsSdk` 인자도 넘겨야 한다. `PrizmProperties` 생성 부분을 아래로 교체한다:

```java
    public static PrizmProperties properties(Path runsDir) {
        return new PrizmProperties(
                new PrizmProperties.Airflow("http://airflow.test", "admin", "admin", "mlops_notebook_executor"),
                new PrizmProperties.Mlflow("http://mlflow.test", "prizm-weld-training"),
                runsDir,
                new PrizmProperties.Cors(List.of("http://localhost:3000")),
                new PrizmProperties.Monitor(false),
                new PrizmProperties.Environment(
                        Path.of("/tmp/prizm-env-builds"), "prizm/env", "", Duration.ofMinutes(15)),
                new PrizmProperties.EditSession(
                        Path.of("/tmp/prizm-edit-sessions"), Duration.ofMinutes(30), Duration.ofSeconds(20)),
                new PrizmProperties.MlopsSdk("http://ai-hub.test:8000", "http://minio.test:9000",
                        "minioadmin", "minioadmin", "mlops-assets"),
                List.of(weldAsset()));
    }
```

- [ ] **Step 8: 애플리케이션 설정 바인딩 테스트 보강**

`src/test/java/com/prizm/backend/PrizmBackendApplicationTests.java`의 `bindsPrizmProperties` 테스트 끝에 추가한다:

```java
        assertThat(properties.editSession().idleTimeout()).isEqualTo(java.time.Duration.ofMinutes(30));
        assertThat(properties.mlopsSdk().bucket()).isEqualTo("mlops-assets");
```

- [ ] **Step 9: 테스트 전체 실행**

Run: `./gradlew test`
Expected: 전부 PASS

- [ ] **Step 10: 커밋**

```bash
git add src/main/java/com/prizm/backend/edit/ src/main/java/com/prizm/backend/config/PrizmProperties.java \
        src/main/resources/application.yml src/test/java/com/prizm/backend/
git commit -m "feat: 편집 세션 컨테이너 런처와 준비 상태 확인 추가

docker run으로 파생 이미지에서 JupyterLab을 띄우고 호스트 포트·1회용
토큰을 돌려준다. MinIO/AI Hub 자격증명은 prototype/docker-compose.yml이
Airflow에 주는 것과 같은 값을 설정으로 옮겨와 컨테이너에 주입한다 -
prizm-backend에 새 MinIO 클라이언트를 추가하지 않고 파생 이미지 안의
mlops SDK를 그대로 재사용하기 위해서다(Task 5에서 사용).

준비 상태 확인은 별도 seam(JupyterReadinessChecker)으로 분리해
EditSessionService 테스트에서 실제 HTTP 호출 없이 대체할 수 있게 했다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---
### Task 5: SDK 이름을 `mlops`에서 `prizm`으로 변경

> **왜 이 태스크가 필요한가:** 사용자 지시로 SDK 이름을 `prizm`으로 바꾼다. 이 SDK는 Phase 1에서
> 이미 구현·검증된 실행 파이프라인(Airflow DAG, 베이스 이미지) 전체가 쓰고 있으므로, 이름만
> 바꾸는 게 아니라 두 도커 이미지를 재빌드하고 Phase 1의 E2E를 다시 통과시켜야 회귀가 없다고
> 확신할 수 있다. Task 6(EditSessionService)이 이 SDK를 처음으로 새로 호출하는 지점이라 그 전에
> 끝내 둔다.
>
> **바꾸지 않는 것**: `MLOPS_AI_HUB_URL`·`MLOPS_S3_*`·`MLOPS_BUCKET` 같은 **환경변수 이름**과
> 버킷 리터럴 `mlops-assets`는 인프라 설정이지 SDK 이름이 아니므로 그대로 둔다. 바꾸는 것은
> **파이썬 임포트 이름**(`import mlops` → `import prizm`)과 컨테이너 설치 경로
> (`/opt/mlops-sdk` → `/opt/prizm-sdk`)뿐이다.

> **주의:** `prototype`은 git 저장소가 아니다. Step 1에서 반드시 백업한다. `runs/`(과거 실행
> 기록)와 `.backup-*/`(이전 백업)는 건드리지 않는다 — 역사적 기록이다.

**Files (전부 `~/Workspace/notebook/prototype` 아래, git 아님):**
- Rename: `sdk/mlops/` → `sdk/prizm/`
- Modify: `sdk/pyproject.toml`
- Modify: `airflow/dags/mlops_notebook_executor.py`
- Modify: `seed/register_notebook_v2.py`, `seed/seed_assets.py`
- Modify: `portal/app.py`, `portal/rule_validator.py` (구 데모 UI — 컨테이너는 현재 안 뜨고 있지만 소스 일관성을 위해 같이 바꾼다)
- Modify: `notebooks/demo_yolov8_training_v2.ipynb`, `demo_yolov8_training.ipynb`, `demo_wine_training.ipynb`, `broken_door_defect_yolov8_training.ipynb`, `demo_iris_training.ipynb`
- Modify: `runtime/base/Dockerfile`, `airflow/Dockerfile` (설치 경로 `/opt/mlops-sdk` → `/opt/prizm-sdk`)

- [ ] **Step 1: 백업**

```bash
cd ~/Workspace/notebook/prototype
mkdir -p .backup-2026-09-19-sdk-rename
cp -r sdk .backup-2026-09-19-sdk-rename/sdk
cp airflow/dags/mlops_notebook_executor.py .backup-2026-09-19-sdk-rename/
cp runtime/base/Dockerfile .backup-2026-09-19-sdk-rename/Dockerfile.runtime-base
cp airflow/Dockerfile .backup-2026-09-19-sdk-rename/Dockerfile.airflow
```

- [ ] **Step 2: 패키지 디렉터리 이름 변경**

```bash
cd ~/Workspace/notebook/prototype
git mv sdk/mlops sdk/prizm 2>/dev/null || mv sdk/mlops sdk/prizm
ls sdk/prizm/
```

Expected: `__init__.py code.py _client.py model.py dataset.py`가 `sdk/prizm/` 아래로 옮겨짐

- [ ] **Step 3: pyproject.toml 수정**

`sdk/pyproject.toml`에서:

```toml
[project]
name = "mlops-sdk-prizm-prototype"
```

를:

```toml
[project]
name = "prizm-sdk-prototype"
```

로, 그리고:

```toml
[tool.setuptools]
packages = ["mlops"]
```

를:

```toml
[tool.setuptools]
packages = ["prizm"]
```

로 바꾼다.

- [ ] **Step 4: 임포트·경로 일괄 치환**

`mlops.`(속성 접근, 예: `mlops.code.download`)와 `import mlops`(단독 임포트 문)만 정확히 바꾼다 — `MLOPS_BUCKET` 같은 환경변수 이름이나 `mlops-assets` 버킷 리터럴은 건드리지 않는다(아래 두 패턴은 그것들과 절대 겹치지 않는다 — 대소문자가 다르고, 두 번째 패턴은 뒤에 마침표가 와야만 매치된다).

```bash
cd ~/Workspace/notebook/prototype

TARGETS=(
  "airflow/dags/mlops_notebook_executor.py"
  "seed/register_notebook_v2.py"
  "seed/seed_assets.py"
  "portal/app.py"
  "portal/rule_validator.py"
  "notebooks/demo_yolov8_training_v2.ipynb"
  "notebooks/demo_yolov8_training.ipynb"
  "notebooks/demo_wine_training.ipynb"
  "notebooks/broken_door_defect_yolov8_training.ipynb"
  "notebooks/demo_iris_training.ipynb"
  "sdk/prizm/__init__.py"
  "sdk/prizm/code.py"
  "sdk/prizm/model.py"
  "sdk/prizm/dataset.py"
  "sdk/prizm/_client.py"
)

for f in "${TARGETS[@]}"; do
  sed -i '' -E 's/\bimport mlops\b/import prizm/g; s/\bmlops\./prizm./g' "$f"
done

runtime="runtime/base/Dockerfile"
sed -i '' 's#/opt/mlops-sdk#/opt/prizm-sdk#g' "$runtime"
sed -i '' 's#/opt/mlops-sdk#/opt/prizm-sdk#g' "airflow/Dockerfile"
```

- [ ] **Step 5: 남은 참조가 없는지, 인프라 이름은 안 건드렸는지 확인**

```bash
cd ~/Workspace/notebook/prototype
echo "=== 남은 mlops 임포트/속성 참조 (0건이어야 함, runs/·backup 제외) ==="
grep -rlE '\bimport mlops\b|\bmlops\.' \
  --include="*.py" --include="*.ipynb" --include="*.toml" \
  sdk airflow seed portal notebooks 2>/dev/null
echo "=== 환경변수 이름은 그대로인지 (여러 건 나와야 정상) ==="
grep -c "MLOPS_BUCKET\|MLOPS_AI_HUB_URL\|MLOPS_S3_" docker-compose.yml
echo "=== 설치 경로가 바뀌었는지 ==="
grep -n "prizm-sdk\|mlops-sdk" runtime/base/Dockerfile airflow/Dockerfile
```

Expected: 첫 `grep`은 출력 없음(파일 목록이 안 나와야 함). 두 번째는 0보다 큰 숫자. 세 번째는
`/opt/prizm-sdk`만 보이고 `/opt/mlops-sdk`는 안 보여야 함.

- [ ] **Step 6: 두 이미지 재빌드**

```bash
cd ~/Workspace/notebook/prototype
docker build -f runtime/base/Dockerfile -t prizm/runtime-base:v1 .
docker compose build airflow
```

- [ ] **Step 7: SDK가 새 이름으로 정상 임포트되는지 확인**

```bash
docker run --rm prizm/runtime-base:v1 python -c "import prizm; print('prizm sdk import ok')"
docker run --rm prizm/runtime-base:v1 python -c "import mlops" 2>&1 | tail -1
```

Expected: 첫 줄 `prizm sdk import ok`. 둘째 줄은 `ModuleNotFoundError: No module named 'mlops'` —
옛 이름으로는 더 이상 임포트가 안 돼야 새 이름으로 완전히 바뀐 것이다.

- [ ] **Step 8: Phase 1의 E2E를 다시 통과시켜 회귀가 없는지 확인**

```bash
cd ~/Workspace/notebook/prototype
docker compose up -d airflow
sleep 5
```

브라우저에서 `http://localhost:3000/assets/code?asset=PRJ000212-C-0001` → "이 버전으로 실행" →
`epochs=2` → "즉시 실행". Expected: Phase 1 Task 10에서 확인했던 것과 동일하게 성공(mAP50 등록,
`epoch 1/2` 실시간 스트리밍). 이어서 `epochs=0`으로 실패 경로도 확인 —
`ValueError: epochs는 1 이상이어야 합니다`가 그대로 나와야 한다(SDK 이름 변경이 노트북의
비즈니스 로직에 영향을 주면 안 된다).

이 태스크는 git 커밋이 없다(prototype은 git 저장소가 아니다).

---
### Task 6: EditSessionService — 생성·재사용·종료 오케스트레이션

**Files:**
- Create: `src/main/java/com/prizm/backend/edit/EditSessionService.java`
- Create: `src/main/java/com/prizm/backend/api/EditSessionLaunchException.java`
- Create: `src/main/java/com/prizm/backend/api/EditSessionNotFoundException.java`
- Modify: `src/main/java/com/prizm/backend/api/ApiExceptionHandler.java`
- Test: `src/test/java/com/prizm/backend/edit/EditSessionServiceTest.java`

**Interfaces:**
- Consumes: `EditSessionRepository`(Task 2), `EditSessionContainerLauncher`·`JupyterReadinessChecker`(Task 4), `CodeAssetCatalog`·`EnvironmentService`·`BaseImageResolver`(Phase 1)
- Produces:
  - `EditSessionService.createOrReuse(String ownerId, String assetId, String assetVersion)` → `EditSession`
  - `EditSessionService.getForOwner(String sessionId, String requesterId)` → `EditSession` (소유자가 아니거나 없으면 `EditSessionNotFoundException` — 존재 여부를 노출하지 않기 위해 403 대신 항상 404)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/edit/EditSessionServiceTest.java`:

```java
package com.prizm.backend.edit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.prizm.backend.TestFixtures;
import com.prizm.backend.api.EditSessionLaunchException;
import com.prizm.backend.api.EditSessionNotFoundException;
import com.prizm.backend.api.InvalidRunRequestException;
import com.prizm.backend.asset.CodeAssetCatalog;
import com.prizm.backend.environment.BaseImageResolver;
import com.prizm.backend.environment.CommandRunner;
import com.prizm.backend.environment.EnvironmentBuild;
import com.prizm.backend.environment.EnvironmentService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EditSessionServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-19T02:00:00Z");
    private static final String BASE_IMAGE = "prizm/runtime-base:v1";
    private static final String BASE_DIGEST = "sha256:abc";
    private static final String ENV_IMAGE = "prizm/env:key";

    @Mock private EditSessionRepository repository;
    @Mock private CodeAssetCatalog catalog;
    @Mock private EnvironmentService environments;
    @Mock private BaseImageResolver baseImageResolver;
    @Mock private EditSessionContainerLauncher launcher;
    @Mock private JupyterReadinessChecker readinessChecker;
    @Mock private CommandRunner commandRunner;

    private EditSessionService service;

    private static EnvironmentBuild readyEnvironment() {
        EnvironmentBuild build = EnvironmentBuild.pending("key", BASE_IMAGE, BASE_DIGEST, "", "", "r1", NOW);
        build.markReady(ENV_IMAGE, NOW);
        return build;
    }

    @BeforeEach
    void setUp() {
        service = new EditSessionService(repository, catalog, environments, baseImageResolver,
                launcher, readinessChecker, commandRunner,
                new com.prizm.backend.config.PrizmProperties.EditSession(
                        java.nio.file.Path.of("/tmp/prizm-edit-sessions-test"), Duration.ofMinutes(30),
                        Duration.ofSeconds(20)),
                new com.prizm.backend.config.PrizmProperties.MlopsSdk("http://ai-hub.test:8000",
                        "http://minio.test:9000", "minioadmin", "minioadmin", "mlops-assets"),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void reusesExistingSessionForSameAssetAndVersion() {
        EditSession existing = EditSession.creating("SESSION-OLD", "user-1", "PRJ000212-C-0001", "v2.4.1", NOW);
        existing.markReady("container-old", 49111, "token-old", NOW);
        when(repository.findByOwnerIdAndStatusIn("user-1", List.of(EditSessionStatus.CREATING, EditSessionStatus.READY)))
                .thenReturn(List.of(existing));

        EditSession result = service.createOrReuse("user-1", "PRJ000212-C-0001", "v2.4.1");

        assertThat(result).isSameAs(existing);
        verify(launcher, never()).launch(any(), any(), any());
    }

    @Test
    void terminatesOldSessionAndDeletesItsDirectoryWhenSwitchingAssets() {
        EditSession existing = EditSession.creating("SESSION-OLD", "user-1", "PRJ000212-C-0001", "v2.4.1", NOW);
        existing.markReady("container-old", 49111, "token-old", NOW);
        when(repository.findByOwnerIdAndStatusIn("user-1", List.of(EditSessionStatus.CREATING, EditSessionStatus.READY)))
                .thenReturn(List.of(existing));
        when(catalog.find("PRJ000212-C-0002", "v1.0.0")).thenReturn(
                new com.prizm.backend.asset.CodeAssetProperties("PRJ000212-C-0002", "v1.0.0",
                        "demo.other", "v1", BASE_IMAGE, "", java.util.Map.of()));
        when(baseImageResolver.digest(BASE_IMAGE)).thenReturn(BASE_DIGEST);
        when(environments.ensure(BASE_IMAGE, BASE_DIGEST, "")).thenReturn(readyEnvironment());
        when(commandRunner.run(any(), any(), any())).thenReturn(new CommandRunner.CommandResult(0, "ok"));
        when(launcher.launch(any(), eq(ENV_IMAGE), any())).thenReturn(
                new EditSessionContainerLauncher.LaunchOutcome(true, "container-new", 49222, "token-new", "ok"));
        when(readinessChecker.isReady(49222, "token-new", Duration.ofSeconds(20))).thenReturn(true);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        EditSession result = service.createOrReuse("user-1", "PRJ000212-C-0002", "v1.0.0");

        assertThat(result.getAssetId()).isEqualTo("PRJ000212-C-0002");
        assertThat(result.getStatus()).isEqualTo(EditSessionStatus.READY);
        verify(launcher).stop("container-old");
        assertThat(existing.getStatus()).isEqualTo(EditSessionStatus.TERMINATED);
    }

    @Test
    void refusesToCreateWhileEnvironmentIsStillBuilding() {
        when(repository.findByOwnerIdAndStatusIn(any(), anyList())).thenReturn(List.of());
        when(catalog.find("PRJ000212-C-0001", "v2.4.1")).thenReturn(TestFixtures.weldAsset());
        when(baseImageResolver.digest(BASE_IMAGE)).thenReturn(BASE_DIGEST);
        EnvironmentBuild building = EnvironmentBuild.pending("key", BASE_IMAGE, BASE_DIGEST, "", "", "r1", NOW);
        building.markBuilding(NOW);
        when(environments.ensure(BASE_IMAGE, BASE_DIGEST, "")).thenReturn(building);

        assertThatThrownBy(() -> service.createOrReuse("user-1", "PRJ000212-C-0001", "v2.4.1"))
                .isInstanceOf(InvalidRunRequestException.class)
                .hasMessage("실행 환경이 아직 준비되지 않았습니다 (상태: BUILDING)");
        verify(launcher, never()).launch(any(), any(), any());
    }

    @Test
    void marksFailedAndThrowsWhenContainerLaunchFails() {
        when(repository.findByOwnerIdAndStatusIn(any(), anyList())).thenReturn(List.of());
        when(catalog.find("PRJ000212-C-0001", "v2.4.1")).thenReturn(TestFixtures.weldAsset());
        when(baseImageResolver.digest(BASE_IMAGE)).thenReturn(BASE_DIGEST);
        when(environments.ensure(BASE_IMAGE, BASE_DIGEST, "")).thenReturn(readyEnvironment());
        when(commandRunner.run(any(), any(), any())).thenReturn(new CommandRunner.CommandResult(0, "ok"));
        when(launcher.launch(any(), eq(ENV_IMAGE), any())).thenReturn(
                new EditSessionContainerLauncher.LaunchOutcome(false, null, 0, null, "docker: no such image"));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThatThrownBy(() -> service.createOrReuse("user-1", "PRJ000212-C-0001", "v2.4.1"))
                .isInstanceOf(EditSessionLaunchException.class);

        verify(repository, times(2)).save(any()); // CREATING 저장 + FAILED 저장
    }

    @Test
    void stopsContainerAndMarksFailedWhenReadinessTimesOut() {
        when(repository.findByOwnerIdAndStatusIn(any(), anyList())).thenReturn(List.of());
        when(catalog.find("PRJ000212-C-0001", "v2.4.1")).thenReturn(TestFixtures.weldAsset());
        when(baseImageResolver.digest(BASE_IMAGE)).thenReturn(BASE_DIGEST);
        when(environments.ensure(BASE_IMAGE, BASE_DIGEST, "")).thenReturn(readyEnvironment());
        when(commandRunner.run(any(), any(), any())).thenReturn(new CommandRunner.CommandResult(0, "ok"));
        when(launcher.launch(any(), eq(ENV_IMAGE), any())).thenReturn(
                new EditSessionContainerLauncher.LaunchOutcome(true, "container-new", 49222, "token-new", "ok"));
        when(readinessChecker.isReady(49222, "token-new", Duration.ofSeconds(20))).thenReturn(false);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThatThrownBy(() -> service.createOrReuse("user-1", "PRJ000212-C-0001", "v2.4.1"))
                .isInstanceOf(EditSessionLaunchException.class);

        verify(launcher).stop("container-new");
    }

    @Test
    void getForOwnerReturnsSessionForMatchingOwner() {
        EditSession session = EditSession.creating("SESSION-1", "user-1", "PRJ000212-C-0001", "v2.4.1", NOW);
        when(repository.findById("SESSION-1")).thenReturn(Optional.of(session));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        EditSession result = service.getForOwner("SESSION-1", "user-1");

        assertThat(result).isSameAs(session);
    }

    @Test
    void getForOwnerHidesSessionFromNonOwnerBehindNotFound() {
        EditSession session = EditSession.creating("SESSION-1", "user-1", "PRJ000212-C-0001", "v2.4.1", NOW);
        when(repository.findById("SESSION-1")).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.getForOwner("SESSION-1", "user-2"))
                .isInstanceOf(EditSessionNotFoundException.class);
    }

    @Test
    void getForOwnerThrowsNotFoundForUnknownSession() {
        when(repository.findById("SESSION-X")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getForOwner("SESSION-X", "user-1"))
                .isInstanceOf(EditSessionNotFoundException.class);
    }
}
```

이 테스트 파일은 `import static org.mockito.ArgumentMatchers.eq;`도 필요하다 — 위 목록에 빠졌으니 작성 시 추가한다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*EditSessionServiceTest'`
Expected: 컴파일 실패 — `EditSessionService`, `EditSessionLaunchException`, `EditSessionNotFoundException` 없음

- [ ] **Step 3: 예외 클래스 작성**

`src/main/java/com/prizm/backend/api/EditSessionLaunchException.java`:

```java
package com.prizm.backend.api;

/** 502 Bad Gateway로 응답할 편집 세션 기동 실패. */
public class EditSessionLaunchException extends RuntimeException {

    public EditSessionLaunchException(String message) {
        super(message);
    }
}
```

`src/main/java/com/prizm/backend/api/EditSessionNotFoundException.java`:

```java
package com.prizm.backend.api;

/** 404 Not Found로 응답할 편집 세션 조회 오류. 소유자가 아닌 요청도 이 예외로 처리해
 * 세션 존재 여부 자체를 숨긴다. */
public class EditSessionNotFoundException extends RuntimeException {

    public EditSessionNotFoundException(String sessionId) {
        super("편집 세션을 찾을 수 없습니다: " + sessionId);
    }
}
```

- [ ] **Step 4: 서비스 작성**

`src/main/java/com/prizm/backend/edit/EditSessionService.java`:

```java
package com.prizm.backend.edit;

import com.prizm.backend.api.EditSessionLaunchException;
import com.prizm.backend.api.EditSessionNotFoundException;
import com.prizm.backend.api.InvalidRunRequestException;
import com.prizm.backend.asset.CodeAssetCatalog;
import com.prizm.backend.asset.CodeAssetProperties;
import com.prizm.backend.config.PrizmProperties;
import com.prizm.backend.environment.BaseImageResolver;
import com.prizm.backend.environment.CommandRunner;
import com.prizm.backend.environment.EnvironmentBuild;
import com.prizm.backend.environment.EnvironmentBuildStatus;
import com.prizm.backend.environment.EnvironmentService;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** 사용자당 편집 세션 1개 정책의 생성·재사용·종료를 담당한다. */
@Service
public class EditSessionService {

    private static final Logger log = LoggerFactory.getLogger(EditSessionService.class);
    private static final List<EditSessionStatus> ACTIVE = List.of(EditSessionStatus.CREATING, EditSessionStatus.READY);
    private static final Duration DOWNLOAD_TIMEOUT = Duration.ofMinutes(2);

    private final EditSessionRepository repository;
    private final CodeAssetCatalog catalog;
    private final EnvironmentService environments;
    private final BaseImageResolver baseImageResolver;
    private final EditSessionContainerLauncher launcher;
    private final JupyterReadinessChecker readinessChecker;
    private final CommandRunner commandRunner;
    private final PrizmProperties.EditSession properties;
    private final PrizmProperties.MlopsSdk mlopsSdk;
    private final Clock clock;

    public EditSessionService(EditSessionRepository repository, CodeAssetCatalog catalog,
            EnvironmentService environments, BaseImageResolver baseImageResolver,
            EditSessionContainerLauncher launcher, JupyterReadinessChecker readinessChecker,
            CommandRunner commandRunner, PrizmProperties.EditSession properties,
            PrizmProperties.MlopsSdk mlopsSdk, Clock clock) {
        this.repository = repository;
        this.catalog = catalog;
        this.environments = environments;
        this.baseImageResolver = baseImageResolver;
        this.launcher = launcher;
        this.readinessChecker = readinessChecker;
        this.commandRunner = commandRunner;
        this.properties = properties;
        this.mlopsSdk = mlopsSdk;
        this.clock = clock;
    }

    public EditSession createOrReuse(String ownerId, String assetId, String assetVersion) {
        List<EditSession> active = repository.findByOwnerIdAndStatusIn(ownerId, ACTIVE);
        if (!active.isEmpty()) {
            EditSession current = active.get(0);
            if (current.getAssetId().equals(assetId) && current.getAssetVersion().equals(assetVersion)) {
                current.touch(clock.instant());
                return repository.save(current);
            }
            terminateAndCleanUp(current);
        }
        return create(ownerId, assetId, assetVersion);
    }

    public EditSession getForOwner(String sessionId, String requesterId) {
        EditSession session = repository.findById(sessionId)
                .orElseThrow(() -> new EditSessionNotFoundException(sessionId));
        if (!session.getOwnerId().equals(requesterId)) {
            throw new EditSessionNotFoundException(sessionId);
        }
        session.touch(clock.instant());
        return repository.save(session);
    }

    private EditSession create(String ownerId, String assetId, String assetVersion) {
        CodeAssetProperties asset = catalog.find(assetId, assetVersion);
        EnvironmentBuild environment = environments.ensure(
                asset.baseImage(), baseImageResolver.digest(asset.baseImage()), asset.requirements());
        if (environment.getStatus() != EnvironmentBuildStatus.READY) {
            throw new InvalidRunRequestException(
                    "실행 환경이 아직 준비되지 않았습니다 (상태: " + environment.getStatus() + ")");
        }

        String sessionId = "EDIT-" + UUID.randomUUID();
        EditSession session = EditSession.creating(sessionId, ownerId, assetId, assetVersion, clock.instant());
        repository.save(session);

        Path hostDir = properties.hostSessionsRoot().resolve(sessionId);
        try {
            Files.createDirectories(hostDir);
        } catch (IOException e) {
            throw new UncheckedIOException("세션 작업 디렉터리를 만들 수 없습니다: " + hostDir, e);
        }

        if (!downloadNotebook(hostDir, environment.getImageRef(), asset)) {
            session.markFailed("노트북을 내려받지 못했습니다", clock.instant());
            repository.save(session);
            throw new EditSessionLaunchException("노트북을 내려받지 못했습니다: " + sessionId);
        }

        EditSessionContainerLauncher.LaunchOutcome outcome =
                launcher.launch(sessionId, environment.getImageRef(), hostDir);
        if (!outcome.succeeded()) {
            session.markFailed("편집 세션 컨테이너를 시작하지 못했습니다", clock.instant());
            repository.save(session);
            throw new EditSessionLaunchException("편집 세션 컨테이너를 시작하지 못했습니다: " + sessionId);
        }

        boolean ready = readinessChecker.isReady(outcome.hostPort(), outcome.jupyterToken(), properties.readyTimeout());
        if (!ready) {
            launcher.stop(outcome.containerId());
            session.markFailed("JupyterLab이 제한 시간 안에 응답하지 않았습니다", clock.instant());
            repository.save(session);
            throw new EditSessionLaunchException("JupyterLab이 제한 시간 안에 응답하지 않았습니다: " + sessionId);
        }

        session.markReady(outcome.containerId(), outcome.hostPort(), outcome.jupyterToken(), clock.instant());
        return repository.save(session);
    }

    private boolean downloadNotebook(Path hostDir, String imageRef, CodeAssetProperties asset) {
        String script = "import prizm; prizm.code.download('" + asset.codeKey() + "', '" + asset.codeVersion()
                + "', dest_dir='/opt/prizm/edit')";
        List<String> command = List.of(
                "docker", "run", "--rm",
                "-v", hostDir + ":/opt/prizm/edit",
                "-e", "MLOPS_AI_HUB_URL=" + mlopsSdk.aiHubUrl(),
                "-e", "MLOPS_S3_ENDPOINT=" + mlopsSdk.s3Endpoint(),
                "-e", "MLOPS_S3_ACCESS_KEY=" + mlopsSdk.s3AccessKey(),
                "-e", "MLOPS_S3_SECRET_KEY=" + mlopsSdk.s3SecretKey(),
                "-e", "MLOPS_BUCKET=" + mlopsSdk.bucket(),
                imageRef, "python", "-c", script);
        CommandRunner.CommandResult result = commandRunner.run(command, hostDir, DOWNLOAD_TIMEOUT);
        if (!result.succeeded()) {
            log.warn("노트북 다운로드 실패: {}", result.output());
        }
        return result.succeeded();
    }

    /** 종료 시 호스트 디렉터리를 지운다 - 미등록 편집 내용은 여기서 사라진다(설계 결정,
     * §6 참고). AI Hub엔 드래프트 저장 기능이 없어 "새 버전으로 등록"을 누르지 않은
     * 내용을 보존할 방법이 없다. */
    private void terminateAndCleanUp(EditSession session) {
        launcher.stop(session.getContainerId());
        session.markTerminated(clock.instant());
        repository.save(session);
        deleteHostDir(session.getSessionId());
    }

    private void deleteHostDir(String sessionId) {
        Path hostDir = properties.hostSessionsRoot().resolve(sessionId);
        try (var paths = Files.walk(hostDir)) {
            paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.delete(path);
                } catch (IOException e) {
                    log.warn("세션 디렉터리 정리 실패: {}", path);
                }
            });
        } catch (IOException e) {
            log.warn("세션 디렉터리를 열 수 없습니다: {}", hostDir);
        }
    }
}
```

- [ ] **Step 5: 예외 핸들러에 두 핸들러 추가**

`src/main/java/com/prizm/backend/api/ApiExceptionHandler.java`의 `triggerFailed` 핸들러
다음에 추가한다:

```java
    @ExceptionHandler(EditSessionLaunchException.class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    public ApiError editSessionLaunchFailed(EditSessionLaunchException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(EditSessionNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiError editSessionNotFound(EditSessionNotFoundException e) {
        return new ApiError(e.getMessage());
    }
```

- [ ] **Step 6: 테스트 전체 실행**

Run: `./gradlew test`
Expected: 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/main/java/com/prizm/backend/edit/EditSessionService.java \
        src/main/java/com/prizm/backend/api/EditSessionLaunchException.java \
        src/main/java/com/prizm/backend/api/EditSessionNotFoundException.java \
        src/main/java/com/prizm/backend/api/ApiExceptionHandler.java \
        src/test/java/com/prizm/backend/edit/EditSessionServiceTest.java
git commit -m "feat: 편집 세션 생성·재사용·종료 오케스트레이션 추가

같은 (자산, 버전) 재요청은 기존 세션을 재사용하고, 다른 자산 요청은
기존 세션을 종료(컨테이너 정지 + 호스트 디렉터리 삭제)한 뒤 새로
만든다. AI Hub SDK엔 드래프트 저장 기능이 없어(code.upload가 곧바로
새 버전을 만든다) 미등록 편집 내용은 세션 종료 시 사라진다 - 설계
결정.

노트북 다운로드는 새 Java MinIO 클라이언트를 추가하지 않고, 파생
이미지 안의 prizm SDK를 일회성 컨테이너로 실행해 재사용한다.

세션 조회는 소유자가 아니면 403이 아니라 404로 응답해 세션 존재
여부 자체를 숨긴다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---
### Task 7: 편집 세션 REST API

**Files:**
- Create: `src/main/java/com/prizm/backend/edit/CreateEditSessionRequest.java`
- Create: `src/main/java/com/prizm/backend/edit/EditSessionResponse.java`
- Create: `src/main/java/com/prizm/backend/edit/EditSessionController.java`
- Test: `src/test/java/com/prizm/backend/edit/EditSessionControllerTest.java`

**Interfaces:**
- Consumes: `EditSessionService.createOrReuse`·`getForOwner`(Task 6), `EditSession`(Task 2)
- Produces:
  - `POST /api/edit-sessions` — 본문 `{"assetId": "...", "version": "...", "ownerId": "..."}` → 200,
    본문 `{"sessionId", "status", "proxyBase", "hostPort", "jupyterToken", "errorMessage"}`.
    `ownerId`는 포털이 쿠키에서 뽑아 그대로 넘긴다 — 백엔드는 쿠키를 모른다.
  - `GET /api/edit-sessions/{sessionId}?requesterId=...` → 200, 같은 본문 형태. 프록시가 매
    요청마다 이 엔드포인트로 소유권을 확인한다

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/edit/EditSessionControllerTest.java`:

```java
package com.prizm.backend.edit;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.prizm.backend.api.ApiExceptionHandler;
import com.prizm.backend.api.EditSessionNotFoundException;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class EditSessionControllerTest {

    private static final Instant NOW = Instant.parse("2026-09-19T02:00:00Z");
    private static final String BODY = """
            {"assetId": "PRJ000212-C-0001", "version": "v2.4.1", "ownerId": "user-1"}
            """;

    @Mock
    private EditSessionService service;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new EditSessionController(service))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    private EditSession readySession() {
        EditSession session = EditSession.creating("EDIT-1", "user-1", "PRJ000212-C-0001", "v2.4.1", NOW);
        session.markReady("container-1", 49222, "token-1", NOW);
        return session;
    }

    @Test
    void createsSessionAndReturnsProxyDetails() throws Exception {
        when(service.createOrReuse("user-1", "PRJ000212-C-0001", "v2.4.1")).thenReturn(readySession());

        mockMvc.perform(post("/api/edit-sessions").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value("EDIT-1"))
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.hostPort").value(49222))
                .andExpect(jsonPath("$.jupyterToken").value("token-1"));
    }

    @Test
    void getReturnsSessionForOwner() throws Exception {
        when(service.getForOwner("EDIT-1", "user-1")).thenReturn(readySession());

        mockMvc.perform(get("/api/edit-sessions/EDIT-1").param("requesterId", "user-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));
    }

    @Test
    void getReturnsNotFoundForNonOwner() throws Exception {
        when(service.getForOwner("EDIT-1", "user-2")).thenThrow(new EditSessionNotFoundException("EDIT-1"));

        mockMvc.perform(get("/api/edit-sessions/EDIT-1").param("requesterId", "user-2"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("편집 세션을 찾을 수 없습니다: EDIT-1"));
    }

    @Test
    void rejectsMissingAssetIdWithBadRequest() throws Exception {
        mockMvc.perform(post("/api/edit-sessions").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"assetId": "", "version": "v2.4.1", "ownerId": "user-1"}
                                """))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*EditSessionControllerTest'`
Expected: 컴파일 실패 — 세 클래스 없음

- [ ] **Step 3: 요청·응답 레코드 작성**

`src/main/java/com/prizm/backend/edit/CreateEditSessionRequest.java`:

```java
package com.prizm.backend.edit;

import jakarta.validation.constraints.NotBlank;

public record CreateEditSessionRequest(
        @NotBlank String assetId,
        @NotBlank String version,
        @NotBlank String ownerId) {
}
```

`src/main/java/com/prizm/backend/edit/EditSessionResponse.java`:

```java
package com.prizm.backend.edit;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EditSessionResponse(String sessionId, String status, String proxyBase, Integer hostPort,
        String jupyterToken, String errorMessage) {

    public static EditSessionResponse from(EditSession session) {
        return new EditSessionResponse(
                session.getSessionId(),
                session.getStatus().name(),
                "http://localhost:" + session.getHostPort(),
                session.getHostPort() == 0 ? null : session.getHostPort(),
                session.getJupyterToken(),
                session.getErrorMessage());
    }
}
```

- [ ] **Step 4: 컨트롤러 작성**

`src/main/java/com/prizm/backend/edit/EditSessionController.java`:

```java
package com.prizm.backend.edit;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/edit-sessions")
public class EditSessionController {

    private final EditSessionService service;

    public EditSessionController(EditSessionService service) {
        this.service = service;
    }

    @PostMapping
    public EditSessionResponse create(@Valid @RequestBody CreateEditSessionRequest request) {
        return EditSessionResponse.from(
                service.createOrReuse(request.ownerId(), request.assetId(), request.version()));
    }

    @GetMapping("/{sessionId}")
    public EditSessionResponse get(@PathVariable String sessionId, @RequestParam String requesterId) {
        return EditSessionResponse.from(service.getForOwner(sessionId, requesterId));
    }
}
```

- [ ] **Step 5: 테스트 전체 실행**

Run: `./gradlew test`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/main/java/com/prizm/backend/edit/CreateEditSessionRequest.java \
        src/main/java/com/prizm/backend/edit/EditSessionResponse.java \
        src/main/java/com/prizm/backend/edit/EditSessionController.java \
        src/test/java/com/prizm/backend/edit/EditSessionControllerTest.java
git commit -m "feat: 편집 세션 REST API 추가

POST /api/edit-sessions는 세션을 생성·재사용하고, GET .../{id}는
프록시가 매 요청마다 소유권을 확인하는 데 쓴다. ownerId는 포털이
쿠키에서 뽑아 그대로 넘긴다 - 백엔드는 쿠키를 직접 다루지 않는다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---
### Task 8: 유휴 회수 스케줄러 + 기동 시 리컨사일러

**Files:**
- Modify: `src/main/java/com/prizm/backend/edit/EditSessionService.java` (private → public 메서드 하나)
- Create: `src/main/java/com/prizm/backend/edit/EditSessionScheduler.java`
- Create: `src/main/java/com/prizm/backend/edit/EditSessionReconciler.java`
- Test: `src/test/java/com/prizm/backend/edit/EditSessionSchedulerTest.java`
- Test: `src/test/java/com/prizm/backend/edit/EditSessionReconcilerTest.java`

**Interfaces:**
- Consumes: `EditSessionService`(Task 6, 아래에서 `terminate`를 public으로 바꾼다), `EditSessionRepository`·`EditSession`(Task 2)
- Produces: `EditSessionService.terminate(EditSession session)`(public), `@Scheduled` 유휴 회수, `ApplicationRunner` 리컨사일러

- [ ] **Step 1: EditSessionService의 종료 메서드를 public으로 바꾼다**

`src/main/java/com/prizm/backend/edit/EditSessionService.java`에서:

```java
    private void terminateAndCleanUp(EditSession session) {
```

를:

```java
    /** 세션을 종료하고 컨테이너·호스트 디렉터리를 정리한다. createOrReuse의 전환 경로와
     * EditSessionScheduler의 유휴 회수가 함께 쓴다. */
    public void terminate(EditSession session) {
```

로 바꾸고, `createOrReuse` 안의 호출부(`terminateAndCleanUp(current);`)도 `terminate(current);`로 바꾼다. 기존 `EditSessionServiceTest`의 `terminatesOldSessionAndDeletesItsDirectoryWhenSwitchingAssets` 테스트는 동작이 그대로이므로 수정할 필요 없다.

- [ ] **Step 2: 스케줄러 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/edit/EditSessionSchedulerTest.java`:

```java
package com.prizm.backend.edit;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EditSessionSchedulerTest {

    private static final Instant NOW = Instant.parse("2026-09-19T03:00:00Z");

    @Mock
    private EditSessionRepository repository;
    @Mock
    private EditSessionService service;

    private EditSessionScheduler scheduler;

    private void setUp(Duration idleTimeout) {
        scheduler = new EditSessionScheduler(repository, service,
                new com.prizm.backend.config.PrizmProperties.EditSession(
                        java.nio.file.Path.of("/tmp/x"), idleTimeout, Duration.ofSeconds(20)),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void terminatesSessionsIdleLongerThanTimeout() {
        setUp(Duration.ofMinutes(30));
        EditSession idle = EditSession.creating("EDIT-1", "user-1", "PRJ000212-C-0001", "v2.4.1",
                NOW.minus(Duration.ofMinutes(40)));
        idle.markReady("container-1", 49222, "token-1", NOW.minus(Duration.ofMinutes(40)));
        when(repository.findByStatus(EditSessionStatus.READY)).thenReturn(List.of(idle));

        scheduler.reclaimIdleSessions();

        verify(service).terminate(idle);
    }

    @Test
    void leavesRecentlyActiveSessionsAlone() {
        setUp(Duration.ofMinutes(30));
        EditSession active = EditSession.creating("EDIT-1", "user-1", "PRJ000212-C-0001", "v2.4.1",
                NOW.minus(Duration.ofMinutes(5)));
        active.markReady("container-1", 49222, "token-1", NOW.minus(Duration.ofMinutes(5)));
        when(repository.findByStatus(EditSessionStatus.READY)).thenReturn(List.of(active));

        scheduler.reclaimIdleSessions();

        verify(service, never()).terminate(any());
    }
}
```

- [ ] **Step 3: 리컨사일러 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/edit/EditSessionReconcilerTest.java`:

```java
package com.prizm.backend.edit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EditSessionReconcilerTest {

    @Mock
    private EditSessionRepository repository;

    @Test
    void resetsStuckCreatingSessionsToTerminated() {
        EditSession stuck = EditSession.creating("EDIT-1", "user-1", "PRJ000212-C-0001", "v2.4.1",
                Instant.parse("2026-09-19T01:00:00Z"));
        when(repository.findByStatus(EditSessionStatus.CREATING)).thenReturn(List.of(stuck));
        when(repository.findByStatus(EditSessionStatus.READY)).thenReturn(List.of());

        new EditSessionReconciler(repository).run(null);

        assertThat(stuck.getStatus()).isEqualTo(EditSessionStatus.TERMINATED);
        verify(repository).saveAll(List.of(stuck));
    }

    @Test
    void doesNothingWhenNoStuckSessions() {
        when(repository.findByStatus(EditSessionStatus.CREATING)).thenReturn(List.of());
        when(repository.findByStatus(EditSessionStatus.READY)).thenReturn(List.of());

        new EditSessionReconciler(repository).run(null);

        verify(repository, never()).saveAll(any());
    }
}
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*EditSessionSchedulerTest' --tests '*EditSessionReconcilerTest'`
Expected: 컴파일 실패 — 두 클래스 없음

- [ ] **Step 5: 스케줄러 작성**

`src/main/java/com/prizm/backend/edit/EditSessionScheduler.java`:

```java
package com.prizm.backend.edit;

import com.prizm.backend.config.PrizmProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 30분 이상 활동 없는 READY 세션을 회수한다. Phase 1의 EnvironmentService.processPendingBuilds
 * 와 같은 스케줄링 게이트(prizm.monitor.enabled)를 공유한다 - SchedulingConfig 참고. */
@Component
public class EditSessionScheduler {

    private static final Logger log = LoggerFactory.getLogger(EditSessionScheduler.class);
    private static final int POLL_INTERVAL_MS = 60_000;

    private final EditSessionRepository repository;
    private final EditSessionService service;
    private final PrizmProperties.EditSession properties;
    private final Clock clock;

    public EditSessionScheduler(EditSessionRepository repository, EditSessionService service,
            PrizmProperties.EditSession properties, Clock clock) {
        this.repository = repository;
        this.service = service;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(fixedDelay = POLL_INTERVAL_MS)
    public void reclaimIdleSessions() {
        Instant cutoff = clock.instant().minus(properties.idleTimeout());
        for (EditSession session : repository.findByStatus(EditSessionStatus.READY)) {
            if (session.getLastActivityAt().isBefore(cutoff)) {
                log.info("유휴 편집 세션 회수: {} (마지막 활동 {})", session.getSessionId(), session.getLastActivityAt());
                service.terminate(session);
            }
        }
    }
}
```

`(clock.instant() - Duration)`가 60초 폴링 주기보다 훨씬 크게 잡혀 있으니 회수 시점이 최대 1분 정도 늦어질 수 있다 — 30분 유휴 정책에서 문제되지 않는다.

- [ ] **Step 6: 리컨사일러 작성**

`src/main/java/com/prizm/backend/edit/EditSessionReconciler.java`:

```java
package com.prizm.backend.edit;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** 백엔드가 세션 도중(CREATING) 재시작·크래시되면 그 행이 영원히 CREATING으로 남는다.
 * 기동 시 TERMINATED로 정리한다 - Phase 1의 EnvironmentBuildReconciler와 같은 패턴이다.
 * READY 세션은 컨테이너가 실제로 아직 떠 있을 수 있으므로(정상적인 재시작) 건드리지 않는다
 * - 다음 프록시 요청이나 유휴 스케줄러가 알아서 처리한다. */
@Component
public class EditSessionReconciler implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EditSessionReconciler.class);

    private final EditSessionRepository repository;

    public EditSessionReconciler(EditSessionRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<EditSession> stuck = repository.findByStatus(EditSessionStatus.CREATING);
        if (stuck.isEmpty()) {
            return;
        }
        log.warn("기동 시 CREATING 상태로 남아있던 편집 세션 {}건을 종료 처리합니다: {}",
                stuck.size(), stuck.stream().map(EditSession::getSessionId).toList());
        List<EditSession> updated = new ArrayList<>();
        for (EditSession session : stuck) {
            session.markTerminated(Instant.now());
            updated.add(session);
        }
        repository.saveAll(updated);
    }
}
```

- [ ] **Step 7: 테스트 전체 실행**

Run: `./gradlew test`
Expected: 전부 PASS

- [ ] **Step 8: 커밋**

```bash
git add src/main/java/com/prizm/backend/edit/ src/test/java/com/prizm/backend/edit/
git commit -m "feat: 편집 세션 유휴 회수와 기동 시 리컨사일러 추가

30분 이상 활동 없는 READY 세션을 회수한다(컨테이너 정지 + 호스트
디렉터리 삭제, EditSessionService.terminate 재사용). 기동 시 CREATING
으로 고착된 세션은 TERMINATED로 정리한다 - READY는 건드리지 않는다
(컨테이너가 실제로 살아있을 수 있는 정상 재시작 케이스이므로).

Phase 1의 EnvironmentBuildReconciler·processPendingBuilds와 같은
패턴이다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---
### Task 9: 포털 — 세션 생성 릴레이 라우트 (쿠키 발급)

**Files:**
- Create: `app/api/edit-sessions/route.ts`
- Create: `lib/edit-session-api.ts`

**Interfaces:**
- Consumes: 백엔드의 `POST /api/edit-sessions`(Task 7), `@/lib/prizm-api`의 `PRIZM_API_BASE`
- Produces:
  - `POST /api/edit-sessions`(포털 자체 라우트) — 브라우저가 부르는 지점. `prizm_user_id` 쿠키가 없으면 발급하고, 백엔드로 위임한 뒤 결과를 그대로 돌려준다
  - `lib/edit-session-api.ts`의 `createEditSession(assetId: string, version: string): Promise<EditSessionInfo>` — 컴포넌트가 쓰는 타입 있는 클라이언트

이 라우트는 이 저장소의 첫 Route Handler다 — 참고할 기존 패턴이 없다. `next.config.ts`에 특별한 설정은 필요 없다(App Router의 파일 기반 규칙을 vinext가 그대로 따른다).

- [ ] **Step 1: 라우트 작성**

`app/api/edit-sessions/route.ts`:

```typescript
import { PRIZM_API_BASE } from '@/lib/prizm-api';

const COOKIE_NAME = 'prizm_user_id';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1년

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function POST(request: Request) {
  let body: { assetId?: string; version?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: '요청 본문을 읽을 수 없습니다' }, { status: 400 });
  }
  if (!body.assetId || !body.version) {
    return Response.json({ message: 'assetId와 version이 필요합니다' }, { status: 400 });
  }

  let ownerId = readCookie(request, COOKIE_NAME);
  const isNewCookie = !ownerId;
  if (!ownerId) {
    ownerId = crypto.randomUUID();
  }

  const backendResponse = await fetch(`${PRIZM_API_BASE}/api/edit-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId: body.assetId, version: body.version, ownerId }),
  });
  const responseBody = await backendResponse.text();

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (isNewCookie) {
    headers.set(
      'Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(ownerId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    );
  }
  return new Response(responseBody, { status: backendResponse.status, headers });
}
```

- [ ] **Step 2: 타입 있는 클라이언트 작성**

`lib/edit-session-api.ts`:

```typescript
export type EditSessionStatus = 'CREATING' | 'READY' | 'FAILED' | 'TERMINATED';

export type EditSessionInfo = {
  sessionId: string;
  status: EditSessionStatus;
  proxyBase: string;
  hostPort: number | null;
  jupyterToken: string | null;
  errorMessage: string | null;
};

export class EditSessionApiError extends Error {}

export async function createEditSession(assetId: string, version: string): Promise<EditSessionInfo> {
  let response: Response;
  try {
    response = await fetch('/api/edit-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, version }),
    });
  } catch {
    throw new EditSessionApiError('편집 세션 서버(포털)에 연결할 수 없습니다');
  }
  const data = (await response.json().catch(() => ({}))) as Partial<EditSessionInfo> & { message?: string };
  if (!response.ok) {
    throw new EditSessionApiError(data.message ?? `편집 세션 생성 실패 (${response.status})`);
  }
  return data as EditSessionInfo;
}
```

- [ ] **Step 3: 타입 체크·린트**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
npx tsc --noEmit
npx oxlint app/api/edit-sessions/route.ts lib/edit-session-api.ts
```

Expected: 둘 다 에러 없음

- [ ] **Step 4: 쿠키 발급이 실제로 동작하는지 확인**

백엔드(`prizm-backend`)와 포털(`npm run dev`)을 모두 띄운 상태에서:

```bash
curl -i -X POST http://localhost:3000/api/edit-sessions \
  -H 'Content-Type: application/json' \
  -d '{"assetId": "PRJ000212-C-0001", "version": "v2.4.1"}' 2>&1 | head -20
```

Expected: 응답 헤더에 `Set-Cookie: prizm_user_id=...`가 보인다(쿠키 없이 첫 요청했으므로). 본문은 세션 생성 결과(이 시점엔 Task 4~6의 컨테이너 기동까지 전부 구현돼 있어야 실제로 성공한다 — 지금은 Task 7까지 끝났으므로 실패해도 이 태스크에서는 "백엔드로 요청이 전달되고 쿠키가 발급됐는지"만 확인하면 된다. `502`나 `400`이 나와도 `Set-Cookie` 헤더가 있으면 이 태스크는 통과다).

같은 쿠키로 다시 요청하면 `Set-Cookie`가 없어야 한다:

```bash
curl -s -X POST http://localhost:3000/api/edit-sessions \
  -H 'Content-Type: application/json' -H 'Cookie: prizm_user_id=test-existing-id' \
  -d '{"assetId": "PRJ000212-C-0001", "version": "v2.4.1"}' -i 2>&1 | grep -i "set-cookie"
```

Expected: 출력 없음(기존 쿠키를 그대로 썼다는 뜻).

- [ ] **Step 5: 커밋**

```bash
git add app/api/edit-sessions/route.ts lib/edit-session-api.ts
git commit -m "feat: 편집 세션 생성 릴레이 라우트와 사용자 쿠키 발급

포털의 첫 Route Handler. 브라우저는 이 라우트만 부르고, 이 라우트가
prizm_user_id 쿠키(HttpOnly, 1년)를 확인·발급한 뒤 백엔드의
POST /api/edit-sessions로 위임한다. 쿠키는 포털 오리진(:3000)에
심어야 나중에 /edit/[sessionId]/** 프록시가 같은 쿠키로 소유권을
판정할 수 있다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---
### Task 10: 포털 — JupyterLab 프록시 (실제 구현)

**Files:**
- Create: `app/edit/[sessionId]/[...path]/route.ts`
- Delete: `app/_ws-spike/route.ts` (Task 1의 임시 검증 코드 — 이 태스크가 실제 대체품이다)

**Interfaces:**
- Consumes: `PRIZM_API_BASE`(`@/lib/prizm-api`), 백엔드의 `GET /api/edit-sessions/{id}?requesterId=`(Task 7), Task 1에서 검증된 WebSocket 브릿지 패턴
- Produces: `/edit/<sessionId>/**`로 들어오는 모든 HTTP 메서드·WebSocket 업그레이드를 해당 JupyterLab 컨테이너로 중계

- [ ] **Step 1: 라우트 작성**

`app/edit/[sessionId]/[...path]/route.ts`:

```typescript
import { PRIZM_API_BASE } from '@/lib/prizm-api';

const COOKIE_NAME = 'prizm_user_id';
const CONNECTION_LOST_MESSAGE = '편집 세션 연결이 끊겼습니다, 다시 시작해 주세요';

type SessionLookup = {
  status: 'CREATING' | 'READY' | 'FAILED' | 'TERMINATED';
  hostPort: number | null;
  jupyterToken: string | null;
};

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

async function lookupSession(sessionId: string, requesterId: string): Promise<SessionLookup | null> {
  let response: Response;
  try {
    response = await fetch(
      `${PRIZM_API_BASE}/api/edit-sessions/${encodeURIComponent(sessionId)}` +
        `?requesterId=${encodeURIComponent(requesterId)}`,
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;
  return (await response.json()) as SessionLookup;
}

function stripHopByHopHeaders(headers: Headers): Headers {
  const result = new Headers(headers);
  result.delete('host');
  result.delete('connection');
  result.delete('cookie'); // 포털 세션 쿠키를 JupyterLab에 보낼 이유가 없다
  return result;
}

async function proxyWebSocket(targetUrl: URL): Promise<Response> {
  const upstreamResponse = await fetch(targetUrl, {
    headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
  });
  const upstreamSocket = (upstreamResponse as unknown as { webSocket: WebSocket | null }).webSocket;
  if (!upstreamSocket) {
    return new Response(CONNECTION_LOST_MESSAGE, { status: 502 });
  }
  upstreamSocket.accept();

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
  server.accept();

  server.addEventListener('message', (event: MessageEvent) => upstreamSocket.send(event.data));
  upstreamSocket.addEventListener('message', (event: MessageEvent) => server.send(event.data));
  server.addEventListener('close', () => upstreamSocket.close());
  upstreamSocket.addEventListener('close', () => server.close());
  server.addEventListener('error', () => upstreamSocket.close());
  upstreamSocket.addEventListener('error', () => server.close());

  return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
}

async function handleProxy(
  request: Request,
  context: { params: Promise<{ sessionId: string; path: string[] }> },
): Promise<Response> {
  const { sessionId, path } = await context.params;
  const requesterId = readCookie(request, COOKIE_NAME);
  if (!requesterId) {
    return new Response(CONNECTION_LOST_MESSAGE, { status: 404 });
  }

  const session = await lookupSession(sessionId, requesterId);
  if (!session || session.status !== 'READY' || !session.hostPort || !session.jupyterToken) {
    return new Response(CONNECTION_LOST_MESSAGE, { status: 404 });
  }

  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`http://localhost:${session.hostPort}/${path.join('/')}`);
  targetUrl.search = incomingUrl.search;
  if (!targetUrl.searchParams.has('token')) {
    targetUrl.searchParams.set('token', session.jupyterToken);
  }

  if (request.headers.get('Upgrade') === 'websocket') {
    return proxyWebSocket(targetUrl);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstreamResponse = await fetch(targetUrl, {
    method: request.method,
    headers: stripHopByHopHeaders(request.headers),
    body: hasBody ? await request.arrayBuffer() : undefined,
  });
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: upstreamResponse.headers,
  });
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
```

`WebSocketPair` 타입이 없다는 TypeScript 에러가 나면 Task 1에서 시도했던 것과 같은 방식(`@cloudflare/workers-types` 참조 또는 `@ts-expect-error`)으로 처리한다 — Task 1이 이미 이 문제를 어떻게 넘겼는지 그 파일(삭제하기 전에)을 참고한다.

- [ ] **Step 2: 스파이크 라우트 삭제**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
rm -rf app/_ws-spike
```

- [ ] **Step 3: 타입 체크·린트**

```bash
npx tsc --noEmit
npx oxlint app/edit/
```

Expected: 에러 없음

- [ ] **Step 4: 실제 세션으로 종단 확인**

이 시점에 Task 1~9가 전부 구현돼 있어야 한다. 포털·백엔드를 띄운 상태에서:

```bash
curl -s -c /tmp/prizm-cookies.txt -X POST http://localhost:3000/api/edit-sessions \
  -H 'Content-Type: application/json' \
  -d '{"assetId": "PRJ000212-C-0001", "version": "v2.4.1"}' | python3 -m json.tool
```

Expected: `"status": "READY"`, `sessionId` 확보. 그 값을 아래에 넣는다.

```bash
SESSION_ID="<위에서 받은 sessionId>"
curl -s -b /tmp/prizm-cookies.txt -o /dev/null -w '%{http_code}\n' \
  "http://localhost:3000/edit/$SESSION_ID/api/status"
```

Expected: `200` — JupyterLab의 상태 API가 프록시를 통해 정상 응답. 다른 쿠키(소유자 아님)로 같은 요청을 하면 `404`가 나오는지도 확인한다:

```bash
curl -s -b "prizm_user_id=someone-else" -o /dev/null -w '%{http_code}\n' \
  "http://localhost:3000/edit/$SESSION_ID/api/status"
```

Expected: `404`

- [ ] **Step 5: 커밋**

```bash
git add app/edit/ app/_ws-spike
git commit -m "feat: JupyterLab 편집 세션 프록시 구현

Task 1에서 검증한 WebSocketPair + fetch().webSocket 패턴을 실제
프록시로 확장했다. 매 요청마다 백엔드에 소유권을 확인하고(캐싱 없음),
Jupyter 자체 토큰은 서버 사이드로만 주입해 브라우저에 노출하지 않는다.
소유자가 아니거나 세션이 없으면 항상 404로 응답해 세션 존재 여부를
숨긴다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---
### Task 11: "새 버전으로 등록" + 프론트 배선

**Files:**
- Modify: `src/main/java/com/prizm/backend/edit/EditSessionService.java` (`registerNewVersion` 추가)
- Modify: `src/main/java/com/prizm/backend/edit/EditSessionController.java` (`POST .../{id}/register-version`)
- Test: `src/test/java/com/prizm/backend/edit/EditSessionServiceTest.java` (테스트 추가)
- Modify: `lib/edit-session-api.ts` (`registerEditSessionVersion` 추가)
- Modify: `components/code-assets-workspace.tsx` ("코드 편집" 버튼 → 편집 패널)

**Interfaces:**
- Consumes: `EditSession`(Task 2), `commandRunner`(Task 6에서 이미 주입됨)
- Produces: `EditSessionService.registerNewVersion(String sessionId, String requesterId)` → `void`(성공 시 아무것도 안 하고, 실패하면 `EditSessionLaunchException`), `POST /api/edit-sessions/{id}/register-version`

- [ ] **Step 1: 백엔드 — `registerNewVersion` 실패하는 테스트 추가**

`EditSessionServiceTest.java`에 추가:

```java
    @Test
    void registerNewVersionUploadsTheNotebookFileViaOneOffContainer() {
        EditSession session = EditSession.creating("EDIT-1", "user-1", "PRJ000212-C-0001", "v2.4.1", NOW);
        session.markReady("container-1", 49222, "token-1", NOW);
        when(repository.findById("EDIT-1")).thenReturn(java.util.Optional.of(session));
        when(catalog.find("PRJ000212-C-0001", "v2.4.1")).thenReturn(TestFixtures.weldAsset());
        when(commandRunner.run(any(), any(), any())).thenReturn(new CommandRunner.CommandResult(0, "ok"));

        service.registerNewVersion("EDIT-1", "user-1");

        verify(commandRunner).run(any(), any(), any());
    }

    @Test
    void registerNewVersionRefusesForNonOwner() {
        EditSession session = EditSession.creating("EDIT-1", "user-1", "PRJ000212-C-0001", "v2.4.1", NOW);
        session.markReady("container-1", 49222, "token-1", NOW);
        when(repository.findById("EDIT-1")).thenReturn(java.util.Optional.of(session));

        assertThatThrownBy(() -> service.registerNewVersion("EDIT-1", "user-2"))
                .isInstanceOf(EditSessionNotFoundException.class);
        verify(commandRunner, never()).run(any(), any(), any());
    }
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*EditSessionServiceTest'`
Expected: 컴파일 실패 — `registerNewVersion` 없음

- [ ] **Step 3: `EditSessionService`에 메서드 추가**

`EditSessionService.java`에 추가(기존 `getForOwner` 다음):

```java
    public void registerNewVersion(String sessionId, String requesterId) {
        EditSession session = repository.findById(sessionId)
                .orElseThrow(() -> new EditSessionNotFoundException(sessionId));
        if (!session.getOwnerId().equals(requesterId)) {
            throw new EditSessionNotFoundException(sessionId);
        }
        CodeAssetProperties asset = catalog.find(session.getAssetId(), session.getAssetVersion());
        Path hostDir = properties.hostSessionsRoot().resolve(sessionId);

        String script = "import glob, prizm; "
                + "files = glob.glob('/opt/prizm/edit/*.ipynb'); "
                + "prizm.code.upload('" + asset.codeKey() + "', files[0])";
        List<String> command = List.of(
                "docker", "run", "--rm",
                "-v", hostDir + ":/opt/prizm/edit",
                "-e", "MLOPS_AI_HUB_URL=" + mlopsSdk.aiHubUrl(),
                "-e", "MLOPS_S3_ENDPOINT=" + mlopsSdk.s3Endpoint(),
                "-e", "MLOPS_S3_ACCESS_KEY=" + mlopsSdk.s3AccessKey(),
                "-e", "MLOPS_S3_SECRET_KEY=" + mlopsSdk.s3SecretKey(),
                "-e", "MLOPS_BUCKET=" + mlopsSdk.bucket(),
                "prizm/runtime-base:v1", "python", "-c", script);
        CommandRunner.CommandResult result = commandRunner.run(command, hostDir, DOWNLOAD_TIMEOUT);
        if (!result.succeeded()) {
            log.warn("새 버전 등록 실패: {}", result.output());
            throw new EditSessionLaunchException("새 버전으로 등록하지 못했습니다: " + result.output());
        }
    }
```

새 버전 등록은 항상 베이스 이미지로 실행한다 — 파생 이미지(사용자 requirements 포함)를 쓸 필요가 없다. `prizm.code.upload`는 SDK에만 있으면 되고 추가 패키지는 필요 없기 때문이다.

- [ ] **Step 4: 컨트롤러에 엔드포인트 추가**

`EditSessionController.java`에 추가:

```java
    @PostMapping("/{sessionId}/register-version")
    public void registerVersion(@PathVariable String sessionId, @RequestParam String requesterId) {
        service.registerNewVersion(sessionId, requesterId);
    }
```

- [ ] **Step 5: 테스트 전체 실행 후 커밋**

Run: `./gradlew test` → 전부 PASS

```bash
git add src/main/java/com/prizm/backend/edit/ src/test/java/com/prizm/backend/edit/EditSessionServiceTest.java
git commit -m "feat: 편집 세션에서 새 버전으로 등록하는 엔드포인트 추가

세션 작업 디렉터리의 .ipynb를 prizm.code.upload로 AI Hub에 새
버전으로 등록한다. 항상 베이스 이미지로 실행한다 - SDK만 있으면
되고 사용자 requirements는 필요 없다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: 포털 클라이언트에 등록 함수 추가**

`lib/edit-session-api.ts`에 추가:

```typescript
export async function registerEditSessionVersion(sessionId: string): Promise<void> {
  const response = await fetch(`/edit-session-register/${encodeURIComponent(sessionId)}`, { method: 'POST' });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    throw new EditSessionApiError(data.message ?? `새 버전 등록 실패 (${response.status})`);
  }
}
```

이 함수가 부르는 `/edit-session-register/[sessionId]`도 `app/api/edit-sessions/route.ts`와 같은 이유로(쿠키를 읽어 `requesterId`로 백엔드에 넘겨야 한다) 포털 쪽 릴레이가 하나 더 필요하다.
`app/edit-session-register/[sessionId]/route.ts` 새로 작성:

```typescript
import { PRIZM_API_BASE } from '@/lib/prizm-api';

const COOKIE_NAME = 'prizm_user_id';

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await context.params;
  const requesterId = readCookie(request, COOKIE_NAME);
  if (!requesterId) {
    return Response.json({ message: '편집 세션을 찾을 수 없습니다' }, { status: 404 });
  }
  const backendResponse = await fetch(
    `${PRIZM_API_BASE}/api/edit-sessions/${encodeURIComponent(sessionId)}/register-version` +
      `?requesterId=${encodeURIComponent(requesterId)}`,
    { method: 'POST' },
  );
  const text = await backendResponse.text();
  return new Response(text || null, { status: backendResponse.status });
}
```

- [ ] **Step 7: "코드 편집" 버튼 배선**

`components/code-assets-workspace.tsx`에서 `코드 편집` 버튼 두 곳(`detail-secondary-action`과 `code-detail-compact-row`의 `nav` 안)을 찾는다 — 현재 둘 다 `onClick={() => setNotice('코드 편집 세션을 준비합니다.')}`로 돼 있다.

파일 상단 import에 추가:

```typescript
import { createEditSession, type EditSessionInfo } from '@/lib/edit-session-api';
```

컴포넌트 안에 상태 추가(`executionOpen` 등 기존 상태 선언부 근처):

```typescript
const [editSession, setEditSession] = useState<EditSessionInfo | null>(null);
const [editSessionLoading, setEditSessionLoading] = useState(false);
```

핸들러 함수 추가:

```typescript
const openEditSession = async () => {
  setEditSessionLoading(true);
  setEditSession(null);
  try {
    const session = await createEditSession(selectedAsset.id, selectedVersion);
    if (session.status !== 'READY') {
      setNotice(session.errorMessage ?? '편집 환경을 준비하지 못했습니다.');
      return;
    }
    setEditSession(session);
  } catch (error) {
    setNotice(error instanceof Error ? error.message : '편집 세션을 열지 못했습니다.');
  } finally {
    setEditSessionLoading(false);
  }
};
```

두 `코드 편집` 버튼의 `onClick`을 `() => setNotice('코드 편집 세션을 준비합니다.')`에서 `openEditSession`으로 바꾼다. 버튼 텍스트에 로딩 상태를 반영: `<PencilLine size={15} /> {editSessionLoading ? '준비 중...' : '코드 편집'}`.

`selectedAsset.restricted ? ... : <>...` 블록을 감싸는 JSX 바깥, `code-detail-page` 최상위 반환 블록 끝(`</PortalDetailFrame>` 직전)에 편집 패널을 추가한다:

```tsx
{editSession && (
  <div className="edit-session-overlay" role="dialog" aria-label="코드 편집">
    <header className="edit-session-overlay-bar">
      <strong>{selectedAsset.title}</strong>
      <div>
        <button
          type="button"
          onClick={async () => {
            try {
              await registerEditSessionVersion(editSession.sessionId);
              setNotice('새 버전으로 등록했습니다.');
            } catch (error) {
              setNotice(error instanceof Error ? error.message : '새 버전 등록에 실패했습니다.');
            }
          }}
        >
          새 버전으로 등록
        </button>
        <button type="button" onClick={() => setEditSession(null)}>닫기</button>
      </div>
    </header>
    <iframe
      title="JupyterLab 편집"
      src={`/edit/${editSession.sessionId}/lab`}
      className="edit-session-frame"
    />
  </div>
)}
```

`registerEditSessionVersion`도 import에 추가한다.

- [ ] **Step 8: 최소한의 스타일 추가**

`app/prizm-design-system.css` 끝에 추가:

```css
.edit-session-overlay { position: fixed; inset: 0; z-index: 200; display: grid; grid-template-rows: auto 1fr; background: white; }
.edit-session-overlay-bar { display: flex; align-items: center; justify-content: space-between; padding: .75rem 1rem; border-bottom: 1px solid var(--line-strong); }
.edit-session-overlay-bar button { height: 2.1rem; padding: 0 .85rem; margin-left: .5rem; border-radius: .35rem; font-size: .78rem; font-weight: 620; }
.edit-session-overlay-bar button:first-of-type { color: white; background: var(--hyundai-blue); }
.edit-session-frame { width: 100%; height: 100%; border: 0; }
```

- [ ] **Step 9: 타입 체크·린트**

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-portal
npx tsc --noEmit
npx oxlint components/code-assets-workspace.tsx app/edit-session-register/
```

- [ ] **Step 10: 커밋**

```bash
git add app/edit-session-register/ lib/edit-session-api.ts components/code-assets-workspace.tsx app/prizm-design-system.css
git commit -m "feat: 코드 편집 버튼이 실제 JupyterLab 편집 세션을 연다

클릭하면 세션을 만들고 즉시 전체 화면 패널을 띄운 뒤 iframe으로
JupyterLab을 로드한다(같은 오리진 프록시 경유). '새 버전으로 등록'
버튼은 세션을 유지한 채 현재 파일을 AI Hub에 새 버전으로 올린다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---
### Task 12: 종단 검증

**Files:** 없음(검증 전용)

**Interfaces:**
- Consumes: Task 1~11 전부
- Produces: Phase 2 완료 판정

- [ ] **Step 1: 스택 확인**

```bash
cd ~/Workspace/notebook/prototype && docker compose ps
curl -s -o /dev/null -w 'backend: %{http_code}\n' localhost:8081/api/runs
curl -s -o /dev/null -w 'frontend: %{http_code}\n' localhost:3000
```

- [ ] **Step 2: 브라우저에서 편집 세션 열기 — 성공 경로**

`http://localhost:3000/assets/code?asset=PRJ000212-C-0001`에서 "코드 편집" 클릭.

Expected:
- 몇 초 안에 전체 화면 패널이 열리고 iframe 안에 JupyterLab이 보인다
- 좌측 파일 목록에 `demo_yolov8_training_v2.ipynb`(또는 등록된 실제 파일명)가 있다
- 그 파일을 더블클릭해 열고, 아무 셀이나 실행(Shift+Enter) — **커널이 실제로 붙어 출력이
  나오는지가 이 태스크의 핵심 검증 지점**이다(Task 1의 WS 스파이크가 실전에서도 동작함을
  증명)

- [ ] **Step 3: 같은 노트북 재접속 — 세션 재사용**

패널을 닫고("닫기") 같은 자산에서 다시 "코드 편집" 클릭.

Expected: 새 컨테이너를 기다리지 않고 훨씬 빠르게 열린다(같은 세션 재사용). 방금 실행했던
셀의 출력이 그대로 남아 있다(같은 컨테이너 파일시스템이므로).

```bash
docker ps --filter label=prizm-edit-session --format '{{.Names}}'
```

Expected: 컨테이너가 1개만 있다(재사용이 실제로 컨테이너를 새로 안 띄웠다는 증거).

- [ ] **Step 4: 다른 자산 편집 — 세션 전환**

다른 코드 자산 상세로 이동해 "코드 편집" 클릭.

Expected: 잠깐의 대기 후 새 세션이 열린다(이전 컨테이너 정지 + 새 컨테이너 기동).

```bash
docker ps --filter label=prizm-edit-session --format '{{.Names}}'
```

Expected: 여전히 컨테이너가 1개뿐이고(이전 것은 정지·삭제됨), 이름이 바뀌어 있다.

```bash
ls ~/Workspace/notebook/prototype/edit-sessions/
```

Expected: 이전 세션의 디렉터리가 사라지고 새 세션의 디렉터리만 있다(종료 시 삭제 확인).

- [ ] **Step 5: 소유자가 아니면 접근 불가**

```bash
curl -s -b /tmp/prizm-cookies.txt "http://localhost:3000/api/edit-sessions" -X POST \
  -H 'Content-Type: application/json' -d '{"assetId":"PRJ000212-C-0001","version":"v2.4.1"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["sessionId"])' > /tmp/session-id.txt
SESSION_ID=$(cat /tmp/session-id.txt)
curl -s -b "prizm_user_id=different-cookie-value" -o /dev/null -w '%{http_code}\n' \
  "http://localhost:3000/edit/$SESSION_ID/lab"
```

Expected: `404`

- [ ] **Step 6: 새 버전으로 등록**

편집 패널에서 노트북에 아무 셀이나 하나 추가/수정하고 저장(Cmd/Ctrl+S) → "새 버전으로 등록"
클릭.

Expected: "새 버전으로 등록했습니다" 안내. 패널을 닫고 상세 화면의 "버전" 탭(또는 버전
셀렉터)을 확인 — 새 버전이 보인다.

```bash
docker exec prototype-ai-hub-1 python -c "
import json
data = json.load(open('/data/catalog.json'))
versions = [a for a in data.get('assets', []) if a.get('key') == 'demo.door_defect_yolov8_training']
print([a.get('version') for a in versions])
" 2>&1 || echo "AI Hub 카탈로그 저장 경로가 다르면 이 확인은 생략하고 화면에서만 확인한다"
```

(AI Hub의 실제 카탈로그 저장 위치·형식은 구현에 따라 다를 수 있다 — 위 명령이 안 맞으면
화면의 "버전" 탭 목록 개수가 늘었는지로 대체 확인한다.)

- [ ] **Step 7: 유휴 회수 (가속 확인)**

30분을 실제로 기다리는 대신, 백엔드를 `prizm.edit-session.idle-timeout=10s`로 잠깐 재기동해
확인한다:

```bash
cd ~/Documents/Codex/2026-09-09/dnp/work/prizm-backend
source ~/.sdkman/bin/sdkman-init.sh
PRIZM_EDIT_SESSION_IDLE_TIMEOUT=10s ./gradlew bootRun &
```

편집 세션을 하나 연 뒤 15초 이상 아무 상호작용 없이 대기 → 다음 프록시 요청이 `404`로
바뀌는지, `docker ps --filter label=prizm-edit-session`에서 컨테이너가 사라졌는지 확인한다.
확인 후 원래 설정(기본 30분)으로 백엔드를 재기동해 둔다.

- [ ] **Step 8: 결과 기록**

확인한 내용을 정리한다 — 특히 Step 2(커널 연결·셀 실행)가 이 Phase 전체의 핵심 검증이므로
반드시 실제로 되는 걸 확인해야 한다. 하나라도 통과하지 못하면 Phase 2는 완료가 아니다.

---
## 이 계획에서 다루지 않는 것

- 실제 운영 배포(Cloudflare 에지 ↔ 로컬 Docker 연결) — 설계 문서 §2·§7 참고
- 동시 협업 편집, 편집 환경 내 터미널 접근, 실제 인증
- 세션 개수 상한·과금·리소스 쿼터
- 인가 응답 캐싱(§5 — 느려지면 나중에)
- `FAILED` 빌드 자동 재시도, 파생 이미지/빌드 컨텍스트 GC(Phase 1에서 이미 후속 과제로 명시된 항목)
