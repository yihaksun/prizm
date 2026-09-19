# 노트북 편집 환경 Phase 1 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 코드 자산의 requirements로 파생 이미지를 미리 빌드해 두고, Airflow가 그 이미지 안에서 노트북을 실행하게 만든다.

**Architecture:** 백엔드에 `environment` 패키지를 추가해 requirements 정규화 → 캐시 키 계산 → 파생 이미지 빌드 → 상태 관리를 담당한다. Airflow DAG의 `execute_notebook`을 `PythonOperator`에서 `DockerOperator`로 바꿔, 노트북이 Airflow 워커가 아니라 자산의 파생 이미지 컨테이너에서 실행되게 한다. 이 전환으로 오케스트레이터와 ML 런타임의 파이썬 환경 공유가 끊긴다.

**Tech Stack:** Spring Boot 4.1.1 · Java 21 · Gradle Kotlin DSL · H2 · JPA · Airflow 2.10.2 · `apache-airflow-providers-docker` 3.13.0 (이미 설치됨) · Docker · uv

**Spec:** `docs/superpowers/specs/2026-09-19-notebook-edit-environment-design.md`

## Global Constraints

- Spring Boot 4.1.1, Java 21(Temurin, SDKMAN), Gradle Kotlin DSL. 빌드·테스트는 `./gradlew test`
- Jackson 3: 처리 API는 `tools.jackson.*`, 애너테이션은 `com.fasterxml.jackson.annotation.*` (애너테이션 패키지는 Jackson 3에서도 그대로다)
- 사용자에게 보이는 에러 메시지는 한국어로 쓴다
- JPA 엔티티에 primitive `int`/`long` 필드를 추가하면 `@ColumnDefault("0")`를 반드시 붙인다. H2 파일 DB에 데이터가 있으면 기본값 없는 NOT NULL 컬럼 추가가 실패한다
- 테스트는 JUnit 5 + AssertJ. 기존 테스트 스타일(`TestFixtures` 헬퍼, 스프링 컨텍스트 없는 순수 단위 테스트)을 따른다
- `~/Workspace/notebook/prototype`은 **git 저장소가 아니다.** 이 폴더의 파일을 수정하기 전에 반드시 `prototype/.backup-2026-09-19/`에 원본을 복사한다
- **Airflow는 파생 이미지에 포함하지 않는다.** 베이스 런타임 이미지는 `python:3.11-slim`에서 시작한다
- 편집·실행 도구(papermill, 이후 jupyterlab)는 도구 venv `/opt/prizm/tools`에 설치한다. 사용자 환경(site-packages)에 들어가는 Jupyter 계열 패키지는 `ipykernel` 하나뿐이다
- 캐시 키에는 `recipe_version`을 반드시 포함한다. 빌드 레시피를 바꾼 뒤에도 낡은 이미지가 캐시 히트하는 것을 막는다
- requirements의 `-r`, `-e`, `--index-url`, `--extra-index-url`, `-f`, `--trusted-host`, 직접 URL 참조는 거부한다
- 커밋 메시지는 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`로 끝낸다

## 파일 구조

### prizm-backend (git 저장소)

| 파일 | 책임 |
|---|---|
| `environment/RequirementsNormalizer.java` | requirements 원문 → 정규 형태. 지시자·URL 거부 |
| `environment/EnvironmentCacheKey.java` | (베이스 digest + 정규 requirements + 레시피 버전) → 16자 키 |
| `environment/EnvironmentBuildStatus.java` | PENDING / BUILDING / READY / FAILED |
| `environment/EnvironmentBuild.java` | JPA 엔티티. 빌드 1건의 상태와 결과 |
| `environment/EnvironmentBuildRepository.java` | `findByCacheKey` |
| `environment/CommandRunner.java` | 외부 명령 실행 seam(테스트에서 대체) |
| `environment/ProcessCommandRunner.java` | `ProcessBuilder` 기반 구현 |
| `environment/ImageBuilder.java` | 파생 이미지 빌드 명령 조립·실행 |
| `environment/EnvironmentService.java` | 오케스트레이션: 정규화 → 키 → 조회 → 빌드 → 상태 전이 |
| `environment/EnsureEnvironmentRequest.java` | API 요청 본문 |
| `environment/EnvironmentResponse.java` | API 응답 본문 |
| `environment/EnvironmentController.java` | `POST /api/environments`, `GET /api/environments/{cacheKey}` |
| `api/InvalidRequirementsException.java` | 400으로 응답할 requirements 오류 |
| `api/EnvironmentNotFoundException.java` | 404 |
| `api/ApiExceptionHandler.java` (수정) | 위 두 예외 핸들러 추가 |
| `config/PrizmProperties.java` (수정) | `Environment` 설정 레코드 추가 |
| `asset/CodeAssetProperties.java` (수정) | `baseImage`, `requirements` 필드 추가 |
| `run/RunService.java` (수정) | DAG conf에 `env_image_ref` 추가 |

### prototype (git 아님 — 수정 전 백업 필수)

| 파일 | 책임 |
|---|---|
| `runtime/base/Dockerfile` | 베이스 런타임 이미지. Airflow 없음, 도구 venv 분리 |
| `runtime/base/requirements-user.txt` | 사용자 환경에 설치할 ML 스택 (papermill 제외) |
| `airflow/dags/mlops_notebook_executor.py` (수정) | `execute_notebook`을 DockerOperator로 |
| `docker-compose.yml` (수정) | docker.sock 마운트, 호스트 경로·네트워크 환경변수 |
| `.env` | `HOST_PROJECT_DIR` — DockerOperator가 쓸 호스트 절대경로 |

---

### Task 1: requirements 정규화

**Files:**
- Create: `src/main/java/com/prizm/backend/api/InvalidRequirementsException.java`
- Create: `src/main/java/com/prizm/backend/environment/RequirementsNormalizer.java`
- Test: `src/test/java/com/prizm/backend/environment/RequirementsNormalizerTest.java`

**Interfaces:**
- Consumes: 없음 (이 계획의 첫 작업)
- Produces: `RequirementsNormalizer.normalize(String raw)` → `String` (정규화된 requirements, 줄바꿈 구분). 잘못된 입력에는 `InvalidRequirementsException`을 던진다

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/environment/RequirementsNormalizerTest.java`:

```java
package com.prizm.backend.environment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.prizm.backend.api.InvalidRequirementsException;
import org.junit.jupiter.api.Test;

class RequirementsNormalizerTest {

    @Test
    void sortsEntriesSoThatLineOrderDoesNotChangeResult() {
        String first = RequirementsNormalizer.normalize("torch>=2.0\nnumpy<2.0\npandas");
        String second = RequirementsNormalizer.normalize("pandas\nnumpy<2.0\ntorch>=2.0");

        assertThat(first).isEqualTo("numpy<2.0\npandas\ntorch>=2.0");
        assertThat(second).isEqualTo(first);
    }

    @Test
    void removesCommentsAndBlankLines() {
        String result = RequirementsNormalizer.normalize("""
                # 학습용 패키지
                pandas==2.2.3

                numpy<2.0  # ultralytics 호환
                """);

        assertThat(result).isEqualTo("numpy<2.0\npandas==2.2.3");
    }

    @Test
    void normalizesPackageNamesByPep503() {
        String result = RequirementsNormalizer.normalize("Scikit_Learn==1.5.2\nRUAMEL.yaml");

        assertThat(result).isEqualTo("ruamel-yaml\nscikit-learn==1.5.2");
    }

    @Test
    void removesWhitespaceInsideSpecifiers() {
        assertThat(RequirementsNormalizer.normalize("torch >= 2.0")).isEqualTo("torch>=2.0");
    }

    @Test
    void sortsExtrasInsideBrackets() {
        assertThat(RequirementsNormalizer.normalize("uvicorn[standard,Extra]==0.30.0"))
                .isEqualTo("uvicorn[extra,standard]==0.30.0");
    }

    @Test
    void removesDuplicateEntries() {
        assertThat(RequirementsNormalizer.normalize("pandas\npandas")).isEqualTo("pandas");
    }

    @Test
    void returnsEmptyStringForNullOrBlankInput() {
        assertThat(RequirementsNormalizer.normalize(null)).isEmpty();
        assertThat(RequirementsNormalizer.normalize("  \n\n# 주석만\n")).isEmpty();
    }

    @Test
    void rejectsNestedRequirementFiles() {
        assertThatThrownBy(() -> RequirementsNormalizer.normalize("-r other.txt"))
                .isInstanceOf(InvalidRequirementsException.class)
                .hasMessage("지원하지 않는 지시자입니다: -r other.txt");
    }

    @Test
    void rejectsIndexUrlOverride() {
        assertThatThrownBy(() -> RequirementsNormalizer.normalize("--index-url https://pypi.org/simple"))
                .isInstanceOf(InvalidRequirementsException.class)
                .hasMessageStartingWith("지원하지 않는 지시자입니다");
    }

    @Test
    void rejectsEditableInstall() {
        assertThatThrownBy(() -> RequirementsNormalizer.normalize("-e ."))
                .isInstanceOf(InvalidRequirementsException.class)
                .hasMessageStartingWith("지원하지 않는 지시자입니다");
    }

    @Test
    void rejectsDirectUrlReference() {
        assertThatThrownBy(() -> RequirementsNormalizer.normalize("https://example.com/pkg.whl"))
                .isInstanceOf(InvalidRequirementsException.class)
                .hasMessage("직접 URL 참조는 지원하지 않습니다: https://example.com/pkg.whl");
    }

    @Test
    void rejectsUnparseableEntry() {
        assertThatThrownBy(() -> RequirementsNormalizer.normalize("!!!"))
                .isInstanceOf(InvalidRequirementsException.class)
                .hasMessage("해석할 수 없는 항목입니다: !!!");
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*RequirementsNormalizerTest'`
Expected: 컴파일 실패 — `RequirementsNormalizer`, `InvalidRequirementsException` 없음

- [ ] **Step 3: 예외 클래스 작성**

`src/main/java/com/prizm/backend/api/InvalidRequirementsException.java`:

```java
package com.prizm.backend.api;

/** 400 Bad Request로 응답할 requirements 입력 오류. */
public class InvalidRequirementsException extends RuntimeException {

    public InvalidRequirementsException(String message) {
        super(message);
    }
}
```

- [ ] **Step 4: 정규화 구현**

`src/main/java/com/prizm/backend/environment/RequirementsNormalizer.java`:

```java
package com.prizm.backend.environment;

import com.prizm.backend.api.InvalidRequirementsException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * requirements.txt 원문을 캐시 키 계산용 정규 형태로 바꾼다.
 *
 * <p>줄 순서·대소문자·공백·주석만 다른 동일한 내용이 서로 다른 캐시 키를 만들면
 * 같은 환경을 여러 번 빌드하게 된다. 재현성을 깨거나 사내 미러 정책을 우회하는
 * 지시자(-r, -e, --index-url 등)와 직접 URL 참조는 거부한다.
 */
public final class RequirementsNormalizer {

    private static final Pattern DIRECTIVE = Pattern.compile(
            "^(-r|--requirement|-e|--editable|-i|--index-url|--extra-index-url|-f|--find-links|--trusted-host|--pre)\\b.*");
    private static final Pattern URL = Pattern.compile("^[A-Za-z][A-Za-z0-9+.-]*://.*");
    private static final Pattern ENTRY = Pattern.compile("^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\\[([^\\]]*)\\])?(.*)$");
    private static final Pattern NAME_SEPARATORS = Pattern.compile("[-_.]+");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private RequirementsNormalizer() {
    }

    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        List<String> entries = new ArrayList<>();
        for (String line : raw.split("\\R")) {
            String stripped = stripComment(line).trim();
            if (stripped.isEmpty()) {
                continue;
            }
            if (DIRECTIVE.matcher(stripped).matches()) {
                throw new InvalidRequirementsException("지원하지 않는 지시자입니다: " + stripped);
            }
            if (URL.matcher(stripped).matches()) {
                throw new InvalidRequirementsException("직접 URL 참조는 지원하지 않습니다: " + stripped);
            }
            entries.add(normalizeEntry(stripped));
        }
        return entries.stream().distinct().sorted().collect(Collectors.joining("\n"));
    }

    private static String stripComment(String line) {
        int hash = line.indexOf('#');
        return hash < 0 ? line : line.substring(0, hash);
    }

    private static String normalizeEntry(String entry) {
        Matcher matcher = ENTRY.matcher(entry);
        if (!matcher.matches()) {
            throw new InvalidRequirementsException("해석할 수 없는 항목입니다: " + entry);
        }
        StringBuilder result = new StringBuilder(normalizeName(matcher.group(1)));
        String extras = matcher.group(2);
        if (extras != null) {
            String joined = Arrays.stream(extras.split(","))
                    .map(String::trim)
                    .filter(part -> !part.isEmpty())
                    .map(RequirementsNormalizer::normalizeName)
                    .distinct()
                    .sorted()
                    .collect(Collectors.joining(","));
            if (!joined.isEmpty()) {
                result.append('[').append(joined).append(']');
            }
        }
        return result.append(WHITESPACE.matcher(matcher.group(3)).replaceAll("")).toString();
    }

    /** PEP 503: 소문자화하고 연속된 -, _, . 를 - 하나로 바꾼다. */
    private static String normalizeName(String name) {
        return NAME_SEPARATORS.matcher(name.toLowerCase(Locale.ROOT)).replaceAll("-");
    }
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `./gradlew test --tests '*RequirementsNormalizerTest'`
Expected: 12개 테스트 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/main/java/com/prizm/backend/api/InvalidRequirementsException.java \
        src/main/java/com/prizm/backend/environment/RequirementsNormalizer.java \
        src/test/java/com/prizm/backend/environment/RequirementsNormalizerTest.java
git commit -m "feat: requirements 정규화 구현

줄 순서·대소문자·공백·주석만 다른 동일한 내용이 같은 캐시 키를 만들도록
PEP 503 이름 정규화, extras 정렬, 사전순 정렬을 적용한다. 재현성을 깨거나
사내 미러 정책을 우회하는 지시자와 직접 URL 참조는 거부한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 캐시 키 계산

**Files:**
- Create: `src/main/java/com/prizm/backend/environment/EnvironmentCacheKey.java`
- Test: `src/test/java/com/prizm/backend/environment/EnvironmentCacheKeyTest.java`

**Interfaces:**
- Consumes: 없음 (Task 1과 독립)
- Produces:
  - `EnvironmentCacheKey.RECIPE_VERSION` → `String` 상수 `"r1"`
  - `EnvironmentCacheKey.compute(String baseImageDigest, String normalizedRequirements)` → `String` (소문자 16자리 16진수)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/environment/EnvironmentCacheKeyTest.java`:

