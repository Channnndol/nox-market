# Official TradingView widget as the default crypto chart

The user selected the official free widget after reviewing the licensing and integration limits. Keep the existing public GitHub Pages app, dark theme, market search, watchlist, and independent PC price alerts.

## Approaches
- Selected: embed the official Advanced Chart Widget for crypto, as already done for stocks/indices. TradingView supplies the chart and its allowed market data.
- Advanced Charts: not selected because its current access terms exclude personal/hobby projects.
- Existing Lightweight Charts: retain as an optional NOX chart so saved drawings, drawing alerts, and existing captures remain usable.

## Behavior and constraints
- Default every visit to TradingView. A crypto-only switch opens the existing NOX chart without deleting records. No new account/service or paid dependency.
- Map Upbit KRW-BTC to UPBIT:BTCKRW; Binance/Bybit spot retain symbol; USDT perpetuals use .P.
- Show TradingView drawing toolbar, indicators menu, volume, snapshot button, Korean locale, Asia/Seoul and dark background. Keep official branding.
- Crypto symbol changes happen through NOX search/watchlist, not inside the widget: the selected symbol must match the price-alert target. Widget timeframe changes are independent; offer an explicit interval for PC alert images.
- Direct exchange quote failures must not cover or block the independently loaded TradingView chart. Do not claim the widget is live based on the separate NOX stream.
- Widget drawings are not NOX drawings and cannot be synced/captured by NOX. Show concise user guidance; use the widget's image button for manual sharing. Preserve old drawing data and alerts.
- Keep stock/index presets and daily FX behavior. No widget data extraction, private library, or TradingView login integration.

## Validation
Test symbol/interval mapping and symbol-change safeguards. Run existing full suite and production build. Check browser rendering and switching if browser tooling is available; report missing browser/mobile verification explicitly. Deploy through the existing Pages workflow and verify its result.
