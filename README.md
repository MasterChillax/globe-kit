# @masterchillax/globe-kit

기준 지구본(KINX MapLibre 지구본)을 **정책으로** 공유하는 순수 TypeScript 패키지. 렌더러 코드는 없다 — `maplibre-gl` 을 import 하지 않는다.
앱(KINX·Jarvis 웹 지구본, corea 모바일 스타일)은 여기서 나온 소스·레이어·표기·`dropped[]` 를 그대로 붙인다.
결정 기록: https://github.com/MasterChillax/kinx-monitor-dashboard/issues/66 (2026-09-17, A 접목판).

## 무엇을 보장하나

| 보장 | 어떻게 |
|---|---|
| 키 없는 소스는 배포되지 않는다 | `resolveStack()` 이 `keyRequired` 공급자를 키가 없으면 `dropped:[{id, reason:'missing-key'}]` 로 뺀다 |
| 라이선스 범위 밖 소스는 배포되지 않는다 | `license.usage/exposure/platforms` 와 앱 프로필(usage·exposure·platform)을 대조, 영리 동의(`consentId`)는 서면 기록이 있어야 통과 |
| 금지 호스트는 어디에도 못 들어간다 | `registry.denied`(무키 Esri·CARTO·구 GIBS 호스트·EOX NC·Google Map Tiles) — 리졸버는 절대 방출하지 않고 `validateStyleMin()` 이 어떤 스타일에서든 잡는다. 스타일 URL 오버라이드도 금지 호스트면 throw |
| 표기(attribution)가 빠지지 않는다 | 레지스트리 항목마다 필수, 리졸버가 `attribution[]` 로 모으고 `buildNotices()` 가 THIRD_PARTY_NOTICES 를 생성 |
| 라벨이 영상 밑에 깔리지 않는다 | `firstSymbolLayerId()` / `insertUnderLabels()` — 벡터 스타일의 **첫** symbol 레이어 앞에 래스터를 끼운다 |
| 한국 제약 | native(폰) 프로필은 `projection/sky/terrain` 을 방출하지 않고 등고선·표고 레이어를 금지(별표1). V-World 는 표출 전용·`cacheable:false`·영리는 동의 필요 |
| 게이트가 실제로 실패할 수 있다 | `pnpm selftest` — 위반을 주입한 스타일이 빨강이어야 통과. "0건" 은 "안 돌았음" 과 구별돼야 한다 |

## 사용

```ts
import { loadRegistry, resolveStack, insertUnderLabels, validateStyleMin, buildNotices } from '@masterchillax/globe-kit';

const registry = loadRegistry();
const stack = resolveStack(registry, {
  app: 'jarvis', usage: 'personal', exposure: 'private', platform: 'web',
  keys: (name) => process.env[`NEXT_PUBLIC_${name}`],   // ARCGIS_API_KEY, VWORLD_KEY
  consents: [],                                           // 예: ['vworld-commercial'] (서면 있을 때만)
});
// map = new maplibregl.Map({ style: stack.styleUrl, ... })
// map.on('load', () => { for (const [id, s] of Object.entries(stack.sources)) map.addSource(id, s);
//   const anchor = firstSymbolLayerId(map.getStyle().layers); for (const l of stack.layers) map.addLayer(l, anchor ?? undefined);
//   if (stack.terrain) map.setTerrain(stack.terrain); });
// stack.dropped → 화면 진단 패널에 그대로 (왜 위성이 없는지 사용자가 본다)
```

CI 게이트(앱 쪽): 앱의 실제 프로필로 `resolveStack` 결과 스냅샷을 픽스처와 대조하고, 최종 스타일에 `validateStyleMin(style, registry, { platform, app, today })` 이 0건인지, 그리고 위반을 주입한 사본이 **빨강**인지 둘 다 검사한다.

## 레지스트리 `registry/providers.json`

공급자 7: `openfreemap-dark`(벡터 기본) · `gibs-bluemarble`(z≤8 오버뷰) · `gibs-black-marble`(야간) · `arcgis-world-imagery`(키) · `vworld-satellite`/`vworld-hybrid`(한국, 키+동의) · `terrarium-dem`(웹 지형). 각 항목은 라이선스 원문 URL·검증일·usage/exposure/platforms·캐시 가능 여부·키 이름을 갖는다.
`denied[]` 는 금지 호스트, `waivers[]` 는 앱별 한시 예외(만료일·이슈 필수 — RainViewer·TeleGeography 는 KINX 한정 2026-11-15 까지).

키 값은 이 저장소 어디에도 없다. 앱이 `keys()` 로 넘긴다. 공개 저장소(MIT)라 CI 토큰이 필요 없다.

## 개발

```
pnpm install
pnpm test        # vitest — 음성 대조 포함
pnpm typecheck
pnpm selftest    # 게이트가 실패할 수 있음을 증명
```

배포는 git 태그(`v0.1.0`)로 고정 의존: `"@masterchillax/globe-kit": "github:MasterChillax/globe-kit#v0.1.0"` + Next `transpilePackages`.