```java
package com.prizm.backend.environment;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class EnvironmentCacheKeyTest {

    private static final String DIGEST = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
    private static final String OTHER_DIGEST = "sha256:2222222222222222222222222222222222222222222222222222222222222222";

    @Test
    void producesSixteenLowercaseHexCharacters() {
        String key = EnvironmentCacheKey.compute(DIGEST, "pandas==2.2.3");

        assertThat(key).hasSize(16).matches("[0-9a-f]{16}");
    }

    @Test
    void isDeterministicForTheSameInput() {
        assertThat(EnvironmentCacheKey.compute(DIGEST, "pandas==2.2.3"))
                .isEqualTo(EnvironmentCacheKey.compute(DIGEST, "pandas==2.2.3"));
    }

    @Test
    void changesWhenBaseImageDigestChanges() {
        assertThat(EnvironmentCacheKey.compute(DIGEST, "pandas==2.2.3"))
                .isNotEqualTo(EnvironmentCacheKey.compute(OTHER_DIGEST, "pandas==2.2.3"));
    }

    @Test
    void changesWhenRequirementsChange() {
        assertThat(EnvironmentCacheKey.compute(DIGEST, "pandas==2.2.3"))
                .isNotEqualTo(EnvironmentCacheKey.compute(DIGEST, "pandas==2.2.4"));
    }

    @Test
    void emptyRequirementsStillProduceAKey() {
        assertThat(EnvironmentCacheKey.compute(DIGEST, "")).hasSize(16);
    }

    @Test
    void recipeVersionIsPartOfTheKey() {
        String withCurrentRecipe = EnvironmentCacheKey.compute(DIGEST, "pandas==2.2.3");
        String withOtherRecipe = EnvironmentCacheKey.computeWithRecipe(DIGEST, "pandas==2.2.3", "r-other");

        assertThat(withCurrentRecipe).isNotEqualTo(withOtherRecipe);
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*EnvironmentCacheKeyTest'`
Expected: 컴파일 실패 — `EnvironmentCacheKey` 없음

- [ ] **Step 3: 구현**

`src/main/java/com/prizm/backend/environment/EnvironmentCacheKey.java`:

```java
package com.prizm.backend.environment;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * 파생 이미지의 정체성을 정하는 캐시 키.
 *
 * <p>베이스 이미지 다이제스트와 정규화된 requirements뿐 아니라 <b>레시피 버전</b>도
 * 키에 포함한다. Dockerfile 템플릿이나 설치 도구를 바꾸면 같은 입력이라도 다른
 * 결과물이 나오는데, 레시피 버전이 키에 없으면 낡은 이미지가 계속 캐시 히트한다.
 */
public final class EnvironmentCacheKey {

    /** 빌드 레시피를 바꿀 때마다 올린다. 올리면 모든 환경이 새로 빌드된다. */
    public static final String RECIPE_VERSION = "r1";

    private static final int KEY_LENGTH = 16;

    private EnvironmentCacheKey() {
    }

    public static String compute(String baseImageDigest, String normalizedRequirements) {
        return computeWithRecipe(baseImageDigest, normalizedRequirements, RECIPE_VERSION);
    }

    static String computeWithRecipe(String baseImageDigest, String normalizedRequirements, String recipeVersion) {
        String material = baseImageDigest + "\n" + normalizedRequirements + "\n" + recipeVersion;
        return HexFormat.of().formatHex(sha256(material)).substring(0, KEY_LENGTH);
    }

    private static byte[] sha256(String material) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(material.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다", e);
        }
    }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `./gradlew test --tests '*EnvironmentCacheKeyTest'`
Expected: 6개 테스트 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/main/java/com/prizm/backend/environment/EnvironmentCacheKey.java \
        src/test/java/com/prizm/backend/environment/EnvironmentCacheKeyTest.java
git commit -m "feat: 환경 캐시 키 계산 구현

베이스 이미지 다이제스트 + 정규화 requirements + 레시피 버전을 SHA-256으로
해싱해 16자 키를 만든다. 레시피 버전을 키에 넣어야 빌드 방식을 바꾼 뒤에
낡은 이미지가 캐시 히트하는 것을 막을 수 있다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 3: 환경 빌드 엔티티와 저장소

**Files:**
- Create: `src/main/java/com/prizm/backend/environment/EnvironmentBuildStatus.java`
- Create: `src/main/java/com/prizm/backend/environment/EnvironmentBuild.java`
- Create: `src/main/java/com/prizm/backend/environment/EnvironmentBuildRepository.java`
- Test: `src/test/java/com/prizm/backend/environment/EnvironmentBuildTest.java`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `EnvironmentBuildStatus` enum: `PENDING`, `BUILDING`, `READY`, `FAILED`, 메서드 `isFinished()`
  - `EnvironmentBuild.pending(String cacheKey, String baseImageRef, String baseImageDigest, String requirementsRaw, String requirementsNorm, String recipeVersion, Instant now)` → `EnvironmentBuild`
  - `EnvironmentBuild.ready(String cacheKey, String baseImageRef, String baseImageDigest, String recipeVersion, Instant now)` → `EnvironmentBuild` (requirements가 비어 빌드가 필요 없는 경우)
  - 인스턴스 메서드: `markBuilding(Instant)`, `markReady(String imageRef, Instant)`, `markFailed(String errorSummary, Instant)`, `setBuildLogRef(String)`
  - getter: `getCacheKey()`, `getBaseImageRef()`, `getBaseImageDigest()`, `getRequirementsRaw()`, `getRequirementsNorm()`, `getRecipeVersion()`, `getStatus()`, `getImageRef()`, `getBuildLogRef()`, `getErrorSummary()`, `getCreatedAt()`, `getStartedAt()`, `getFinishedAt()`
  - `EnvironmentBuildRepository extends JpaRepository<EnvironmentBuild, String>` with `List<EnvironmentBuild> findByStatus(EnvironmentBuildStatus status)`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/environment/EnvironmentBuildTest.java`:

```java
package com.prizm.backend.environment;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class EnvironmentBuildTest {

    private static final Instant CREATED = Instant.parse("2026-09-19T01:00:00Z");
    private static final Instant STARTED = Instant.parse("2026-09-19T01:00:05Z");
    private static final Instant FINISHED = Instant.parse("2026-09-19T01:00:40Z");
    private static final String DIGEST = "sha256:abcdef";

    private EnvironmentBuild pending() {
        return EnvironmentBuild.pending("0123456789abcdef", "prizm/runtime-base:v1", DIGEST,
                "pandas==2.2.3\n", "pandas==2.2.3", "r1", CREATED);
    }

    @Test
    void startsInPendingWithoutResult() {
        EnvironmentBuild build = pending();

        assertThat(build.getStatus()).isEqualTo(EnvironmentBuildStatus.PENDING);
        assertThat(build.getCacheKey()).isEqualTo("0123456789abcdef");
        assertThat(build.getRequirementsNorm()).isEqualTo("pandas==2.2.3");
        assertThat(build.getCreatedAt()).isEqualTo(CREATED);
        assertThat(build.getImageRef()).isNull();
        assertThat(build.getStartedAt()).isNull();
        assertThat(build.getFinishedAt()).isNull();
    }

    @Test
    void markBuildingRecordsStartTime() {
        EnvironmentBuild build = pending();

        build.markBuilding(STARTED);

        assertThat(build.getStatus()).isEqualTo(EnvironmentBuildStatus.BUILDING);
        assertThat(build.getStartedAt()).isEqualTo(STARTED);
        assertThat(build.getFinishedAt()).isNull();
    }

    @Test
    void markReadyRecordsImageAndFinishTime() {
        EnvironmentBuild build = pending();
        build.markBuilding(STARTED);

        build.markReady("prizm/env:0123456789abcdef", FINISHED);

        assertThat(build.getStatus()).isEqualTo(EnvironmentBuildStatus.READY);
        assertThat(build.getImageRef()).isEqualTo("prizm/env:0123456789abcdef");
        assertThat(build.getFinishedAt()).isEqualTo(FINISHED);
    }

    @Test
    void markFailedRecordsErrorAndFinishTime() {
        EnvironmentBuild build = pending();
        build.markBuilding(STARTED);

        build.markFailed("No matching distribution found for nosuchpkg", FINISHED);

        assertThat(build.getStatus()).isEqualTo(EnvironmentBuildStatus.FAILED);
        assertThat(build.getErrorSummary()).isEqualTo("No matching distribution found for nosuchpkg");
        assertThat(build.getFinishedAt()).isEqualTo(FINISHED);
        assertThat(build.getImageRef()).isNull();
    }

    @Test
    void truncatesLongErrorSummary() {
        EnvironmentBuild build = pending();

        build.markFailed("가".repeat(3000), FINISHED);

        assertThat(build.getErrorSummary()).hasSize(2000).endsWith("...");
    }

    @Test
    void readyFactorySkipsBuildForEmptyRequirements() {
        EnvironmentBuild build = EnvironmentBuild.ready(
                "fedcba9876543210", "prizm/runtime-base:v1", DIGEST, "r1", CREATED);

        assertThat(build.getStatus()).isEqualTo(EnvironmentBuildStatus.READY);
        assertThat(build.getImageRef()).isEqualTo("prizm/runtime-base:v1");
        assertThat(build.getRequirementsNorm()).isEmpty();
        assertThat(build.getFinishedAt()).isEqualTo(CREATED);
    }

    @Test
    void statusKnowsWhichStatesAreFinished() {
        assertThat(EnvironmentBuildStatus.PENDING.isFinished()).isFalse();
        assertThat(EnvironmentBuildStatus.BUILDING.isFinished()).isFalse();
        assertThat(EnvironmentBuildStatus.READY.isFinished()).isTrue();
        assertThat(EnvironmentBuildStatus.FAILED.isFinished()).isTrue();
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*EnvironmentBuildTest'`
Expected: 컴파일 실패 — `EnvironmentBuild`, `EnvironmentBuildStatus` 없음

- [ ] **Step 3: 상태 enum 작성**

`src/main/java/com/prizm/backend/environment/EnvironmentBuildStatus.java`:

```java
package com.prizm.backend.environment;

public enum EnvironmentBuildStatus {
    PENDING,
    BUILDING,
    READY,
    FAILED;

    public boolean isFinished() {
        return this == READY || this == FAILED;
    }
}
```

- [ ] **Step 4: 엔티티 작성**

`src/main/java/com/prizm/backend/environment/EnvironmentBuild.java`:

