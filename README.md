# FocusCurve (개인용)

복용 기록과 예상 메틸페니데이트·카페인 수준을 보여 주는 웹앱. 재서명 없이 쓰려고
네이티브 앱 대신 **Vercel 웹앱 + Scriptable 위젯 + iOS 단축어** 조합으로 만들었다.

> 추정치일 뿐이며 실제 수준은 사람마다 다르다. 의료기기가 아니다. 복용 시간·용량은 의사와 상의.

## 구성

| 부분 | 위치 | 하는 일 |
|---|---|---|
| 웹앱 (Next.js) | `app/` | 대시보드 차트, 기록, 내역, PVT, 설정·보정 |
| API | `app/api/` | 단축어·위젯이 쓰는 기록/조회 (Bearer 토큰) |
| 약동학 계산 | `lib/pk-core.js` | 베이트만 식, OROS 방출, 곡선 중첩, 상태 요약 |
| 개인 보정 | `lib/calibrate.ts` | PVT·효과 탭·잠든 시각으로 기준선 보정 |
| 위젯 | `scriptable/FocusWidget.js` | Scriptable 앱에 붙여 넣는 위젯 (자동 생성) |
| 단축어 설정법 | `docs/shortcuts.md` | 복용 버튼, 수면 입력, PVT 알림 |

## 배포 (처음 한 번)

1. [vercel.com](https://vercel.com) → Add New → Project → `psyount/ADHD-calc` 선택 → Deploy.
2. 프로젝트 → **Storage** → Upstash (Redis) 만들기 → 이 프로젝트에 Connect.
   `KV_REST_API_URL`, `KV_REST_API_TOKEN` 환경변수가 자동으로 들어간다.
3. 프로젝트 → Settings → **Environment Variables**에 추가:
   - `APP_PIN` : 웹 로그인 PIN (예: 6자리 숫자)
   - `API_TOKEN` : 위젯·단축어용 긴 무작위 문자열.
     맥 터미널에서 `openssl rand -hex 24` 로 만들면 된다.
4. Deployments → 최신 배포 ⋯ → **Redeploy** (환경변수 반영).
5. 아이폰 Safari로 주소 열기 → PIN 입력 → 공유 → **홈 화면에 추가**.

그다음 위젯은 [docs/scriptable.md](docs/scriptable.md), 단축어는 [docs/shortcuts.md](docs/shortcuts.md).

## 모델 요약

- 1구획 베이트만 식 `C(t) = F·D·ka / (Vd·(ka−ke)) · (e^(−ke·t) − e^(−ka·t))`, `ke = ln2 / t½`
- d-MPH: F 0.22, t½ 3.0h, Vd 2.65 L/kg, ka 1.5/h. 콘서타는 라세미체라 용량 절반만 계산.
- 콘서타 OROS: 22% 즉시 + 78%를 방출 시간(기본 7h) 동안 균등 방출 (닫힌 식으로 계산).
- 카페인: F 0.99, t½ 5.0h, Vd 0.7 L/kg, ka 4.0/h, 음식과 함께면 ka×0.8.
- 메틸페니데이트는 앞뒤 15시간 안 최고치 대비 %로 표시. 카페인은 ng/mL 그대로,
  수면 기준선(기본 1000 ng/mL) 아래로 내려가는 시각을 계산.
- 하루 카페인 권고량: 체중 × 2.5mg (식약처 청소년 기준).
- 수치 출처: FocusCurve 앱의 모델 소개 화면에 정리된 값 (FDA 라벨, NCBI NBK223808 등 인용).

## 개인 보정

고정 수치 대신 세 값을 내 기록으로 맞춰 간다.

| 값 | 기본 | 무엇으로 보정 |
|---|---|---|
| 효과 기준선 | 50% | PVT가 평소보다 5% 이상 빠른 구간의 처음·끝, 효과 시작/끝 탭 |
| 카페인 수면선 | 1000 ng/mL | 실제로 잠든 시각의 카페인 농도 |
| 콘서타 방출 시간 | 7시간 | 설정에서 직접 조정 |

- PVT 평소 기준 = 약 수준 20% 미만일 때 잰 반응시간 중앙값 (3번 미만이면 전체 중앙값)
- 하루에 PVT 3번 이상 한 날만 PVT 추정에 씀
- 하루치 값들의 중앙값을 `(기본값×5 + 내 값×일수) ÷ (5 + 일수)`로 기본값 쪽에 당겨서 적용
- 설정에서 끄면 바로 기본값

## 개발

```bash
npm install
npm run dev        # 환경변수 없으면 로그인 없이 메모리 저장소로 동작
npm test           # 계산·보정·위젯 일치 테스트
npm run widget     # lib/pk-core.js 를 넣어 scriptable/FocusWidget.js 다시 생성
```

`lib/pk-core.js`나 `scriptable/template.js`를 고치면 `npm run widget`을 돌려야 한다.
(`npm run build`도 자동으로 돌린다. 테스트가 위젯 파일이 최신인지 확인한다.)

약을 추가하려면 `lib/drugs.ts`의 `DRUGS`, `PRESETS`에 넣는다. 새 계산 방식이 필요하면
`lib/pk-core.js`의 `levelAt`에 kind를 추가한다.

## API

모든 요청에 `Authorization: Bearer <API_TOKEN>` (웹은 로그인 쿠키).
시각은 ms 숫자, ISO 문자열, `2026-11-28 01:20`(한국 시간) 모두 된다. 없으면 지금.

| 메서드 | 경로 | 본문 |
|---|---|---|
| POST | `/api/dose` | `{ "drug": "concerta" \| "caffeine", "mg": 18, "time"?, "withFood"? }` |
| PATCH/DELETE | `/api/dose` | `{ id, time?, mg?, withFood? }` / `?id=` |
| POST | `/api/effect` | `{ "type": "start" \| "end", "time"? }` |
| POST | `/api/pvt` | `{ medianMs, lapses, n }` |
| POST | `/api/sleep` | `{ "sleepStart": "..." }` (같은 밤은 덮어씀) |
| POST | `/api/day` | `{ date?, condition? (1~5), memo? }` |
| GET/POST | `/api/settings` | `{ weightKg, bedtime, releaseH, useCalibration }` |
| GET | `/api/state` | 전체 데이터 + 보정 결과 |
| GET | `/api/widget` | 위젯용 (최근 48시간 기록, 매개변수) |
