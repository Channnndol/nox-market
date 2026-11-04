# TradingView Widget Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this focused change in the current session.

**Goal:** Open crypto markets in the official free TradingView widget by default, preserving NOX records and independent alerts.
**Architecture:** A small widget module owns symbol conversion, supported embed options, and mounting. Existing main.js owns mode selection, controls, data requests, and saved records.
**Tech Stack:** Existing vanilla JavaScript, Vite, Node test runner, official hosted embed script.
**Spec:** ../specs/2026-11-05-tradingview-widget-design.md

## Global constraints
Keep public GitHub Pages, dark theme, existing store and PC agent. No paid services, data extraction or private TradingView libraries. Use existing checkout on a clean feature branch for this bounded change.

## Review focus
Spot versus perpetual symbols; mismatched widget/alert markets; old asynchronous responses after switching; direct-feed failure hiding a healthy widget; misleading drawing sync/capture controls.

## Task 1: Widget integration
- [x] Add tests in tests/tradingview.test.mjs for literal symbol and interval mappings, invalid products, and locked crypto symbols. Run and observe failure before adding src/tradingview.mjs.
- [x] Implement tradingViewSymbol(market), widgetOptions({symbol, interval, allowSymbolChange}), mountTradingView(host, options, onError), and tradingViewLink(symbol).
- [x] Update src/main.js and src/style.css: default widget, optional NOX mode, safe lifecycle, independent quote status, clear drawing/snapshot guidance, explicit alert-image interval.
- [x] Update README.md and public/setup.html for the two chart modes and their integration limits.
- [x] Run pnpm test and pnpm build; inspect browser behavior if available. Review complete diff, fix material findings, then commit.
- [ ] Integrate to main, deploy using existing Pages workflow, verify deployed assets, report limitations.

## Verification record
- 2026-11-05: baseline 17 tests passed; symbol mapping tests failed before implementation, then passed.
- Same-widget remount regression failed before caching, then passed with detached/error-retry coverage. Final suite: 23 passed; Vite production build passed.
- Fresh read-only reviewer found no remaining Critical/Important issues.
- Browser tooling reports local browser use disabled in Work settings. Actual iframe tools, layout and physical Android/iOS remain unverified. Real Supabase/Telegram are not connected.
- Official embed script returned HTTP 200. Publication status and artifact verification are reported in the task completion message.