```java
package com.prizm.backend.environment;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 파생 이미지 빌드 1건. 캐시 키가 곧 정체성이므로 기본 키로 쓴다. */
@Entity
@Table(name = "environment_build")
public class EnvironmentBuild {

    private static final int REQUIREMENTS_LENGTH = 4000;
    private static final int ERROR_LENGTH = 2000;

    @Id
    private String cacheKey;
    private String baseImageRef;
    private String baseImageDigest;
    @Column(length = REQUIREMENTS_LENGTH)
    private String requirementsRaw;
    @Column(length = REQUIREMENTS_LENGTH)
    private String requirementsNorm;
    private String recipeVersion;
    @Enumerated(EnumType.STRING)
    private EnvironmentBuildStatus status;
    private String imageRef;
    private String buildLogRef;
    @Column(length = ERROR_LENGTH)
    private String errorSummary;
    private Instant createdAt;
    private Instant startedAt;
    private Instant finishedAt;

    protected EnvironmentBuild() {
    }

    public static EnvironmentBuild pending(String cacheKey, String baseImageRef, String baseImageDigest,
            String requirementsRaw, String requirementsNorm, String recipeVersion, Instant now) {
        EnvironmentBuild build = new EnvironmentBuild();
        build.cacheKey = cacheKey;
        build.baseImageRef = baseImageRef;
        build.baseImageDigest = baseImageDigest;
        build.requirementsRaw = requirementsRaw;
        build.requirementsNorm = requirementsNorm;
        build.recipeVersion = recipeVersion;
        build.status = EnvironmentBuildStatus.PENDING;
        build.createdAt = now;
        return build;
    }

    /** requirements가 비어 빌드할 것이 없을 때. 베이스 이미지를 그대로 쓴다. */
    public static EnvironmentBuild ready(String cacheKey, String baseImageRef, String baseImageDigest,
            String recipeVersion, Instant now) {
        EnvironmentBuild build = new EnvironmentBuild();
        build.cacheKey = cacheKey;
        build.baseImageRef = baseImageRef;
        build.baseImageDigest = baseImageDigest;
        build.requirementsRaw = "";
        build.requirementsNorm = "";
        build.recipeVersion = recipeVersion;
        build.status = EnvironmentBuildStatus.READY;
        build.imageRef = baseImageRef;
        build.createdAt = now;
        build.finishedAt = now;
        return build;
    }

    public void markBuilding(Instant now) {
        this.status = EnvironmentBuildStatus.BUILDING;
        this.startedAt = now;
    }

    public void markReady(String imageRef, Instant now) {
        this.status = EnvironmentBuildStatus.READY;
        this.imageRef = imageRef;
        this.finishedAt = now;
    }

    public void markFailed(String errorSummary, Instant now) {
        this.status = EnvironmentBuildStatus.FAILED;
        this.errorSummary = truncate(errorSummary);
        this.finishedAt = now;
    }

    public void setBuildLogRef(String buildLogRef) {
        this.buildLogRef = buildLogRef;
    }

    private static String truncate(String value) {
        if (value == null || value.length() <= ERROR_LENGTH) {
            return value;
        }
        return value.substring(0, ERROR_LENGTH - 3) + "...";
    }

    public String getCacheKey() { return cacheKey; }
    public String getBaseImageRef() { return baseImageRef; }
    public String getBaseImageDigest() { return baseImageDigest; }
    public String getRequirementsRaw() { return requirementsRaw; }
    public String getRequirementsNorm() { return requirementsNorm; }
    public String getRecipeVersion() { return recipeVersion; }
    public EnvironmentBuildStatus getStatus() { return status; }
    public String getImageRef() { return imageRef; }
    public String getBuildLogRef() { return buildLogRef; }
    public String getErrorSummary() { return errorSummary; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
}
```

- [ ] **Step 5: 저장소 작성**

`src/main/java/com/prizm/backend/environment/EnvironmentBuildRepository.java`:

```java
package com.prizm.backend.environment;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnvironmentBuildRepository extends JpaRepository<EnvironmentBuild, String> {

    List<EnvironmentBuild> findByStatus(EnvironmentBuildStatus status);
}
```

- [ ] **Step 6: 테스트가 통과하는지 확인**

Run: `./gradlew test --tests '*EnvironmentBuildTest' --tests '*PrizmBackendApplicationTests'`
Expected: 전부 PASS. `PrizmBackendApplicationTests`가 스프링 컨텍스트를 올리므로, 저장소의 파생 쿼리 이름(`findByStatus`)이 틀렸다면 여기서 실패한다

- [ ] **Step 7: 커밋**

```bash
git add src/main/java/com/prizm/backend/environment/ src/test/java/com/prizm/backend/environment/EnvironmentBuildTest.java
git commit -m "feat: 환경 빌드 엔티티와 저장소 추가

캐시 키를 기본 키로 삼아 같은 (베이스, requirements, 레시피) 조합이 두 번
저장될 수 없게 한다. requirements가 비어 빌드할 것이 없으면 베이스 이미지를
그대로 가리키는 READY 레코드를 만든다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: 이미지 빌더와 환경 설정

**Files:**
- Create: `src/main/java/com/prizm/backend/environment/CommandRunner.java`
- Create: `src/main/java/com/prizm/backend/environment/ProcessCommandRunner.java`
- Create: `src/main/java/com/prizm/backend/environment/ImageBuilder.java`
- Modify: `src/main/java/com/prizm/backend/config/PrizmProperties.java`
- Modify: `src/main/resources/application.yml`
- Modify: `src/test/java/com/prizm/backend/TestFixtures.java`
- Modify: `src/test/java/com/prizm/backend/PrizmBackendApplicationTests.java`
- Test: `src/test/java/com/prizm/backend/environment/ImageBuilderTest.java`

**Interfaces:**
- Consumes: `EnvironmentBuild` (Task 3)
- Produces:
  - `CommandRunner.run(List<String> command, Path workingDirectory, Duration timeout)` → `CommandRunner.CommandResult(int exitCode, String output)`, 메서드 `succeeded()`
  - `ImageBuilder.build(EnvironmentBuild build)` → `ImageBuilder.BuildOutcome(boolean succeeded, String imageRef, String log, String logPath)`
  - `PrizmProperties.Environment(Path buildRoot, String imagePrefix, String indexUrl, Duration buildTimeout)` — `PrizmProperties`의 새 컴포넌트

**베이스 다이제스트와 FROM에 대한 설계 메모:** 캐시 키에는 `docker image inspect -f '{{.Id}}'`가 돌려주는 이미지 ID를 다이제스트 자리에 쓰고, 생성하는 Dockerfile의 `FROM`에는 **태그**를 쓴다. 로컬에서 빌드한 이미지에는 레지스트리 다이제스트가 없어 `FROM ref@sha256:...` 형식을 쓸 수 없기 때문이다. 태그가 가리키는 이미지가 바뀌면 이미지 ID가 바뀌고 캐시 키도 바뀌므로 정확성은 유지된다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/environment/ImageBuilderTest.java`:

```java
package com.prizm.backend.environment;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ImageBuilderTest {

    private static final Instant NOW = Instant.parse("2026-09-19T01:00:00Z");

    @TempDir
    Path buildRoot;

    private final List<List<String>> commands = new ArrayList<>();
    private CommandRunner.CommandResult nextResult = new CommandRunner.CommandResult(0, "Successfully built");

    private final CommandRunner runner = (command, workingDirectory, timeout) -> {
        commands.add(List.copyOf(command));
        return nextResult;
    };

    private EnvironmentBuild build() {
        return EnvironmentBuild.pending("0123456789abcdef", "prizm/runtime-base:v1", "sha256:abc",
                "pandas==2.2.3\n", "pandas==2.2.3", "r1", NOW);
    }

    private ImageBuilder builder(String indexUrl) {
        return new ImageBuilder(runner, buildRoot, "prizm/env", indexUrl, Duration.ofMinutes(15));
    }

    @Test
    void runsDockerBuildWithCacheKeyTag() {
        ImageBuilder.BuildOutcome outcome = builder("").build(build());

        Path context = buildRoot.resolve("0123456789abcdef");
        assertThat(commands).hasSize(1);
        assertThat(commands.getFirst()).containsExactly(
                "docker", "build",
                "-t", "prizm/env:0123456789abcdef",
                "-f", context.resolve("Dockerfile").toString(),
                context.toString());
        assertThat(outcome.succeeded()).isTrue();
        assertThat(outcome.imageRef()).isEqualTo("prizm/env:0123456789abcdef");
    }

    @Test
    void writesNormalizedRequirementsIntoBuildContext() throws IOException {
        builder("").build(build());

        Path requirements = buildRoot.resolve("0123456789abcdef").resolve("requirements.txt");
        assertThat(Files.readString(requirements)).isEqualTo("pandas==2.2.3\n");
    }

    @Test
    void generatedDockerfileUsesBaseTagAndSystemInstall() throws IOException {
        builder("").build(build());

        String dockerfile = Files.readString(buildRoot.resolve("0123456789abcdef").resolve("Dockerfile"));
        assertThat(dockerfile)
                .startsWith("FROM prizm/runtime-base:v1\n")
                .contains("COPY requirements.txt /tmp/prizm-requirements.txt")
                .contains("RUN uv pip install --system --no-cache -r /tmp/prizm-requirements.txt")
                .doesNotContain("UV_INDEX_URL");
    }

    @Test
    void generatedDockerfileSetsIndexUrlWhenMirrorIsConfigured() throws IOException {
        builder("https://nexus.example.com/repository/pypi/simple").build(build());

        String dockerfile = Files.readString(buildRoot.resolve("0123456789abcdef").resolve("Dockerfile"));
        assertThat(dockerfile).contains("ENV UV_INDEX_URL=https://nexus.example.com/repository/pypi/simple");
    }

    @Test
    void reportsFailureWithCommandOutput() {
        nextResult = new CommandRunner.CommandResult(1, "ERROR: No matching distribution found for nosuchpkg");

        ImageBuilder.BuildOutcome outcome = builder("").build(build());

        assertThat(outcome.succeeded()).isFalse();
        assertThat(outcome.imageRef()).isNull();
        assertThat(outcome.log()).contains("No matching distribution found");
    }

    @Test
    void writesFullBuildLogNextToTheBuildContext() throws IOException {
        nextResult = new CommandRunner.CommandResult(1, "긴 빌드 로그 전문\n두 번째 줄\n");

        ImageBuilder.BuildOutcome outcome = builder("").build(build());

        Path logPath = buildRoot.resolve("0123456789abcdef").resolve("build.log");
        assertThat(outcome.logPath()).isEqualTo(logPath.toString());
        assertThat(Files.readString(logPath)).contains("두 번째 줄");
    }

    @Test
    void rebuildOverwritesPreviousBuildContext() throws IOException {
        builder("").build(build());
        Path stale = buildRoot.resolve("0123456789abcdef").resolve("stale.txt");
        Files.writeString(stale, "남아 있으면 안 되는 파일");

        builder("").build(build());

        assertThat(stale).doesNotExist();
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*ImageBuilderTest'`
Expected: 컴파일 실패 — `CommandRunner`, `ImageBuilder` 없음

- [ ] **Step 3: 명령 실행 seam 작성**

`src/main/java/com/prizm/backend/environment/CommandRunner.java`:

```java
package com.prizm.backend.environment;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

/** 외부 명령 실행 지점. 테스트에서는 실제 docker를 부르지 않도록 이 인터페이스를 대체한다. */
@FunctionalInterface
public interface CommandRunner {

    CommandResult run(List<String> command, Path workingDirectory, Duration timeout);

    record CommandResult(int exitCode, String output) {

        public boolean succeeded() {
            return exitCode == 0;
        }
    }
}
```

`src/main/java/com/prizm/backend/environment/ProcessCommandRunner.java`:

```java
package com.prizm.backend.environment;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

/** ProcessBuilder로 외부 명령을 실행하고 표준 출력·표준 오류를 함께 모은다. */
@Component
public class ProcessCommandRunner implements CommandRunner {

    private static final int TIMED_OUT = -1;

    @Override
    public CommandResult run(List<String> command, Path workingDirectory, Duration timeout) {
        ProcessBuilder processBuilder = new ProcessBuilder(command)
                .directory(workingDirectory.toFile())
                .redirectErrorStream(true);
        Process process = null;
        try {
            process = processBuilder.start();
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                return new CommandResult(TIMED_OUT, output + "\n명령이 제한 시간을 초과했습니다: " + timeout);
            }
            return new CommandResult(process.exitValue(), output);
        } catch (IOException e) {
            return new CommandResult(TIMED_OUT, "명령을 실행할 수 없습니다: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            if (process != null) {
                process.destroyForcibly();
            }
            return new CommandResult(TIMED_OUT, "명령 실행이 중단되었습니다");
        }
    }
}
```

- [ ] **Step 4: 이미지 빌더 작성**

`src/main/java/com/prizm/backend/environment/ImageBuilder.java`:

