# NOX Market

[웹사이트 열기](https://channnndol.github.io/nox-market/) · [연결 안내](https://channnndol.github.io/nox-market/setup.html)

다크 테마의 개인용 시장 워크스페이스. GitHub Pages에 배포하는 웹 화면과 Windows PC에서 실행하는 텔레그램 알림 프로그램입니다.

## 현재 지원 범위

| 기능 | v0.1 |
| --- | --- |
| 업비트 원화 현물 | 공개 캔들 + 실시간 체결 WebSocket |
| 바이낸스 USDT 현물 / USDT 무기한 선물 | 공개 캔들 + 실시간 캔들 WebSocket |
| 바이빗 USDT 현물 / USDT 무기한 선물 | 공개 캔들 + 실시간 캔들 WebSocket |
| 차트 도구 | 수평선, 추세선, 사각형, 메모, 색상 변경, 삭제, 실행 취소/다시 실행 |
| 지표 | 거래량, 단순이동평균 20/60 |
| 캡처 | 선 포함 PNG, 이미지 복사, 지원 기기의 파일 공유 메뉴 |
| 동기화 | 무료 Supabase 연결 후 동일 계정의 관심종목/선/알림을 약 15초 간격으로 동기화 |
| 알림 | PC 감시 프로그램이 약 15초 간격으로 체결가를 조회. 목표 이상/이하, 상향/하향 돌파, 추세선 기준. 1회 발생 후 비활성화 |
| 알림 이미지 | 최근 100봉과 저장된 드로잉을 PC에서 별도 렌더링해 텔레그램 첨부 |
| 한국/미국 주식·지수 | **외부 TradingView 위젯 보기만 제공.** 종목/거래소에 따라 표시 제한 또는 지연. 직접 데이터 연동과 NOX 드로잉 저장·캡처·알림 미지원 |
| USD/KRW | Frankfurter의 **일별 기준환율**. 실시간/분봉/환율 알림 미지원 |

한국 주식 전체의 무료 실시간 직접 연결은 확보되지 않았습니다. KRX 종목이 외부 위젯에서 표시되지 않을 수 있습니다. 한국 주식·미국 주식·지수·환율에 코인과 같은 기능을 제공하는 완성품이 아니라, 직접 연결된 코인 기능을 중심으로 한 첫 버전입니다.

바이낸스·바이빗의 코인 증거금/만기 선물/옵션은 이 버전에 포함하지 않습니다. 마크 가격·지수 가격·펀딩 비율은 별도 표시하며 알림 판단은 **체결가**만 사용합니다.

## 실행

Node.js 22 이상과 pnpm 11이 필요합니다.

```sh
pnpm install
pnpm dev
```

표시되는 localhost 주소로 접속합니다. `pnpm test`, `pnpm build`로 검사/배포 파일을 생성합니다.

## 무료 기기 동기화 설정

1. Supabase에서 **무료 프로젝트**를 직접 만듭니다. 이 프로그램은 유료 요금제로 전환하지 않습니다.
2. SQL Editor에서 `supabase/setup.sql` 전체를 실행합니다. 새 프로젝트에서 실행하세요.
3. Authentication → URL Configuration에서 배포 사이트 주소를 Site URL 및 Redirect URL에 등록합니다. 로컬 개발에는 `http://localhost:4173`, `http://127.0.0.1:4173`도 등록합니다.
4. 웹 화면의 `설정 · 동기화`에 프로젝트 URL과 **publishable 또는 anon 키**를 저장합니다. `service_role`이나 secret 키를 넣지 않습니다.
5. 계정을 만들고 이메일을 확인한 뒤 로그인합니다. 다른 기기도 같은 프로젝트와 같은 계정으로 로그인합니다.
6. 동시에 수정된 항목은 자동 덮어쓰기하지 않습니다. 설정 화면에서 이 기기/서버 변경 중 하나를 선택합니다.

무료 요금제에도 저장 공간·전송량·인증 메일 제한이 있고 비활성 프로젝트가 일시 중지될 수 있습니다. 등록된 계정만 자신의 행을 읽을 수 있는 RLS 정책을 적용합니다. `.env`에 사이트 기본 프로젝트 설정을 넣거나 GitHub Actions repository variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 넣어 빌드하면 방문자가 프로젝트를 직접 입력하지 않아도 됩니다.

동기화 전에는 브라우저별 로컬 저장입니다. 로그인해도 동기화 오류가 표시되면 아직 서버 저장이 완료되지 않은 상태입니다. 로그아웃 전에 대기 중 변경 사항을 백업하세요. 백업 JSON에는 개인 차트 설정이 포함되므로 공개 저장소에 올리지 않습니다.

## PC 텔레그램 알림 설정

1. 텔레그램의 공식 `@BotFather`에서 개인 봇을 만들고 봇과의 대화에서 `/start`를 보냅니다.
2. 자신의 봇 토큰과 수신할 chat ID를 준비합니다. 브라우저 주소창이나 이슈에 토큰을 붙이지 마세요. Bot API `getUpdates`는 **본인 PC에서만** 호출해 chat ID를 확인합니다.
3. `.env.example`을 `.env`로 복사하고 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NOX_EMAIL`, `NOX_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`를 본인 PC에서 입력합니다. NOX 웹사이트에서 가입한 **일반 사용자 계정**을 사용합니다. `service_role`은 사용하지 않습니다.
4. `start-alerts.cmd` 또는 `pnpm agent`를 실행합니다. 창이 떠 있어야 합니다. 화면을 잠가도 프로세스는 계속 실행되지만 절전·최대 절전·전원 꺼짐·인터넷 단절 중에는 감시하지 못합니다.
5. 웹사이트 알림 탭에서 `PC 감시 프로그램 연결됨`을 확인하고 알림을 추가합니다. 텔레그램의 휴대폰 알림도 허용되어 있어야 합니다.
6. PC 자동 시작 등록이나 절전 설정 변경은 사용자가 원하는 PC에서 직접 설정합니다. 설치 과정은 Windows 설정을 바꾸지 않습니다.

`.env`에는 인증 정보가 들어 있습니다. 개인 PC의 접근 제한된 폴더에서 관리하고 공유·업로드하지 않습니다. Git에서 제외되어 있습니다. 별도 클라우드 서버 비용은 없지만 PC 전기·인터넷 비용은 있습니다.

**알림의 한계:** 15초 조회 사이에 발생했다 사라지는 돌파는 놓칠 수 있습니다. 네트워크 및 텔레그램에 따라 도착이 지연될 수 있습니다. 앱에서 `대기`는 조건이 켜졌다는 뜻이며 PC가 연결되어 있음을 뜻하지 않습니다. PC 연결 상태를 함께 확인하세요.

알림 발생 시 DB 트랜잭션으로 해당 조건을 선점하여 여러 PC의 중복 전송을 방지합니다. 전송 의도를 PC에 저장하고 전송합니다. 타임아웃·재시작 등으로 결과가 불명확한 전송은 **자동 재전송하지 않으며**, `전송 결과 확인 필요`로 표시됩니다. 텔레그램에서 확인 후 필요한 경우 알림을 다시 켭니다. 클라우드 갱신이나 PC 프로그램이 실패하면 알림은 중단될 수 있습니다.

## GitHub Pages

이 폴더만 독립 저장소로 공개합니다. 상위 작업 폴더의 다른 프로젝트는 포함하지 않습니다. 저장소 Settings → Pages → Source를 `GitHub Actions`로 설정하면 `.github/workflows/pages.yml`이 테스트·빌드·배포합니다. `.env`, `.agent`, 로컬 백업은 업로드하지 않습니다.

## 검증 상태

- Node 단위 테스트: 가격 조건/추세선 계산/데이터 정규화/동기화 충돌/PNG 생성.
- 업비트·바이낸스 현물/무기한·바이빗 현물/무기한 REST 캔들 및 브라우저 Origin에 대한 CORS 응답 확인.
- Frankfurter 실제 일별 환율 응답 확인.
- 업비트·바이낸스 현물/무기한·바이빗 현물/무기한 WebSocket 이벤트를 Node 환경에서 실제 수신 확인.
- 로컬 PostgreSQL 호환 런타임에서 다른 계정의 행 접근 차단, 익명 접근 차단, 중복 알림 선점 및 기록 트랜잭션 검증.
- 이 작업 환경의 로컬 브라우저 제어가 비활성화되어 있어 브라우저 조작·레이아웃·모바일 실기기 검증은 미완료.
- 실제 Supabase 프로젝트와 텔레그램 봇 연결 전이므로 실계정 권한 분리·기기 동기화·알림 수신은 미검증. DB 정책 배포 후 서로 다른 계정 두 개로 상대방 데이터가 조회되지 않는지 확인해야 합니다.

## 출처와 라이선스

- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts): Apache 2.0. 원저작권/NOTICE 및 차트 링크·로고 표시 유지.
- [TradingView 위젯의 시세 제한](https://www.tradingview.com/widget-docs/faq/data/): 위젯에서 데이터를 추출하지 않습니다.
- [Upbit 요청 제한](https://docs.upbit.com/kr/reference/rate-limits): 브라우저 REST 요청은 최소 10.1초 간격으로 직렬화합니다.
- [Binance market data](https://developers.binance.com/en/docs/products/spot/faqs/market_data_only), [Bybit API](https://bybit-exchange.github.io/docs/v5/market/kline), [Frankfurter](https://frankfurter.dev/).
- [Supabase 무료 요금제](https://supabase.com/pricing), [Telegram Bot API](https://core.telegram.org/bots/api).

이 저장소의 자체 작성 코드는 MIT 라이선스입니다. 시세 제공처의 데이터 이용 조건과 의존성 라이선스는 각각 적용됩니다.
