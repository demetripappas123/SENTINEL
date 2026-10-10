# SENTINEL for iPhone

Expo SDK 57, React Native, and strict TypeScript. The interface and application logic use TypeScript; Expo generates the native Xcode host. No Swift editing is required. This workspace targets iOS only.

From the repository root, install dependencies with `npm ci`. Xcode and CocoaPods must be installed (`brew install cocoapods` if needed).

```bash
npm run ios:build -w @sentinel/mobile -- --device
```

Choose an available iPhone simulator. This generates `ios/`, installs Pods, builds the app, and starts Metro. The generated project is ignored by Git and can be regenerated from `app.json`. Simulator builds do not require an Apple developer account.

For subsequent UI changes, keep Metro running with hot reload:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 npm run start -w @sentinel/mobile -- --dev-client
```

In Expo's terminal, press `i` to open the installed development build. If the launcher opens without the app, connect it to `http://127.0.0.1:8081`. On this Mac, `--localhost` binds IPv6 while the simulator requests IPv4; the command above avoids that mismatch. Do not run two Metro servers on the same port. When Metro is already running, add `--no-bundler` to the build command.

To run from Xcode, open **`SENTINEL-mobile-frontend/ios/SENTINEL.xcworkspace`**, select the **SENTINEL** scheme and an iPhone simulator, then Run. Keep Metro running in the terminal for Debug builds. Use the workspace rather than the `.xcodeproj`, because it includes the CocoaPods dependencies. Xcode 27 shows simulators in Device Hub.

```bash
npm test -w @sentinel/mobile
npm run typecheck -w @sentinel/mobile
npm run check:deps -w @sentinel/mobile
npm run build:mobile
```

The export command checks iOS JavaScript and asset bundling; it does not replace a native build. The final Release build was checked with Xcode 27 on iPhone 15 Pro (393-point width) and iPhone 17 Pro Max (440-point width), both running iOS 26.5.

`App.tsx` composes the repository, device review store, gesture root, safe areas, and bottom-sheet provider. It owns tab and evidence selection IDs. Tab views stay mounted during navigation to retain scroll position, search, and filters. Shared visual components live in `src/components`; `src/design` contains native colors, typography, icons, and motion helpers. Animation follows the system Reduce Motion setting, and haptics are optional.

`InspectionProvider` owns loaded records, review acknowledgments, date scope, loading, and errors. Startup waits for records and saved reviews. Reviews persist in AsyncStorage under a versioned key scoped to the repository namespace. An acknowledgment leaves inspection records and severity intact. Preferences opens from **OP**; clearing local acknowledgments requires confirmation. Failed writes keep the review unchanged and the evidence open for retry.

Attention now uses the supplied Figma exports for its metrics, charts, controls, and finding thumbnails. Search, review status, severity, and type filters combine without changing the date-scoped summaries. Mission dates use recorded start dates across all tabs; the date sheet offers typed dates and the native picker. The queue remains scrollable, with its action footer reserved on the two target phone sizes.

Missions separates completion from action success, supports configuration and completed-with-failures filters, and preserves filter selection across tabs. Inspecting a mission shows its actions; selecting an action changes the asset, waypoint, readings, confidence, and linked findings together. Pending actions are distinct from failed actions, and missions without actions remain inspectable.

Facility reuses the schematic artwork extracted from the supplied Figma export. Native controls select all 15 waypoints by default; an optional floor filter limits the selectable pins and list. Map and list selection stay synchronized. Display positions in `map-layout.ts` are illustrative and independent of recorded operational coordinates. Detail names, floors, and finding counts come from records. Unknown display positions remain selectable in the list, and review acknowledgment changes pending counts while preserving total findings.

Evidence uses a draggable native bottom sheet with scrollable details and a pinned review action. It resolves context from the injected repository, handles missing evidence, and offers Mark reviewed, Undo review, and failed-save retry. Unreadable saved reviews require a successful reload before writes are permitted. Native XCTest covers review/restart/undo, date editor access, map/floor selection, sheet expansion, close, drag, and backdrop dismissal. Larger-text controls and dark appearance have screenshot coverage. Software-keyboard occlusion and native Reduce Motion transitions remain unverified; their state handling has Jest coverage. See [design QA](../design-qa.md) for comparisons and limitations.

The default repository supplies the bundled challenge fixture. To use the existing backend dataset endpoint, copy `.env.example` to `.env.local`, set `EXPO_PUBLIC_API_URL`, and rebuild/restart Expo. The API repository validates `GET /dataset`; failures display Retry rather than substituting the fixture. A simulator can reach the Mac at localhost; a physical phone needs a reachable LAN address. Screens use the same `InspectionRepository` contract, which can also be injected through `<App repository={repository} />`. Use a stable instance and a distinct namespace for another dataset or account. Reviews remain local to the device; backend acknowledgment, authentication, and robot controls are outside this milestone.

Supported app links use `com.sentinel.inspections://attention`, `://missions`, `://facility`, `://findings/AN014`, and `://missions/M015?action=A0146`. Cold links wait for dataset hydration; unknown record IDs and mismatched action/mission pairs are ignored.

The visual references are the five PNG exports under `design/mockups/mobile`. Extracted inspection imagery is illustrative; the UI does not claim it is a photograph captured for an individual record. App-facing descriptions omit the known leading provenance qualifier while stored records retain it. Native chrome, actual dataset values, and accessible controls account for documented differences from the flattened references.

For reproducible native screenshot tests, install a Release fixture-backed build on a dedicated simulator with no local acknowledgments, then generate the separate XCTest harness (Swift is test code only):

```bash
# From the repository root; GEM_HOME may be needed for Homebrew CocoaPods.
GEM_HOME="$(brew --prefix cocoapods)/libexec" ruby scripts/ios-ui-qa/create-project.rb /private/tmp/sentinel-ios-ui-qa
xcodebuild -project /private/tmp/sentinel-ios-ui-qa/SentinelQA.xcodeproj \
  -scheme SentinelQA -destination 'id=<SIMULATOR_UUID>' \
  -only-testing:SentinelQA/SentinelScreenshots/testScreensAndReview \
  -resultBundlePath /private/tmp/sentinel-ui-qa.xcresult test
```

Use a fresh result-bundle path for each run. Run `testLargeTextControls` separately after `xcrun simctl ui <SIMULATOR_UUID> content_size accessibility-large`, then restore `content_size large`. Export screenshots with `xcrun xcresulttool export attachments --path <RESULT_BUNDLE> --output-path <OUTPUT_DIRECTORY>`.

Jest mocks only native boundaries (storage, system accessibility, gesture/animation runtime, and bottom-sheet runtime); repository, review-store, provider, and UI interaction logic run normally.