```java
package com.prizm.backend.environment;

import com.prizm.backend.config.PrizmProperties;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 베이스 이미지 위에 사용자 requirements를 설치한 파생 이미지를 만든다.
 *
 * <p>설치는 사용자 환경(site-packages)에만 일어난다. 편집·실행 도구가 사는
 * 도구 venv(/opt/prizm/tools)는 건드리지 않으므로, 사용자가 어떤 패키지를
 * 추가해도 papermill·JupyterLab과 충돌하지 않는다.
 */
@Component
public class ImageBuilder {

    private final CommandRunner runner;
    private final Path buildRoot;
    private final String imagePrefix;
    private final String indexUrl;
    private final Duration buildTimeout;

    @Autowired
    public ImageBuilder(CommandRunner runner, PrizmProperties properties) {
        this(runner, properties.environment().buildRoot(), properties.environment().imagePrefix(),
                properties.environment().indexUrl(), properties.environment().buildTimeout());
    }

    ImageBuilder(CommandRunner runner, Path buildRoot, String imagePrefix, String indexUrl, Duration buildTimeout) {
        this.runner = runner;
        this.buildRoot = buildRoot;
        this.imagePrefix = imagePrefix;
        this.indexUrl = indexUrl;
        this.buildTimeout = buildTimeout;
    }

    public BuildOutcome build(EnvironmentBuild build) {
        Path context = prepareContext(build);
        String imageRef = imagePrefix + ":" + build.getCacheKey();
        List<String> command = List.of(
                "docker", "build",
                "-t", imageRef,
                "-f", context.resolve("Dockerfile").toString(),
                context.toString());
        CommandRunner.CommandResult result = runner.run(command, context, buildTimeout);
        // 로그 전문은 파일로 남긴다. DB에는 한 줄 요약만 들어가므로, 설치 실패를
        // 진단하려면 전문이 어딘가 남아 있어야 한다.
        Path logPath = writeLog(context, result.output());
        return result.succeeded()
                ? new BuildOutcome(true, imageRef, result.output(), logPath.toString())
                : new BuildOutcome(false, null, result.output(), logPath.toString());
    }

    private static Path writeLog(Path context, String output) {
        Path logPath = context.resolve("build.log");
        try {
            Files.writeString(logPath, output == null ? "" : output);
        } catch (IOException e) {
            throw new UncheckedIOException("빌드 로그를 쓸 수 없습니다: " + logPath, e);
        }
        return logPath;
    }

    private Path prepareContext(EnvironmentBuild build) {
        Path context = buildRoot.resolve(build.getCacheKey());
        try {
            deleteRecursively(context);
            Files.createDirectories(context);
            Files.writeString(context.resolve("requirements.txt"), build.getRequirementsNorm() + "\n");
            Files.writeString(context.resolve("Dockerfile"), dockerfile(build));
            return context;
        } catch (IOException e) {
            throw new UncheckedIOException("빌드 컨텍스트를 준비할 수 없습니다: " + context, e);
        }
    }

    private String dockerfile(EnvironmentBuild build) {
        StringBuilder dockerfile = new StringBuilder();
        dockerfile.append("FROM ").append(build.getBaseImageRef()).append('\n');
        if (indexUrl != null && !indexUrl.isBlank()) {
            dockerfile.append("ENV UV_INDEX_URL=").append(indexUrl.trim()).append('\n');
        }
        dockerfile.append("COPY requirements.txt /tmp/prizm-requirements.txt\n");
        dockerfile.append("RUN uv pip install --system --no-cache -r /tmp/prizm-requirements.txt\n");
        return dockerfile.toString();
    }

    private static void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }
        try (Stream<Path> entries = Files.walk(path)) {
            for (Path entry : entries.sorted(Comparator.reverseOrder()).toList()) {
                Files.delete(entry);
            }
        }
    }

    public record BuildOutcome(boolean succeeded, String imageRef, String log, String logPath) {
    }
}
```

- [ ] **Step 5: 설정 레코드에 environment 추가**

`src/main/java/com/prizm/backend/config/PrizmProperties.java` — `Monitor monitor,` 다음 줄에 `Environment environment,`를 넣고, 중첩 레코드를 추가한다. 최종 형태:

```java
package com.prizm.backend.config;

import com.prizm.backend.asset.CodeAssetProperties;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "prizm")
public record PrizmProperties(
        Airflow airflow,
        Mlflow mlflow,
        Path runsDir,
        Cors cors,
        Monitor monitor,
        Environment environment,
        List<CodeAssetProperties> codeAssets) {

    public record Airflow(String baseUrl, String username, String password, String dagId) {
    }

    public record Mlflow(String baseUrl, String experimentName) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record Monitor(boolean enabled) {
    }

    /** 파생 이미지 빌드 설정. indexUrl이 비어 있으면 기본 PyPI를, 값이 있으면 사내 미러를 쓴다. */
    public record Environment(Path buildRoot, String imagePrefix, String indexUrl, Duration buildTimeout) {
    }
}
```

- [ ] **Step 6: application.yml에 environment 블록 추가**

`src/main/resources/application.yml`의 `monitor:` 블록 다음, `code-assets:` 앞에 넣는다:

```yaml
  environment:
    build-root: ${user.home}/Workspace/notebook/prototype/env-builds
    image-prefix: prizm/env
    # 비우면 기본 PyPI를 쓴다. 사내 미러(Nexus/Artifactory)는 여기에 넣는다.
    index-url: ""
    build-timeout: 15m
```

- [ ] **Step 7: TestFixtures를 새 설정에 맞춘다**

`src/test/java/com/prizm/backend/TestFixtures.java`의 `properties` 메서드를 아래로 교체하고, `java.time.Duration` import를 추가한다:

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
                List.of(weldAsset()));
    }
```

- [ ] **Step 8: 설정 바인딩 테스트 보강**

`src/test/java/com/prizm/backend/PrizmBackendApplicationTests.java`의 `bindsPrizmProperties` 테스트 끝에 다음 두 줄을 추가한다:

```java
        assertThat(properties.environment().imagePrefix()).isEqualTo("prizm/env");
        assertThat(properties.environment().buildTimeout()).isEqualTo(java.time.Duration.ofMinutes(15));
```

- [ ] **Step 9: 테스트 전체 실행**

Run: `./gradlew test`
Expected: 전부 PASS (ImageBuilderTest 6개 포함)

- [ ] **Step 10: 커밋**

```bash
git add src/main/java/com/prizm/backend/environment/ src/main/java/com/prizm/backend/config/PrizmProperties.java \
        src/main/resources/application.yml src/test/java/com/prizm/backend/
git commit -m "feat: 파생 이미지 빌더와 환경 설정 추가

빌드 컨텍스트에 정규화된 requirements와 Dockerfile을 쓰고 docker build를
실행한다. 설치는 uv pip install --system 으로 사용자 환경에만 일어나며 도구
venv는 건드리지 않는다. 사내 미러가 설정되면 UV_INDEX_URL을 주입한다.

외부 명령 실행은 CommandRunner seam으로 분리해 테스트에서 실제 docker를
부르지 않는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 5: 환경 오케스트레이션 서비스

**Files:**
- Create: `src/main/java/com/prizm/backend/api/EnvironmentNotFoundException.java`
- Create: `src/main/java/com/prizm/backend/environment/EnvironmentService.java`
- Test: `src/test/java/com/prizm/backend/environment/EnvironmentServiceTest.java`

