# QuickConvertor

A simple, fast currency converter that installs to your home screen and keeps working offline.

Type an amount in any currency and every other row updates live. Rates come from a free public
feed, are cached locally, and the whole app runs from that cache when there is no connection.

**Status:** v0.1 Alpha · by Semela Studio

---

## Features

- **Live two-way conversion.** Edit the base amount or any row. Everything else follows instantly.
- **154 currencies**, searchable by code or name. The search ignores accents, so "krona" finds
  Icelandic Króna and "colon" finds Costa Rican Colón.
- **Drag to reorder** rows with the grip handle. Works with touch, pen and mouse.
- **Offline first.** Rates, the page and its assets are cached. Switching base currency is
  calculated locally from cross rates, so it works with no connection at all.
- **Dark mode** that follows the system until you pick a side, then remembers your choice.
- **Installable PWA** with light and dark app icons.
- **No accounts, no tracking, no analytics.** The only network call is the rates feed.

---

## Tech stack

No framework, no build step, no package manager, no dependencies to install. The app is plain
HTML, CSS and JavaScript in a single file, plus a service worker.

The one external resource is the DM Mono webfont from Google Fonts, loaded non-blocking and
cached by the service worker so it still renders offline.

---

## Project structure

| Path | What it is |
|---|---|
| [index.html](index.html) | The entire app: markup, styles and logic in one file |
| [sw.js](sw.js) | Service worker: offline cache and asset strategies |
| [manifest.json](manifest.json) | PWA metadata: name, icons, colours, display mode |
| [icon/](icon/) | App icons at 192px and 512px, light and dark |

Inside [index.html](index.html) the script is divided into numbered sections:

1. Constants and currency data
2. DOM references
3. State and persistence
4. Number formatting and parsing
5. Rates: fetching, freshness, offline rebasing
6. Rendering: base picker, rows, search
7. Interaction: amount edits, drag reorder, settings, theme
8. Boot

---

## Running it locally

A service worker will not register from a `file://` URL, so open the app over HTTP. Any static
server works. With Python already on macOS:

```bash
cd /path/to/convert
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. Service workers are allowed on `localhost` over plain HTTP,
so offline mode can be tested there.

To iterate without the cache getting in the way, tick **Update on reload** in the browser's
Application panel, or use a private window.

---

## Deploying

Copy the four items in the table above to any static host. Two requirements:

- **Serve over HTTPS.** Service workers are refused on other origins, apart from `localhost`.
- **Bump `CACHE_VERSION` in [sw.js](sw.js)** whenever you change the cached asset list. Activation
  deletes every cache that does not match the current name, so a stale one cannot linger.

Paths are relative throughout, so the app can live in a subdirectory.

---

## Rates data

Rates come from [open.er-api.com](https://open.er-api.com), a free endpoint that needs no API key
and no attribution header.

```
https://open.er-api.com/v6/latest/{BASE}
```

The feed publishes roughly once a day and returns every currency in one response relative to the
requested base. The app relies on both facts: it does not refetch on every launch, and it can
convert its cached table to a different base on its own using cross rates, which is exact because
every rate shares a common origin.

The service worker never caches this endpoint. Rates are only ever cached deliberately, in
`localStorage`, with a timestamp attached.

| Behaviour | Value |
|---|---|
| Cached rates reused without a network call for | 30 minutes |
| Request abandoned after | 10 seconds |
| Default base currency | USD |
| Default rows | EUR, GBP, NZD |

Rates are refreshed when the freshness window has passed and the app is opened or brought back to
the foreground, when the connection returns, and whenever you tap **Refresh** in settings, which
forces a fetch regardless of the window.

---

## Local storage

Everything lives in the browser. Nothing is sent anywhere.

| Key | Holds |
|---|---|
| `rate-app-state-v3` | Base currency, row order, cached rates, timestamp, last amount |
| `convertor-theme` | `"light"` or `"dark"`, only once you toggle it yourself |

Change the shape of the saved state and you should bump the `v3` suffix, so old records are
ignored rather than misread. Writes are debounced and flushed when the page is hidden, so typing
never blocks on a synchronous storage write.

Clearing site data resets the app to its defaults.

---

## Caching strategy

The service worker treats three kinds of request differently:

- **Rates feed:** never cached, always straight to the network.
- **The page itself:** network first, falling back to the cached copy. A new deploy shows up
  immediately, but the app still opens with no connection.
- **Icons, manifest, fonts:** cache first, refreshed quietly in the background.

Precached assets are added one at a time on install. A missing or renamed file degrades the cache
instead of aborting the install, which is what happens with a bulk `cache.addAll`.

---

## Configuration

The knobs worth knowing, all near the top of the script in [index.html](index.html):

| Constant | Purpose |
|---|---|
| `DEFAULT_BASE`, `DEFAULT_LIST` | What a first-time visitor sees |
| `RATES_TTL_MS` | How long cached rates are considered fresh |
| `FETCH_TIMEOUT_MS` | Ceiling on a rates request |
| `ROW_COLORS` | The rotating row palette, cycled by position |
| `CURRENCY_NAMES` | The full currency list; the picker and search derive from it |

Colours, spacing and fonts are CSS custom properties on `:root`. Only the page background, header
text and the dashed add button react to the theme. Cards and rows stay light with fixed navy ink,
by design.

---

## Browser support

Modern evergreen browsers, targeting iOS Safari and Chrome on Android as the primary platforms.
The app leans on Pointer Events, CSS custom properties, `Intl`, `AbortController` and service
workers. Older Safari is handled where it is cheap to do so, such as the legacy `matchMedia`
listener API.

With JavaScript disabled the page renders but does nothing. There is no server-side fallback.

---

## Known limitations

- **Rates are daily, not intraday.** This is a converter for everyday amounts, not a trading tool.
- **The manifest lists dark icons using a `media` key**, which is not part of the manifest spec.
  An installed home screen icon may end up being either variant.
- **Pinch zoom is disabled** by the viewport meta tag, which is a deliberate app-feel choice with
  a real accessibility cost.
- **Icons declare `purpose: "any maskable"`.** If they lack the maskable safe zone, Android may
  crop them on the home screen.
- **No tests and no CI.** Verification is manual.

---

## License

Not yet licensed. All rights reserved by Semela Studio until a license is added.
