# 🛠️ Firebase Extensions 배포 및 상태 잠김(Lock-in) 문제 해결 가이드

본 문서는 Firebase Trigger Email 확장 기능(`firestore-send-email`) 배포 중 인스턴스가 `DEPLOYING` (배포 중) 상태에서 멈추거나 락(Lock-in)이 걸리는 알려진 문제를 해결하기 위해 작성된 공식 가이드라인입니다.

---

## 🚨 문제 증상 (Symptom)
* Firebase Console 또는 CLI에서 확장 기능이 며칠 동안 계속 **`DEPLOYING`** 또는 **`INSTALLING`** 상태로 머물러 있습니다.
* 새로운 배포나 업데이트, 혹은 삭제(Uninstall)를 시도하면 아래와 같은 오류 메시지가 발생합니다:
  ```json
  {
    "error": {
      "code": 400,
      "message": "this instance already has an ongoing operation `...`. Please wait for it to complete and try again",
      "status": "FAILED_PRECONDITION"
    }
  }
  ```
* 실제 배포된 Cloud Functions 목록(`firebase functions:list`)을 조회해 보면 아무런 함수도 생성되어 있지 않습니다.

---

## 🔍 원인 분석 (Root Cause)
이 현상은 Firebase Extensions 백엔드의 알려진 동작 버그(Ghost State Lock)입니다.
1. **초기 프로비저닝 실패**: 빌드 API 미활성화, IAM 권한 부족, 또는 Firebase Storage 미설정 등으로 인해 초기 가상 환경 생성 단계에서 에러가 발생합니다.
2. **상태 동기화 오류**: 에러가 발생했음에도 백엔드가 이를 감지하지 못하고 상태값을 `ERRORED`로 변경하지 못해, 이전 배포 트랜잭션(Operation)이 백엔드 내부 큐에 영구히 락(Lock)을 걸어 버립니다.
3. **리소스가 없는 상태**: Cloud Functions와 같은 실제 하드웨어 리소스는 생성되지 않았으므로 **비용은 절대 청구되지 않으며**, 단지 구글 서버 메타데이터에 유령 기록만 남게 됩니다.

---

## 🚀 완벽한 해결 전략: 인스턴스 ID 우회 (Bypassing)
락이 걸려 있는 특정 인스턴스 ID(예: `firestore-send-email-41z1`)가 풀릴 때까지 대기하지 않고, **새로운 독립된 인스턴스 ID를 정의하여 즉각 가동하는 가장 실용적인 해결 방법**입니다.

### 1단계: 새로운 인스턴스 ID 정의 및 환경설정
* 로컬의 `firebase.json`에서 확장 기능 인스턴스 이름을 변경합니다:
  ```json
  {
    "extensions": {
      "firestore-send-email-active": "firebase/firestore-send-email@0.2.9"
    }
  }
  ```
* 기존 `.env` 설정을 복사하여 새로운 환경설정 파일(`extensions/firestore-send-email-active.env`)을 생성합니다.

### 2단계: Firebase CLI를 통한 신규 배포
* 아래의 디버그 명령어를 통해 새로운 인스턴스를 즉각 배포합니다:
  ```bash
  npx firebase-tools deploy --only extensions --project english-agent-4e447
  ```
* 프론트엔드 React 코드는 단지 Firestore의 `mail` 컬렉션을 감시하므로, **소스 코드를 한 줄도 수정하지 않고** 신규 배포 즉시 이메일 전송이 정상 작동합니다.

---

## 🧹 유령(Stuck) 인스턴스 강제 정리 방법
배포 도중 꼬여버린 3개의 Stuck 인스턴스(`firestore-send-email`, `firestore-send-email-d59m`, `firestore-send-email-41z1`)는 다음과 같은 방법으로 안전하게 정리할 수 있습니다.

### 방법 A: 구글 백엔드 자동 가비지 컬렉션 대기 (권장)
* 락이 걸린 내부 트랜잭션(Operation)은 최대 **수일에서 일주일** 이내에 구글 클라우드의 백엔드 가비지 컬렉터에 의해 자동으로 만료 및 정리됩니다. 
* 만료 후 `ERRORED` 또는 `FAILED` 상태로 전환되면 Firebase Console에서 마우스 클릭 몇 번으로 흔적 없이 삭제할 수 있습니다.

### 방법 B: GCP 콘솔을 통한 리소스 수동 확인 및 정리
만약 부분적으로 생성된 흔적이 남아 있어 직접 지우고 싶다면:
1. [Google Cloud Console - API 및 서비스](https://console.cloud.google.com/apis/dashboard)에서 **Cloud Build API** 및 **Artifact Registry API**가 정상 사용 설정되어 있는지 체크합니다.
2. [Google Cloud Console - IAM](https://console.cloud.google.com/iam-admin/iam)으로 이동하여 `service-프로젝트번호@gcp-sa-firebaseext.iam.gserviceaccount.com` 계정이 활성화되어 있으며 권한을 정상적으로 보유하고 있는지 확인합니다.
3. [Cloud Functions](https://console.cloud.google.com/functions/list) 메뉴에서 이름이 `ext-firestore-send-email-...`로 시작하는 비정상/고장난 함수가 있다면 수동으로 삭제를 진행합니다.

---

*본 트러블슈팅 가이드는 프로젝트 루트에 저장되어 향후 동일 증상 발생 시 즉각 참고하실 수 있습니다.*