**Interfaces:**
- Consumes: `RequirementsNormalizer.normalize` (Task 1), `EnvironmentCacheKey.compute`·`RECIPE_VERSION` (Task 2), `EnvironmentBuild`·`EnvironmentBuildRepository` (Task 3), `ImageBuilder.build` (Task 4)
- Produces:
  - `EnvironmentService.ensure(String baseImageRef, String baseImageDigest, String rawRequirements)` → `EnvironmentBuild`
  - `EnvironmentService.get(String cacheKey)` → `EnvironmentBuild` (없으면 `EnvironmentNotFoundException`)
  - `EnvironmentService.processPendingBuilds()` → `void` (2초 주기 스케줄)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/environment/EnvironmentServiceTest.java`:

```java
package com.prizm.backend.environment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.prizm.backend.api.EnvironmentNotFoundException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EnvironmentServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-19T01:00:00Z");
    private static final String BASE = "prizm/runtime-base:v1";
    private static final String DIGEST = "sha256:abc";

    @Mock
    private EnvironmentBuildRepository repository;

    @Mock
    private ImageBuilder builder;

    private EnvironmentService service;

    @BeforeEach
    void setUp() {
        service = new EnvironmentService(repository, builder, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void registersPendingBuildForNewRequirements() {
        when(repository.findById(any())).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        EnvironmentBuild build = service.ensure(BASE, DIGEST, "pandas==2.2.3");

        assertThat(build.getStatus()).isEqualTo(EnvironmentBuildStatus.PENDING);
        assertThat(build.getRequirementsNorm()).isEqualTo("pandas==2.2.3");
        assertThat(build.getRequirementsRaw()).isEqualTo("pandas==2.2.3");
        assertThat(build.getRecipeVersion()).isEqualTo(EnvironmentCacheKey.RECIPE_VERSION);
        verifyNoInteractions(builder);
    }

    @Test
    void reusesExistingBuildWithoutSaving() {
        EnvironmentBuild existing = EnvironmentBuild.pending("key", BASE, DIGEST, "pandas", "pandas", "r1", NOW);
        existing.markReady("prizm/env:key", NOW);
        when(repository.findById(any())).thenReturn(Optional.of(existing));

        EnvironmentBuild build = service.ensure(BASE, DIGEST, "pandas");

        assertThat(build).isSameAs(existing);
        verify(repository, never()).save(any());
    }

    @Test
    void sameRequirementsInDifferentOrderReuseTheSameCacheKey() {
        when(repository.findById(any())).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        EnvironmentBuild first = service.ensure(BASE, DIGEST, "pandas\nnumpy");
        EnvironmentBuild second = service.ensure(BASE, DIGEST, "numpy\npandas");

        assertThat(first.getCacheKey()).isEqualTo(second.getCacheKey());
    }

    @Test
    void emptyRequirementsBecomeReadyImmediatelyPointingAtBaseImage() {
        when(repository.findById(any())).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        EnvironmentBuild build = service.ensure(BASE, DIGEST, "   \n# 주석만\n");

        assertThat(build.getStatus()).isEqualTo(EnvironmentBuildStatus.READY);
        assertThat(build.getImageRef()).isEqualTo(BASE);
        verifyNoInteractions(builder);
    }

    @Test
    void processPendingBuildsMarksReadyOnSuccess() {
        EnvironmentBuild pending = EnvironmentBuild.pending("key", BASE, DIGEST, "pandas", "pandas", "r1", NOW);
        when(repository.findByStatus(EnvironmentBuildStatus.PENDING)).thenReturn(List.of(pending));
        when(builder.build(pending)).thenReturn(
                new ImageBuilder.BuildOutcome(true, "prizm/env:key", "ok", "/tmp/builds/key/build.log"));

        service.processPendingBuilds();

        assertThat(pending.getStatus()).isEqualTo(EnvironmentBuildStatus.READY);
        assertThat(pending.getImageRef()).isEqualTo("prizm/env:key");
        assertThat(pending.getBuildLogRef()).isEqualTo("/tmp/builds/key/build.log");
        assertThat(pending.getStartedAt()).isEqualTo(NOW);
        assertThat(pending.getFinishedAt()).isEqualTo(NOW);
    }

    @Test
    void processPendingBuildsKeepsTheErrorLineOnFailure() {
        EnvironmentBuild pending = EnvironmentBuild.pending("key", BASE, DIGEST, "nosuchpkg", "nosuchpkg", "r1", NOW);
        when(repository.findByStatus(EnvironmentBuildStatus.PENDING)).thenReturn(List.of(pending));
        when(builder.build(pending)).thenReturn(new ImageBuilder.BuildOutcome(false, null,
                "Step 3/3 : RUN uv pip install\n  x No solution found\nERROR: No matching distribution found for nosuchpkg\n",
                "/tmp/builds/key/build.log"));

        service.processPendingBuilds();

        assertThat(pending.getStatus()).isEqualTo(EnvironmentBuildStatus.FAILED);
        assertThat(pending.getErrorSummary()).isEqualTo("ERROR: No matching distribution found for nosuchpkg");
    }

    @Test
    void failureWithoutErrorLineKeepsTheTailOfTheLog() {
        EnvironmentBuild pending = EnvironmentBuild.pending("key", BASE, DIGEST, "pandas", "pandas", "r1", NOW);
        when(repository.findByStatus(EnvironmentBuildStatus.PENDING)).thenReturn(List.of(pending));
        when(builder.build(pending)).thenReturn(
                new ImageBuilder.BuildOutcome(false, null, "첫 줄\n둘째 줄\n", "/tmp/builds/key/build.log"));

        service.processPendingBuilds();

        assertThat(pending.getErrorSummary()).isEqualTo("둘째 줄");
    }

    @Test
    void getThrowsWhenCacheKeyIsUnknown() {
        when(repository.findById("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get("nope"))
                .isInstanceOf(EnvironmentNotFoundException.class)
                .hasMessage("등록되지 않은 환경입니다: nope");
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*EnvironmentServiceTest'`
Expected: 컴파일 실패 — `EnvironmentService`, `EnvironmentNotFoundException` 없음

- [ ] **Step 3: 예외 클래스 작성**

`src/main/java/com/prizm/backend/api/EnvironmentNotFoundException.java`:

```java
package com.prizm.backend.api;

/** 404 Not Found로 응답할 환경 조회 오류. */
public class EnvironmentNotFoundException extends RuntimeException {

    public EnvironmentNotFoundException(String cacheKey) {
        super("등록되지 않은 환경입니다: " + cacheKey);
    }
}
```

- [ ] **Step 4: 서비스 작성**

`src/main/java/com/prizm/backend/environment/EnvironmentService.java`:

```java
package com.prizm.backend.environment;

import com.prizm.backend.api.EnvironmentNotFoundException;
import java.time.Clock;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 코드 자산의 requirements를 파생 이미지로 만들어 두는 오케스트레이션.
 *
 * <p>같은 (베이스, requirements, 레시피) 조합은 캐시 키가 같으므로 조직 전체에서
 * 한 번만 빌드된다. 빌드는 등록 시점에 백그라운드로 일어나고, 실행·편집은 이미
 * 만들어진 이미지를 쓰기만 한다.
 */
@Service
public class EnvironmentService {

    private static final Logger log = LoggerFactory.getLogger(EnvironmentService.class);
    private static final int BUILD_POLL_INTERVAL_MS = 2000;

    private final EnvironmentBuildRepository repository;
    private final ImageBuilder builder;
    private final Clock clock;

    public EnvironmentService(EnvironmentBuildRepository repository, ImageBuilder builder, Clock clock) {
        this.repository = repository;
        this.builder = builder;
        this.clock = clock;
    }

    @Transactional
    public EnvironmentBuild ensure(String baseImageRef, String baseImageDigest, String rawRequirements) {
        String normalized = RequirementsNormalizer.normalize(rawRequirements);
        String cacheKey = EnvironmentCacheKey.compute(baseImageDigest, normalized);

        Optional<EnvironmentBuild> existing = repository.findById(cacheKey);
        if (existing.isPresent()) {
            return existing.get();
        }

        EnvironmentBuild build = normalized.isEmpty()
                ? EnvironmentBuild.ready(cacheKey, baseImageRef, baseImageDigest,
                        EnvironmentCacheKey.RECIPE_VERSION, clock.instant())
                : EnvironmentBuild.pending(cacheKey, baseImageRef, baseImageDigest,
                        rawRequirements == null ? "" : rawRequirements, normalized,
                        EnvironmentCacheKey.RECIPE_VERSION, clock.instant());
        try {
            return repository.save(build);
        } catch (DataIntegrityViolationException e) {
            // 같은 캐시 키를 동시에 요청한 다른 실행이 먼저 저장했다. 그 레코드를 따라간다.
            return repository.findById(cacheKey).orElseThrow(() -> e);
        }
    }

    public EnvironmentBuild get(String cacheKey) {
        return repository.findById(cacheKey).orElseThrow(() -> new EnvironmentNotFoundException(cacheKey));
    }

    @Scheduled(fixedDelay = BUILD_POLL_INTERVAL_MS)
    public void processPendingBuilds() {
        for (EnvironmentBuild build : repository.findByStatus(EnvironmentBuildStatus.PENDING)) {
            runBuild(build);
        }
    }

    private void runBuild(EnvironmentBuild build) {
        log.info("환경 빌드 시작: {} ({}개 줄)", build.getCacheKey(), build.getRequirementsNorm().lines().count());
        build.markBuilding(clock.instant());
        repository.save(build);

        ImageBuilder.BuildOutcome outcome = builder.build(build);
        build.setBuildLogRef(outcome.logPath());
        if (outcome.succeeded()) {
            build.markReady(outcome.imageRef(), clock.instant());
            log.info("환경 빌드 완료: {}", outcome.imageRef());
        } else {
            String summary = summarize(outcome.log());
            build.markFailed(summary, clock.instant());
            log.warn("환경 빌드 실패: {} - {}", build.getCacheKey(), summary);
        }
        repository.save(build);
    }

    /** 빌드 로그에서 사용자가 볼 한 줄을 고른다. ERROR 줄이 있으면 마지막 것을, 없으면 마지막 줄을 쓴다. */
    private static String summarize(String buildLog) {
        if (buildLog == null || buildLog.isBlank()) {
            return "빌드가 실패했습니다";
        }
        List<String> lines = Arrays.stream(buildLog.split("\\R"))
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .toList();
        if (lines.isEmpty()) {
            return "빌드가 실패했습니다";
        }
        return lines.stream()
                .filter(line -> line.contains("ERROR") || line.contains("error:"))
                .reduce((first, second) -> second)
                .orElseGet(lines::getLast);
    }
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `./gradlew test --tests '*EnvironmentServiceTest'`
Expected: 8개 테스트 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/main/java/com/prizm/backend/api/EnvironmentNotFoundException.java \
        src/main/java/com/prizm/backend/environment/EnvironmentService.java \
        src/test/java/com/prizm/backend/environment/EnvironmentServiceTest.java
git commit -m "feat: 환경 오케스트레이션 서비스 추가

requirements 정규화 → 캐시 키 계산 → 기존 레코드 조회 → 없으면 PENDING 등록
까지를 담당하고, 2초 주기 스케줄이 PENDING을 집어 실제 빌드를 돌린다.
requirements가 비면 빌드 없이 베이스 이미지를 가리키는 READY로 끝낸다.

빌드 실패 시 로그에서 ERROR 줄을 골라 화면에 보여줄 한 줄로 남긴다. 폐쇄망
에서는 설치 실패가 잦을 것이므로 어떤 패키지가 왜 실패했는지가 중요하다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: 환경 REST API

**Files:**
- Create: `src/main/java/com/prizm/backend/environment/EnsureEnvironmentRequest.java`
- Create: `src/main/java/com/prizm/backend/environment/EnvironmentResponse.java`
- Create: `src/main/java/com/prizm/backend/environment/EnvironmentController.java`
- Modify: `src/main/java/com/prizm/backend/api/ApiExceptionHandler.java`
- Test: `src/test/java/com/prizm/backend/environment/EnvironmentControllerTest.java`

**Interfaces:**
- Consumes: `EnvironmentService.ensure`·`get` (Task 5), `EnvironmentBuild` (Task 3)
- Produces:
  - `POST /api/environments` — 본문 `{"baseImage": "...", "baseImageDigest": "...", "requirements": "..."}` → 202 Accepted, 본문 `{"cacheKey", "status", "imageRef", "errorSummary"}`
  - `GET /api/environments/{cacheKey}` → 200, 같은 본문 형태
  - `EnvironmentResponse.from(EnvironmentBuild build)` → `EnvironmentResponse`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/java/com/prizm/backend/environment/EnvironmentControllerTest.java`:

```java
package com.prizm.backend.environment;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.prizm.backend.api.ApiExceptionHandler;
import com.prizm.backend.api.EnvironmentNotFoundException;
import com.prizm.backend.api.InvalidRequirementsException;
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
class EnvironmentControllerTest {

    private static final Instant NOW = Instant.parse("2026-09-19T01:00:00Z");
    private static final String BODY = """
            {"baseImage": "prizm/runtime-base:v1", "baseImageDigest": "sha256:abc",
             "requirements": "pandas==2.2.3"}
            """;

    @Mock
    private EnvironmentService service;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new EnvironmentController(service))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    private EnvironmentBuild pending() {
        return EnvironmentBuild.pending("0123456789abcdef", "prizm/runtime-base:v1", "sha256:abc",
                "pandas==2.2.3", "pandas==2.2.3", "r1", NOW);
    }

    @Test
    void acceptsEnsureRequestAndReturnsCacheKey() throws Exception {
        when(service.ensure(eq("prizm/runtime-base:v1"), eq("sha256:abc"), eq("pandas==2.2.3")))
                .thenReturn(pending());

        mockMvc.perform(post("/api/environments").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.cacheKey").value("0123456789abcdef"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.imageRef").doesNotExist());
    }

    @Test
    void returnsImageRefWhenBuildIsReady() throws Exception {
        EnvironmentBuild ready = pending();
        ready.markReady("prizm/env:0123456789abcdef", NOW);
        when(service.get("0123456789abcdef")).thenReturn(ready);

        mockMvc.perform(get("/api/environments/0123456789abcdef"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.imageRef").value("prizm/env:0123456789abcdef"));
    }

    @Test
    void exposesErrorSummaryWhenBuildFailed() throws Exception {
        EnvironmentBuild failed = pending();
        failed.markFailed("ERROR: No matching distribution found for nosuchpkg", NOW);
        when(service.get("0123456789abcdef")).thenReturn(failed);

        mockMvc.perform(get("/api/environments/0123456789abcdef"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.errorSummary").value("ERROR: No matching distribution found for nosuchpkg"));
    }

    @Test
    void rejectsUnsupportedRequirementDirectiveWithBadRequest() throws Exception {
        when(service.ensure(eq("prizm/runtime-base:v1"), eq("sha256:abc"), eq("pandas==2.2.3")))
                .thenThrow(new InvalidRequirementsException("지원하지 않는 지시자입니다: -r other.txt"));

        mockMvc.perform(post("/api/environments").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("지원하지 않는 지시자입니다: -r other.txt"));
    }

    @Test
    void rejectsMissingBaseImageWithBadRequest() throws Exception {
        mockMvc.perform(post("/api/environments").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"baseImage": "", "baseImageDigest": "sha256:abc", "requirements": ""}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returnsNotFoundForUnknownCacheKey() throws Exception {
        when(service.get("nope")).thenThrow(new EnvironmentNotFoundException("nope"));

        mockMvc.perform(get("/api/environments/nope"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("등록되지 않은 환경입니다: nope"));
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*EnvironmentControllerTest'`
Expected: 컴파일 실패 — `EnvironmentController`, `EnsureEnvironmentRequest`, `EnvironmentResponse` 없음

- [ ] **Step 3: 요청·응답 레코드 작성**

`src/main/java/com/prizm/backend/environment/EnsureEnvironmentRequest.java`:

```java
package com.prizm.backend.environment;

import jakarta.validation.constraints.NotBlank;

public record EnsureEnvironmentRequest(
        @NotBlank String baseImage,
        @NotBlank String baseImageDigest,
        String requirements) {
}
```

`src/main/java/com/prizm/backend/environment/EnvironmentResponse.java`:

```java
package com.prizm.backend.environment;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EnvironmentResponse(String cacheKey, String status, String imageRef, String errorSummary) {

    public static EnvironmentResponse from(EnvironmentBuild build) {
        return new EnvironmentResponse(
                build.getCacheKey(),
                build.getStatus().name(),
                build.getImageRef(),
                build.getErrorSummary());
    }
}
```

- [ ] **Step 4: 컨트롤러 작성**

`src/main/java/com/prizm/backend/environment/EnvironmentController.java`:

```java
package com.prizm.backend.environment;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/environments")
public class EnvironmentController {

    private final EnvironmentService service;

    public EnvironmentController(EnvironmentService service) {
        this.service = service;
    }

    /** 환경을 보장한다. 이미 있으면 그대로, 없으면 빌드를 예약하고 즉시 응답한다. */
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public EnvironmentResponse ensure(@Valid @RequestBody EnsureEnvironmentRequest request) {
        return EnvironmentResponse.from(
                service.ensure(request.baseImage(), request.baseImageDigest(), request.requirements()));
    }

    @GetMapping("/{cacheKey}")
    public EnvironmentResponse get(@PathVariable String cacheKey) {
        return EnvironmentResponse.from(service.get(cacheKey));
    }
}
```

- [ ] **Step 5: 예외 핸들러에 두 핸들러 추가**

`src/main/java/com/prizm/backend/api/ApiExceptionHandler.java`의 `invalidRequest` 메서드 바로 다음에 추가하고, import 두 줄(`InvalidRequirementsException`, `EnvironmentNotFoundException`은 같은 패키지라 import 불필요)을 확인한다:

```java
    @ExceptionHandler(InvalidRequirementsException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiError invalidRequirements(InvalidRequirementsException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(EnvironmentNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiError environmentNotFound(EnvironmentNotFoundException e) {
        return new ApiError(e.getMessage());
    }
```

- [ ] **Step 6: 테스트 전체 실행**

Run: `./gradlew test`
Expected: 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/main/java/com/prizm/backend/environment/ src/main/java/com/prizm/backend/api/ApiExceptionHandler.java \
        src/test/java/com/prizm/backend/environment/EnvironmentControllerTest.java
git commit -m "feat: 환경 REST API 추가

POST /api/environments 는 환경을 보장하고 즉시 202로 캐시 키를 돌려준다.
GET /api/environments/{cacheKey} 로 빌드 상태와 결과 이미지를 조회한다.
빌드 실패 시 errorSummary로 실패 사유를 노출한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 7: 베이스 런타임 이미지

**Files:**
- Create: `~/Workspace/notebook/prototype/runtime/base/Dockerfile`
- Create: `~/Workspace/notebook/prototype/runtime/base/requirements-user.txt`

> **주의:** `prototype`은 git 저장소가 아니다. 이 작업은 새 파일만 만들므로 백업할 원본은 없지만, 이후 Task 9에서 기존 파일을 수정할 때는 반드시 백업한다.

**Interfaces:**
- Consumes: 없음 (백엔드 작업과 독립)
- Produces: 로컬 도커 이미지 `prizm/runtime-base:v1`. 파생 이미지 빌드(Task 4)의 `FROM`이 이 태그를 가리킨다

- [ ] **Step 1: 사용자 환경 requirements 작성**

`~/Workspace/notebook/prototype/runtime/base/requirements-user.txt`:

```
# 사용자 환경(site-packages)에 설치되는 ML 스택.
# papermill은 여기 없다 - 도구 venv(/opt/prizm/tools)에 설치된다.
# 사용자가 코드 자산에 추가하는 패키지도 이 환경에 설치된다.
ipykernel==6.29.5
requests==2.32.3
boto3==1.34.162
scikit-learn==1.5.2
pandas==2.2.3
joblib==1.4.2
mlflow==2.16.2
ultralytics==8.3.28
numpy<2.0
```

- [ ] **Step 2: Dockerfile 작성**

`~/Workspace/notebook/prototype/runtime/base/Dockerfile`:

```dockerfile
# PRIZM 베이스 런타임 이미지 v1 (CPU)
#
# Airflow를 포함하지 않는다. 노트북은 Airflow 워커 프로세스가 아니라
# 이 이미지로 만든 파생 이미지의 컨테이너 안에서 실행된다.
#
# 파이썬 환경을 둘로 나눈다:
#   - 사용자 환경(site-packages): ML 스택 + ipykernel.
#     사용자가 코드 자산에 추가한 requirements가 여기 설치된다.
#   - 도구 venv(/opt/prizm/tools): papermill (Phase 2에서 jupyterlab 추가).
#     사용자가 무엇을 설치하든 편집·실행 도구와 충돌하지 않는다.
FROM python:3.11-slim

# ultralytics -> opencv-python(GUI 빌드)이 요구하는 X11 공유 라이브러리
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 libxcb1 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 파생 이미지 빌드가 uv로 사용자 requirements를 설치한다
RUN pip install --no-cache-dir uv==0.4.20

# ── 사용자 환경 ─────────────────────────────────────────────
# torch/torchvision은 CPU 전용 wheel로 같은 인덱스에서 함께 설치한다.
# 서로 다른 소스(CPU/CUDA)에서 따로 설치하면 ABI가 어긋나
# "operator torchvision::nms does not exist" 같은 에러가 난다.
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY runtime/base/requirements-user.txt /tmp/requirements-user.txt
RUN pip install --no-cache-dir -r /tmp/requirements-user.txt \
    && python -m ipykernel install --name python3 --display-name python3

# MLOps SDK (사용자 Notebook이 mlops.data/model 로 자산을 주고받는다)
COPY sdk /opt/mlops-sdk
RUN pip install --no-cache-dir /opt/mlops-sdk

# ── 도구 venv ───────────────────────────────────────────────
RUN python -m venv /opt/prizm/tools \
    && /opt/prizm/tools/bin/pip install --no-cache-dir papermill==2.6.0

# 도구 venv에서 실행된 papermill이 사용자 환경의 커널스펙을 찾을 수 있어야 한다
ENV JUPYTER_PATH=/usr/local/share/jupyter
ENV PATH=/opt/prizm/tools/bin:$PATH
```

- [ ] **Step 3: 이미지 빌드**

빌드 컨텍스트는 `prototype` 루트다(`sdk/`를 COPY해야 하므로).

```bash
cd ~/Workspace/notebook/prototype
docker build -f runtime/base/Dockerfile -t prizm/runtime-base:v1 .
```

Expected: 성공. 최초 빌드는 torch 다운로드 때문에 몇 분 걸린다.

- [ ] **Step 4: 사용자 환경이 노트북 의존성을 갖췄는지 확인**

```bash
docker run --rm prizm/runtime-base:v1 python -c "import ultralytics, mlflow, mlops, yaml; print('user env ok')"
```

Expected: `user env ok`

- [ ] **Step 5: Airflow가 없음을 확인 (의존성 격리의 핵심)**

```bash
docker run --rm prizm/runtime-base:v1 python -c "import airflow" 2>&1 | tail -1
```

Expected: `ModuleNotFoundError: No module named 'airflow'`

- [ ] **Step 6: 사용자 환경에 papermill이 없음을 확인**

```bash
docker run --rm prizm/runtime-base:v1 python -c "import papermill" 2>&1 | tail -1
```

Expected: `ModuleNotFoundError: No module named 'papermill'`

- [ ] **Step 7: 도구 venv의 papermill이 동작하는지 확인**

```bash
docker run --rm prizm/runtime-base:v1 papermill --version
docker run --rm prizm/runtime-base:v1 /opt/prizm/tools/bin/python -c \
  "from jupyter_client.kernelspec import KernelSpecManager; print(KernelSpecManager().find_kernel_specs())"
```

Expected: 첫 명령은 `2.6.0`을 출력한다. 두 번째는 `python3` 커널스펙이 포함된 딕셔너리를 출력한다 — 도구 venv에서 실행된 papermill이 사용자 환경의 커널을 찾을 수 있다는 뜻이며, 이게 안 되면 격리 구조가 성립하지 않는다.

- [ ] **Step 8: 패키지 수가 줄었는지 확인**

```bash
docker run --rm prizm/runtime-base:v1 python -c \
  "import importlib.metadata as md; print('user env packages:', len(list(md.distributions())))"
docker run --rm prototype-airflow python -c \
  "import importlib.metadata as md; print('old image packages:', len(list(md.distributions())))"
```

Expected: 새 이미지의 패키지 수가 기존 422개보다 뚜렷하게 적다(Airflow 계열이 빠졌으므로). 두 숫자를 기록해 둔다.

- [ ] **Step 9: papermill 스모크 테스트**

한 셀짜리 노트북을 만들어 도구 venv의 papermill로 실행한다.

```bash
cd ~/Workspace/notebook/prototype
mkdir -p /tmp/prizm-smoke
python3 -c "
import json
nb = {'cells': [{'cell_type': 'code', 'source': ['import ultralytics\n', \"print('smoke ok', ultralytics.__version__)\"],
                 'metadata': {}, 'execution_count': None, 'outputs': []}],
      'metadata': {'kernelspec': {'name': 'python3', 'display_name': 'python3', 'language': 'python'}},
      'nbformat': 4, 'nbformat_minor': 5}
json.dump(nb, open('/tmp/prizm-smoke/in.ipynb', 'w'))
"
docker run --rm -v /tmp/prizm-smoke:/work prizm/runtime-base:v1 \
  papermill /work/in.ipynb /work/out.ipynb --log-output -k python3
```

Expected: 출력에 `smoke ok 8.3.28`이 보이고 종료 코드가 0이다. 이것이 Task 9에서 DockerOperator가 실제로 실행할 명령과 같은 형태다.

- [ ] **Step 10: 이미지 ID 기록**

```bash
docker image inspect -f '{{.Id}}' prizm/runtime-base:v1
```

이 값이 Task 8의 `BaseImageResolver`가 캐시 키에 쓰는 다이제스트다. 결과를 메모해 둔다.

---

### Task 8: 자산에 실행 환경 연결

**Files:**
- Create: `src/main/java/com/prizm/backend/environment/BaseImageResolver.java`
- Create: `src/test/java/com/prizm/backend/environment/BaseImageResolverTest.java`
- Modify: `src/main/java/com/prizm/backend/asset/CodeAssetProperties.java`
- Modify: `src/main/java/com/prizm/backend/run/RunService.java`
- Modify: `src/main/resources/application.yml`
- Modify: `src/test/java/com/prizm/backend/TestFixtures.java`
- Modify: `src/test/java/com/prizm/backend/run/RunServiceTest.java`

**Interfaces:**
- Consumes: `CommandRunner` (Task 4), `EnvironmentService.ensure` (Task 5), `EnvironmentBuild` (Task 3)
- Produces:
  - `BaseImageResolver.digest(String imageRef)` → `String` (`docker image inspect -f '{{.Id}}'` 결과). 실패하면 `InvalidRunRequestException`
  - `CodeAssetProperties`에 `String baseImage`, `String requirements` 필드 추가 (`parameterNames` 앞에 위치)
  - DAG conf에 `env_image_ref` 키 추가

- [ ] **Step 1: BaseImageResolver 실패 테스트 작성**

`src/test/java/com/prizm/backend/environment/BaseImageResolverTest.java`:

```java
package com.prizm.backend.environment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.prizm.backend.api.InvalidRunRequestException;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class BaseImageResolverTest {

    private final List<List<String>> commands = new ArrayList<>();
    private CommandRunner.CommandResult nextResult =
            new CommandRunner.CommandResult(0, "sha256:1234567890abcdef\n");

    private final CommandRunner runner = (command, workingDirectory, timeout) -> {
        commands.add(List.copyOf(command));
        return nextResult;
    };

    private final BaseImageResolver resolver = new BaseImageResolver(runner, Path.of("."), Duration.ofSeconds(10));

    @Test
    void returnsTrimmedImageId() {
        String digest = resolver.digest("prizm/runtime-base:v1");

        assertThat(digest).isEqualTo("sha256:1234567890abcdef");
        assertThat(commands.getFirst()).containsExactly(
                "docker", "image", "inspect", "-f", "{{.Id}}", "prizm/runtime-base:v1");
    }

    @Test
    void failsWhenImageIsMissing() {
        nextResult = new CommandRunner.CommandResult(1, "Error: No such image: prizm/runtime-base:v1");

        assertThatThrownBy(() -> resolver.digest("prizm/runtime-base:v1"))
                .isInstanceOf(InvalidRunRequestException.class)
                .hasMessage("베이스 이미지를 찾을 수 없습니다: prizm/runtime-base:v1");
    }

    @Test
    void failsWhenOutputIsEmpty() {
        nextResult = new CommandRunner.CommandResult(0, "  \n");

        assertThatThrownBy(() -> resolver.digest("prizm/runtime-base:v1"))
                .isInstanceOf(InvalidRunRequestException.class)
                .hasMessage("베이스 이미지를 찾을 수 없습니다: prizm/runtime-base:v1");
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*BaseImageResolverTest'`
Expected: 컴파일 실패 — `BaseImageResolver` 없음

- [ ] **Step 3: BaseImageResolver 작성**

`src/main/java/com/prizm/backend/environment/BaseImageResolver.java`:

```java
package com.prizm.backend.environment;

import com.prizm.backend.api.InvalidRunRequestException;
import com.prizm.backend.config.PrizmProperties;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 베이스 이미지의 현재 내용을 식별하는 값을 얻는다.
 *
 * <p>로컬에서 빌드한 이미지에는 레지스트리 다이제스트가 없으므로 이미지 ID를 쓴다.
 * 태그가 가리키는 이미지가 바뀌면 ID가 바뀌고 캐시 키도 바뀌므로, 베이스가 갱신되면
 * 파생 이미지도 다시 빌드된다.
 */
@Component
public class BaseImageResolver {

    private static final Duration INSPECT_TIMEOUT = Duration.ofSeconds(10);

    private final CommandRunner runner;
    private final Path workingDirectory;
    private final Duration timeout;

    @Autowired
    public BaseImageResolver(CommandRunner runner, PrizmProperties properties) {
        this(runner, properties.environment().buildRoot(), INSPECT_TIMEOUT);
    }

    BaseImageResolver(CommandRunner runner, Path workingDirectory, Duration timeout) {
        this.runner = runner;
        this.workingDirectory = workingDirectory;
        this.timeout = timeout;
    }

    public String digest(String imageRef) {
        CommandRunner.CommandResult result = runner.run(
                List.of("docker", "image", "inspect", "-f", "{{.Id}}", imageRef), workingDirectory, timeout);
        String digest = result.output() == null ? "" : result.output().trim();
        if (!result.succeeded() || digest.isEmpty()) {
            throw new InvalidRunRequestException("베이스 이미지를 찾을 수 없습니다: " + imageRef);
        }
        return digest;
    }
}
```

`BaseImageResolver`가 `@Autowired` 생성자에서 `buildRoot`를 작업 디렉터리로 쓰므로, 그 경로가 실제로 존재해야 한다. Step 7에서 만든다.

- [ ] **Step 4: 자산 설정에 baseImage·requirements 추가**

`src/main/java/com/prizm/backend/asset/CodeAssetProperties.java`를 아래로 교체한다:

```java
package com.prizm.backend.asset;

import java.util.Map;

/** 프론트 자산 ID·버전과 AI Hub 코드 자산, 실행 환경, 화면 파라미터 이름 → 노트북 변수 이름 매핑. */
public record CodeAssetProperties(
        String assetId,
        String assetVersion,
        String codeKey,
        String codeVersion,
        String baseImage,
        String requirements,
        Map<String, String> parameterNames) {
}
```

`src/main/resources/application.yml`의 `code-assets` 항목에 두 줄을 추가한다 (`code-version: v2` 다음):

```yaml
      base-image: prizm/runtime-base:v1
      # 이 자산이 추가로 필요로 하는 패키지. 비우면 베이스 이미지를 그대로 쓴다.
      requirements: ""
```

`src/test/java/com/prizm/backend/TestFixtures.java`의 `weldAsset()`을 아래로 교체한다:

```java
    public static CodeAssetProperties weldAsset() {
        Map<String, String> names = new LinkedHashMap<>();
        names.put("epochs", "epochs");
        names.put("batch_size", "batch");
        names.put("image_size", "imgsz");
        names.put("seed", "seed");
        return new CodeAssetProperties(
                "PRJ000212-C-0001", "v2.4.1", "demo.door_defect_yolov8_training", "v2",
                "prizm/runtime-base:v1", "", names);
    }
```

- [ ] **Step 5: RunServiceTest를 새 의존성에 맞추고 테스트 추가**

**먼저 알아둘 것:** `create()`가 이제 `baseImageResolver.digest()`와 `environments.ensure()`를 호출하므로, 이 둘을 스텁하지 않으면 **기존 테스트가 전부 NullPointerException으로 깨진다**(목이 null을 돌려주고 `environment.getStatus()`에서 터진다). `@BeforeEach`에서 `lenient()`로 기본 스텁을 깔아 두면 기존 테스트는 그대로 통과하고, 새 테스트는 각자 다시 스텁하면 된다.

`RunServiceTest`의 import에 다음을 추가한다:

```java
import static org.mockito.Mockito.lenient;

import com.prizm.backend.environment.BaseImageResolver;
import com.prizm.backend.environment.EnvironmentBuild;
import com.prizm.backend.environment.EnvironmentService;
```

`@Mock` 선언 블록과 `setUp`을 아래로 교체한다:

```java
    private static final String BASE_IMAGE = "prizm/runtime-base:v1";
    private static final String BASE_DIGEST = "sha256:abc";

    @Mock
    private RunRepository repository;
    @Mock
    private RunIdGenerator idGenerator;
    @Mock
    private AirflowClient airflow;
    @Mock
    private EnvironmentService environments;
    @Mock
    private BaseImageResolver baseImageResolver;

    private RunService service;

    private static EnvironmentBuild readyEnvironment() {
        EnvironmentBuild build = EnvironmentBuild.pending(
                "key", BASE_IMAGE, BASE_DIGEST, "", "", "r1", NOW);
        build.markReady("prizm/env:key", NOW);
        return build;
    }

    @BeforeEach
    void setUp() {
        // create()가 항상 거치는 경로. 개별 테스트에서 다시 스텁하면 그쪽이 이긴다.
        lenient().when(baseImageResolver.digest(BASE_IMAGE)).thenReturn(BASE_DIGEST);
        lenient().when(environments.ensure(BASE_IMAGE, BASE_DIGEST, "")).thenReturn(readyEnvironment());

        service = new RunService(repository, idGenerator, new CodeAssetCatalog(TestFixtures.properties(null)),
                airflow, JsonMapper.builder().build(), Clock.fixed(NOW, ZoneOffset.UTC),
                environments, baseImageResolver);
    }
```

그리고 다음 두 테스트를 추가한다:

```java
    @Test
    void putsReadyEnvironmentImageIntoDagConf() {
        when(idGenerator.nextId()).thenReturn("RUN-27100");

        service.create(request("v2.4.1"));

        ArgumentCaptor<Map<String, Object>> conf = ArgumentCaptor.forClass(Map.class);
        verify(airflow).triggerDagRun(any(), conf.capture());
        assertThat(conf.getValue()).containsEntry("env_image_ref", "prizm/env:key");
    }

    @Test
    void refusesToRunWhileEnvironmentIsStillBuilding() {
        when(idGenerator.nextId()).thenReturn("RUN-27101");
        EnvironmentBuild building = EnvironmentBuild.pending(
                "key", BASE_IMAGE, BASE_DIGEST, "pandas", "pandas", "r1", NOW);
        building.markBuilding(NOW);
        when(environments.ensure(BASE_IMAGE, BASE_DIGEST, "")).thenReturn(building);

        assertThatThrownBy(() -> service.create(request("v2.4.1")))
                .isInstanceOf(InvalidRunRequestException.class)
                .hasMessage("실행 환경이 아직 준비되지 않았습니다 (상태: BUILDING)");
        verifyNoInteractions(airflow);
    }
```

- [ ] **Step 6: 테스트가 실패하는지 확인**

Run: `./gradlew test --tests '*RunServiceTest'`
Expected: 컴파일 실패 — `RunService` 생성자에 `EnvironmentService`·`BaseImageResolver` 없음

- [ ] **Step 7: RunService 수정**

`src/main/java/com/prizm/backend/run/RunService.java`에서 (1) 생성자에 두 의존성을 추가하고, (2) `create` 안에서 환경을 확인한 뒤 conf에 이미지를 싣는다. import 세 줄(`com.prizm.backend.api.InvalidRunRequestException`, `com.prizm.backend.environment.BaseImageResolver`, `com.prizm.backend.environment.EnvironmentBuild`, `com.prizm.backend.environment.EnvironmentBuildStatus`, `com.prizm.backend.environment.EnvironmentService`)도 추가한다.

필드·생성자:

```java
    private final EnvironmentService environments;
    private final BaseImageResolver baseImageResolver;

    public RunService(RunRepository repository, RunIdGenerator idGenerator, CodeAssetCatalog catalog,
            AirflowClient airflow, JsonMapper mapper, Clock clock,
            EnvironmentService environments, BaseImageResolver baseImageResolver) {
        this.repository = repository;
        this.idGenerator = idGenerator;
        this.catalog = catalog;
        this.airflow = airflow;
        this.mapper = mapper;
        this.clock = clock;
        this.environments = environments;
        this.baseImageResolver = baseImageResolver;
    }
```

`create` 메서드에서 `Map<String, Object> conf = new LinkedHashMap<>();` 바로 앞에 환경 확인을 넣고, conf에 한 줄을 추가한다:

```java
        EnvironmentBuild environment = environments.ensure(
                asset.baseImage(), baseImageResolver.digest(asset.baseImage()), asset.requirements());
        if (environment.getStatus() != EnvironmentBuildStatus.READY) {
            throw new InvalidRunRequestException(
                    "실행 환경이 아직 준비되지 않았습니다 (상태: " + environment.getStatus() + ")");
        }

        Map<String, Object> conf = new LinkedHashMap<>();
        conf.put("code_key", asset.codeKey());
        conf.put("code_version", asset.codeVersion());
        conf.put("prizm_run_id", run.getId());
        conf.put("env_image_ref", environment.getImageRef());
        conf.put("extra_params", notebookParameters);
```

- [ ] **Step 8: 빌드 작업 디렉터리 생성**

`BaseImageResolver`와 `ImageBuilder`가 쓰는 디렉터리를 만든다.

```bash
mkdir -p ~/Workspace/notebook/prototype/env-builds
```

- [ ] **Step 9: 테스트 전체 실행**

Run: `./gradlew test`
Expected: 전부 PASS

- [ ] **Step 10: 커밋**

```bash
git add src/main/java/com/prizm/backend/ src/main/resources/application.yml src/test/java/com/prizm/backend/
git commit -m "feat: 코드 자산에 실행 환경을 연결

자산 설정에 base-image와 requirements를 추가하고, 실행 요청 시 해당 환경을
보장한 뒤 결과 이미지를 DAG conf의 env_image_ref로 넘긴다. 환경이 아직
READY가 아니면 실행을 거부한다 - 준비되지 않은 이미지로 DAG를 띄우면
컨테이너 기동 단계에서 더 모호하게 실패하기 때문이다.

베이스 이미지 식별에는 docker image inspect의 이미지 ID를 쓴다. 로컬 빌드
이미지에는 레지스트리 다이제스트가 없다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
### Task 9: DAG를 DockerOperator로 전환

**Files:**
- Create: `~/Workspace/notebook/prototype/.backup-2026-09-19/` (원본 백업)
- Create: `~/Workspace/notebook/prototype/.env`
- Modify: `~/Workspace/notebook/prototype/docker-compose.yml`
- Modify: `~/Workspace/notebook/prototype/airflow/dags/mlops_notebook_executor.py`

> **주의:** `prototype`은 git 저장소가 아니다. **Step 1의 백업을 건너뛰면 되돌릴 방법이 없다.**

**Interfaces:**
- Consumes: `prizm/runtime-base:v1` (Task 7), DAG conf의 `env_image_ref` (Task 8)
- Produces: `execute_notebook` 태스크가 자산의 파생 이미지 컨테이너에서 papermill을 실행한다. 출력 `executed.ipynb`는 기존과 같은 경로에 쓰이므로 백엔드의 SSE 스트리밍은 그대로 동작한다

**이 작업의 위험:** 오늘 검증된 실행 체인이 통째로 바뀐다. Step 5의 docker.sock 접근 검증이 실패하면 나머지는 전부 무의미하므로, 그 단계를 게이트로 삼는다.

- [ ] **Step 1: 원본 백업 (건너뛰지 말 것)**

```bash
cd ~/Workspace/notebook/prototype
mkdir -p .backup-2026-09-19
cp docker-compose.yml .backup-2026-09-19/docker-compose.yml
cp airflow/dags/mlops_notebook_executor.py .backup-2026-09-19/mlops_notebook_executor.py
ls -l .backup-2026-09-19/
```

Expected: 두 파일이 보인다. 이후 문제가 생기면 이 파일들을 되돌려 놓는다.

- [ ] **Step 2: .env 작성**

`~/Workspace/notebook/prototype/.env`:

```
# DockerOperator가 자식 컨테이너에 바인드할 호스트 절대경로.
# Airflow 컨테이너 내부 경로가 아니라 호스트 경로여야 한다 - 자식 컨테이너는
# 호스트 도커 데몬이 만들기 때문이다. 이 폴더를 옮기면 이 값도 바꿔야 한다.
HOST_PROJECT_DIR=/Users/yihaksun/Workspace/notebook/prototype
```

- [ ] **Step 3: docker-compose.yml 수정**

`airflow` 서비스의 `environment:` 블록 끝(`AIRFLOW__API__AUTH_BACKENDS` 다음)에 세 줄을 추가한다:

```yaml
      # DockerOperator가 자식 컨테이너를 띄울 때 쓰는 값들
      MLOPS_HOST_RUN_ROOT: ${HOST_PROJECT_DIR}/runs
      MLOPS_DOCKER_NETWORK: prototype_default
      MLOPS_BASE_IMAGE: prizm/runtime-base:v1
```

같은 서비스의 `volumes:` 블록에 한 줄을 추가한다:

```yaml
      # DockerOperator가 호스트 도커 데몬에 자식 컨테이너를 요청한다.
      # 프로토타입 한정 - 운영에서는 KubernetesPodOperator를 쓴다.
      - /var/run/docker.sock:/var/run/docker.sock
```

- [ ] **Step 4: 스택 재기동**

```bash
cd ~/Workspace/notebook/prototype
docker compose up -d airflow
docker compose ps airflow
```

Expected: airflow가 `Up` 상태다.

- [ ] **Step 5: docker.sock 접근 검증 (게이트)**

```bash
docker exec prototype-airflow-1 ls -l /var/run/docker.sock
docker exec prototype-airflow-1 python -c "import docker; print(docker.from_env().version()['Version'])"
```

Expected: 소켓이 보이고, 두 번째 명령이 도커 버전을 출력한다.

**실패하면(permission denied):** airflow는 uid 50000·gid 0으로 돌고 있으므로 소켓의 그룹 권한에 달려 있다. `docker-compose.yml`의 airflow 서비스에 `user: "50000:0"`을 명시하거나, 그래도 안 되면 `group_add: ["0"]`을 추가한다. 이것도 안 되면 Task 9를 중단하고 상황을 보고한다 — 소켓 접근 없이는 DockerOperator를 쓸 수 없다.

- [ ] **Step 6: download_notebook이 파라미터 파일을 쓰도록 수정**

`airflow/dags/mlops_notebook_executor.py`의 `download_notebook` 함수를 아래로 교체한다:

```python
def download_notebook(**context):
    conf = context["dag_run"].conf or {}
    code_key = conf["code_key"]
    code_version = conf.get("code_version", "latest")

    import mlops
    import yaml

    # PRIZM 백엔드가 트리거한 실행은 prizm_run_id 폴더를 쓴다 - 백엔드가 이 경로의
    # executed.ipynb를 읽어 화면에 실시간으로 보여준다. 없으면 기존 규칙(trigger.sh, 기존 포털).
    prizm_run_id = conf.get("prizm_run_id")
    run_folder = prizm_run_id or context["run_id"].replace(":", "_").replace("+", "_")
    run_dir = os.path.join(RUN_ROOT, run_folder)
    code_dir = os.path.join(run_dir, "code")
    output_dir = os.path.join(run_dir, "output")
    os.makedirs(output_dir, exist_ok=True)

    notebook_path = mlops.code.download(code_key, code_version, dest_dir=code_dir)

    # papermill 파라미터를 파일로 넘긴다. DockerOperator의 command를 Jinja 문자열로
    # 조립하는 것보다 안전하다 - 값에 공백이나 따옴표가 있어도 깨지지 않는다.
    extra_params = conf.get("extra_params") or {}
    base_params = {
        "output_dir": output_dir,
        "mlflow_tracking_uri": MLFLOW_TRACKING_URI,
    }
    if prizm_run_id:
        base_params["prizm_run_id"] = prizm_run_id
    # base_params가 항상 우선한다 - output_dir/mlflow_tracking_uri는 사용자가
    # 실행 시점에 바꿀 수 없는 계약이다.
    parameters = {**extra_params, **base_params}
    if extra_params:
        print(f"[download] 사용자 지정 파라미터 오버라이드: {extra_params}")

    params_path = os.path.join(run_dir, "params.yaml")
    with open(params_path, "w", encoding="utf-8") as handle:
        yaml.safe_dump(parameters, handle, allow_unicode=True)

    ti = context["ti"]
    ti.xcom_push(key="notebook_path", value=notebook_path)
    ti.xcom_push(key="run_dir", value=run_dir)
    ti.xcom_push(key="params_path", value=params_path)
    ti.xcom_push(key="executed_path", value=os.path.join(run_dir, "executed.ipynb"))
    return notebook_path
```

- [ ] **Step 7: execute_notebook 함수를 제거하고 DockerOperator로 교체**

같은 파일에서 `execute_notebook` 함수 정의 전체를 삭제하고, 파일 상단의 import와 상수에 다음을 추가한다:

```python
from airflow.providers.docker.operators.docker import DockerOperator
from docker.types import Mount
```

```python
# DockerOperator가 자식 컨테이너를 띄울 때 쓰는 값. 호스트 경로여야 한다 -
# 자식 컨테이너를 만드는 것은 Airflow 컨테이너가 아니라 호스트 도커 데몬이다.
HOST_RUN_ROOT = os.environ.get("MLOPS_HOST_RUN_ROOT", "")
DOCKER_NETWORK = os.environ.get("MLOPS_DOCKER_NETWORK", "prototype_default")
FALLBACK_IMAGE = os.environ.get("MLOPS_BASE_IMAGE", "prizm/runtime-base:v1")
```

DAG 본문의 `t3 = PythonOperator(...)` 줄을 아래로 교체한다:

```python
    # 노트북은 Airflow 워커가 아니라 자산의 파생 이미지 안에서 실행된다.
    # papermill은 그 이미지의 도구 venv(/opt/prizm/tools)에 있고 PATH에 올라와 있다.
    t3 = DockerOperator(
        task_id="execute_notebook",
        image="{{ dag_run.conf.get('env_image_ref') or params.fallback_image }}",
        command=[
            "papermill",
            "{{ ti.xcom_pull(task_ids='download_notebook', key='notebook_path') }}",
            "{{ ti.xcom_pull(task_ids='download_notebook', key='executed_path') }}",
            "-f", "{{ ti.xcom_pull(task_ids='download_notebook', key='params_path') }}",
            # 셀 시작·완료마다 저장 + 긴 셀 실행 중에도 3초마다 저장.
            # 백엔드가 이 파일을 읽어 실시간 노트북 화면을 만든다.
            "--request-save-on-cell-execute",
            "--autosave-cell-every", "3",
            "--log-output",
            "-k", "python3",
        ],
        mounts=[Mount(source=HOST_RUN_ROOT, target=RUN_ROOT, type="bind")],
        mount_tmp_dir=False,
        network_mode=DOCKER_NETWORK,
        environment={
            "MLFLOW_TRACKING_URI": MLFLOW_TRACKING_URI,
            "MLFLOW_S3_ENDPOINT_URL": os.environ.get("MLFLOW_S3_ENDPOINT_URL", "http://minio:9000"),
            "AWS_ACCESS_KEY_ID": os.environ.get("AWS_ACCESS_KEY_ID", "minioadmin"),
            "AWS_SECRET_ACCESS_KEY": os.environ.get("AWS_SECRET_ACCESS_KEY", "minioadmin"),
            "AWS_DEFAULT_REGION": os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
            "MLOPS_AI_HUB_URL": AI_HUB_URL,
            "MLOPS_S3_ENDPOINT": os.environ.get("MLOPS_S3_ENDPOINT", "http://minio:9000"),
            "MLOPS_S3_ACCESS_KEY": os.environ.get("MLOPS_S3_ACCESS_KEY", "minioadmin"),
            "MLOPS_S3_SECRET_KEY": os.environ.get("MLOPS_S3_SECRET_KEY", "minioadmin"),
            "MLOPS_BUCKET": os.environ.get("MLOPS_BUCKET", "mlops-assets"),
        },
        auto_remove="success",
        docker_url="unix://var/run/docker.sock",
        api_version="auto",
    )
```

그리고 `with DAG(...)` 호출에 `params={"fallback_image": FALLBACK_IMAGE},`를 추가한다(`tags=[...]` 다음 줄).

- [ ] **Step 8: DAG가 파싱되는지 확인**

```bash
docker exec prototype-airflow-1 python -c "
from airflow.models import DagBag
bag = DagBag('/opt/airflow/dags', include_examples=False)
print('import errors:', bag.import_errors)
dag = bag.get_dag('mlops_notebook_executor')
print('tasks:', [t.task_id for t in dag.tasks])
print('execute_notebook type:', type(dag.get_task('execute_notebook')).__name__)
"
```

Expected: `import errors: {}`, 태스크 3개, `execute_notebook type: DockerOperator`

- [ ] **Step 9: 호스트 경로가 실제로 주입되었는지 확인**

```bash
docker exec prototype-airflow-1 printenv MLOPS_HOST_RUN_ROOT MLOPS_DOCKER_NETWORK
```

Expected: `/Users/yihaksun/Workspace/notebook/prototype/runs` 와 `prototype_default`. 첫 값이 비어 있으면 `.env`가 읽히지 않은 것이므로 `docker compose up -d airflow`를 다시 실행한다. 이 값이 비면 자식 컨테이너의 바인드 마운트가 조용히 빈 디렉터리가 되어, 노트북을 찾지 못하는 형태로 실패한다.

---

### Task 10: 종단 검증

**Files:** 없음 (검증 전용)

**Interfaces:**
- Consumes: Task 1~9 전부
- Produces: Phase 1 완료 판정

이 작업은 설계 문서 §5.3의 완료 기준을 그대로 확인한다. 세 가지가 전부 통과해야 Phase 1이 끝난다.

- [ ] **Step 1: 스택과 서비스 기동 확인**

```bash
cd ~/Workspace/notebook/prototype && docker compose ps
curl -s -o /dev/null -w 'backend: %{http_code}\n' localhost:8081/api/runs
curl -s -o /dev/null -w 'frontend: %{http_code}\n' localhost:3000
```

Expected: minio·ai-hub·mlflow·airflow가 Up, 백엔드와 프론트엔드가 200

- [ ] **Step 2: 환경 API가 베이스 이미지를 그대로 쓰는 경우를 처리하는지 확인**

```bash
DIGEST=$(docker image inspect -f '{{.Id}}' prizm/runtime-base:v1)
curl -s -X POST localhost:8081/api/environments \
  -H 'Content-Type: application/json' \
  -d "{\"baseImage\":\"prizm/runtime-base:v1\",\"baseImageDigest\":\"$DIGEST\",\"requirements\":\"\"}"
```

Expected: `{"cacheKey":"...","status":"READY","imageRef":"prizm/runtime-base:v1"}` — requirements가 비면 빌드 없이 즉시 READY

- [ ] **Step 3: 실제 패키지 설치가 일어나는 환경을 빌드**

```bash
DIGEST=$(docker image inspect -f '{{.Id}}' prizm/runtime-base:v1)
KEY=$(curl -s -X POST localhost:8081/api/environments \
  -H 'Content-Type: application/json' \
  -d "{\"baseImage\":\"prizm/runtime-base:v1\",\"baseImageDigest\":\"$DIGEST\",\"requirements\":\"tabulate==0.9.0\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["cacheKey"])')
echo "cacheKey=$KEY"
for i in $(seq 1 60); do
  STATUS=$(curl -s localhost:8081/api/environments/$KEY | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')
  echo "$i: $STATUS"
  if [ "$STATUS" = "READY" ] || [ "$STATUS" = "FAILED" ]; then break; fi
  sleep 3
done
curl -s localhost:8081/api/environments/$KEY
docker run --rm prizm/env:$KEY python -c "import tabulate; print('derived image ok', tabulate.__version__)"
```

Expected: 상태가 READY로 끝나고, 파생 이미지에서 `derived image ok 0.9.0`이 출력된다

- [ ] **Step 4: 같은 requirements를 순서만 바꿔 요청하면 같은 키가 나오는지 확인**

```bash
DIGEST=$(docker image inspect -f '{{.Id}}' prizm/runtime-base:v1)
for REQ in "tabulate==0.9.0\nsix" "six\ntabulate==0.9.0"; do
  curl -s -X POST localhost:8081/api/environments -H 'Content-Type: application/json' \
    -d "{\"baseImage\":\"prizm/runtime-base:v1\",\"baseImageDigest\":\"$DIGEST\",\"requirements\":\"$REQ\"}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["cacheKey"])'
done
```

Expected: 두 줄의 캐시 키가 같다. 두 번째 요청은 빌드를 새로 돌리지 않는다

- [ ] **Step 5: 빌드 실패가 사용자에게 읽히는 형태로 전달되는지 확인**

```bash
DIGEST=$(docker image inspect -f '{{.Id}}' prizm/runtime-base:v1)
KEY=$(curl -s -X POST localhost:8081/api/environments -H 'Content-Type: application/json' \
  -d "{\"baseImage\":\"prizm/runtime-base:v1\",\"baseImageDigest\":\"$DIGEST\",\"requirements\":\"prizm-no-such-package-xyz\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["cacheKey"])')
for i in $(seq 1 40); do
  sleep 3
  BODY=$(curl -s localhost:8081/api/environments/$KEY)
  echo "$BODY" | grep -q FAILED && { echo "$BODY"; break; }
done
```

Expected: `status`가 `FAILED`이고 `errorSummary`에 해당 패키지를 찾을 수 없다는 내용이 담긴다

- [ ] **Step 6: 지원하지 않는 지시자가 400으로 거부되는지 확인**

```bash
DIGEST=$(docker image inspect -f '{{.Id}}' prizm/runtime-base:v1)
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8081/api/environments \
  -H 'Content-Type: application/json' \
  -d "{\"baseImage\":\"prizm/runtime-base:v1\",\"baseImageDigest\":\"$DIGEST\",\"requirements\":\"--index-url https://evil.example.com/simple\"}"
```

Expected: `400`

- [ ] **Step 7: 성공 실행이 파생 이미지 경유로 재현되는지 확인 (RUN-27006 동등)**

브라우저에서 `http://localhost:3000/assets/code?asset=PRJ000212-C-0001` 을 열고 "이 버전으로 실행" → `epochs`를 `2`로 바꿔 "즉시 실행".

Expected:
- 실행 상세 화면으로 이동하고 진행률이 올라간다
- "실시간 Notebook"에 셀 본문과 출력이 보인다 (executed.ipynb 스트리밍이 살아 있다는 뜻)
- `injected-parameters` 셀에 `epochs = 2`가 보인다
- `epoch 1/2 ...` 줄이 실시간으로 추가된다
- 완료 후 결과 스트립에 mAP50과 등록된 모델 버전이 보인다

동시에 자식 컨테이너가 실제로 떠 있는지 확인한다:

```bash
docker ps --filter ancestor=prizm/runtime-base:v1 --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
docker exec prototype-airflow-1 python -c "import papermill" 2>&1 | tail -1
```

Expected: 실행 중에 자식 컨테이너가 보인다. 두 번째 명령은 여전히 `ModuleNotFoundError`여도 무방하다 — 오히려 Airflow 워커가 더 이상 papermill을 직접 쓰지 않는다는 증거다

- [ ] **Step 8: 실패 실행이 재현되는지 확인 (RUN-27007 동등)**

같은 화면에서 `epochs`를 `0`으로 바꿔 "즉시 실행".

Expected: "실행 실패" 표시, "모델 학습" 단계에 경고, 해당 셀에 `ValueError: epochs는 1 이상이어야 합니다` traceback

- [ ] **Step 9: 사용자 requirements가 실제로 실행에 반영되는지 확인**

`prizm-backend`의 `application.yml`에서 해당 자산의 `requirements`를 `tabulate==0.9.0`으로 바꾸고 백엔드를 재시작한 뒤, 노트북 첫 셀에 `import tabulate`를 추가해 다시 실행한다. (노트북 수정은 `prototype/notebooks/`에서 하고 `docker compose --profile seed run --rm seed`로 다시 시딩한다.)

Expected: 환경이 새 캐시 키로 빌드되고, 실행이 성공하며, `import tabulate`가 에러 없이 지나간다. 이것이 "사용자가 지정한 패키지가 실제 실행 환경에 들어간다"는 Phase 1의 최종 증거다

- [ ] **Step 10: 결과 기록**

확인한 내용을 한 곳에 적는다: 성공/실패 실행의 RUN ID, 파생 이미지 캐시 키, 베이스 이미지 패키지 수(Task 7 Step 8), 자식 컨테이너가 실제로 떴는지. 어느 하나라도 통과하지 못했으면 Phase 1은 완료가 아니다.

---

## 이 계획에서 다루지 않는 것

- **레지스트리 push.** 파생 이미지는 로컬 도커 데몬에만 `docker build -t`로 만든다. Airflow와 백엔드가 같은 데몬을 쓰는 프로토타입에서는 push가 필요 없다. 여러 노드로 가면 레지스트리가 필요하다
- 편집 세션과 JupyterLab (Phase 2 — 별도 spec과 계획서)
- 코드 자산 영속화와 등록 화면 requirements 입력 (설계 문서 §4.7 — 별도 선행 과제)
- 파생 이미지 GC, 사내 미러 실제 연결, GPU 스케줄링
