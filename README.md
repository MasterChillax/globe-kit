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

루트 엔트리는 **브라우저 번들 안전**이다(v0.2.0 — node 내장 import 0, `pnpm browser-check` 로 고정). 클라이언트 컴포넌트에서 바로 import 해도 되고, 서버 라우트에서 계산해 JSON 으로 내려줘도 된다.

```ts
import { loadRegistry, resolveStack, keysFrom, firstSymbolLayerId, validateStyleMin, buildNotices } from '@masterchillax/globe-kit';

const registry = loadRegistry();            // 번들된 registry/providers.json (fs 없음)
const stack = resolveStack(registry, {
  app: 'jarvis', usage: 'personal', exposure: 'private', platform: 'web',
  // 키는 **명시 맵**으로. Next 는 `process.env.NEXT_PUBLIC_X` 정적 참조만 인라인하므로
  // `name => process.env['NEXT_PUBLIC_' + name]` 는 클라이언트 번들에서 항상 undefined 다.
  keys: keysFrom({ ARCGIS_API_KEY: process.env.NEXT_PUBLIC_ARCGIS_API_KEY, VWORLD_KEY: process.env.NEXT_PUBLIC_VWORLD_KEY }),
  consents: [],                              // 예: ['vworld-commercial'] (서면 있을 때만)
});
// map = new maplibregl.Map({ style: stack.styleUrl, ... })
// map.on('load', () => { for (const [id, s] of Object.entries(stack.sources)) map.addSource(id, s);
//   const anchor = firstSymbolLayerId(map.getStyle().layers); for (const l of stack.layers) map.addLayer(l, anchor ?? undefined);
//   if (stack.terrain) map.setTerrain(stack.terrain); });
// stack.dropped → 화면 진단 패널에 그대로 (왜 위성이 없는지 사용자가 본다)
```

- `std-overview`(GIBS Blue Marble, 소스 z≤8)는 레이어 `maxzoom: 9`, `std-night`(Black Marble, 소스 z≤8)는 `maxzoom: 10` 으로 나온다 — 그 줌부터 숨어 벡터 지도가 드러난다. 안 그러면 z15 에서 z8 픽셀 하나가 화면을 채워 지도가 반전된 것처럼 보인다(Jarvis 실측).
- 위성/야간 래스터가 **실제로 그려지는 동안**(`rasterDrawnAt(layer, map.getZoom())`)은 `fillsAboveAnchor(map.getStyle().layers, anchor)` 가 돌려주는 fill 레이어(OFM dark 의 `building`·aeroway — 첫 symbol 뒤에 오는 불투명 fill)를 `visibility: none` 으로 숨긴다. 안 숨기면 z12+ 도시에서 영상이 검은 블록에 덮인다. 도로선·라벨은 그대로 둔다(하이브리드).
- **표기**: `AttributionControl` 의 `customAttribution` 에는 `stack.customAttribution`(+ 앱 고유 크레딧)만 넘긴다 — 현 레지스트리에선 빈 배열이다. 래스터 크레딧은 소스 spec 에 실려 MapLibre 가 **켜진 소스만** 표기하고, OpenFreeMap 은 자기 TileJSON 이 표기한다(`attributionInStyle`). `stack.attribution` 전체를 join 하면 OFM 이 두 번, 꺼진 야간·지형 크레딧이 항상 붙는다. `stack.attribution` 은 THIRD_PARTY_NOTICES(`buildNotices`) 용이다.
- `validateStyleMin` 의 attribution·tileSize 규칙은 **레이어가 실제로 그리는 소스**에만 건다(OFM dark 에는 참조 없는 래스터 소스 `ne2_shaded` 가 있다). 금지 호스트·키 리터럴 규칙은 참조 여부와 무관하게 전 소스에 건다.
- 스크립트·테스트에서 다른 레지스트리 파일을 읽으려면 `import { loadRegistryFile } from '@masterchillax/globe-kit/node'`(node 전용). 레지스트리 JSON 자체는 `@masterchillax/globe-kit/registry` 로도 import 된다.
- 정적 린트는 **자리표시자 키**로 만든 스택에 건다: `keysFrom({ ARCGIS_API_KEY: '{ARCGIS_API_KEY}', … })`. 실제 키가 든 런타임 URL 은 `key-literal` 에 걸리는 게 맞다(키가 스타일 픽스처에 박히는 걸 막는 규칙).

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
