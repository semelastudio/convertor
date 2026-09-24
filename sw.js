/* ==================================================================
   QuickConvertor service worker

   Strategy per request type:
     - rate API      : network only, never cached (rates must be live)
     - page shell    : network-first, cache fallback (a deploy shows up
                       immediately, but the app still opens offline)
     - static assets : cache-first with background revalidation (icons,
                       manifest, fonts — fast, and refreshed silently)

   Bump CACHE_VERSION on any change here or to the cached asset list;
   activate deletes every cache that doesn't match.
   ================================================================== */

const CACHE_VERSION = "v7";
const CACHE_NAME = `quickconvertor-app-${CACHE_VERSION}`;

/* Precached shell. These paths must match the files on disk exactly —
   the previous version listed "./icons/icon-192.png", which does not
   exist, and a single 404 in cache.addAll() rejects the whole install,
   leaving the app with no offline cache at all. Assets are added
   individually below so one bad entry can never do that again. */
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon/QC%20ICON-iOS-Default-1024@1x.png",
  "./icon/QC%20ICON-iOS-Dark-1024@1x.png"
];

/* Hosts whose responses are worth caching even though they're cross-origin. */
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

/* The live rates feed: always straight to the network. */
const API_HOST = "er-api.com";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Individually, so a missing or renamed file degrades the cache
    // instead of aborting the install.
    await Promise.all(ASSETS.map(async (url) => {
      try{
        await cache.add(new Request(url, { cache: "reload" }));
      }catch(err){
        console.warn("[sw] could not precache", url, err);
      }
    }));
  })());
  // Take over as soon as the install finishes rather than waiting for
  // every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* Only store responses we can actually replay: successful same-origin
   ones, plus opaque cross-origin font responses (status 0, which is
   normal for no-cors font requests). */
function isCacheable(response){
  if(!response) return false;
  if(response.type === "opaque") return true;
  return response.ok && response.status === 200;
}

/* Network-first: fresh when online, cached copy when not. Used for the
   page itself so a new build is never masked by a stale cache. */
async function networkFirst(request){
  const cache = await caches.open(CACHE_NAME);
  try{
    const response = await fetch(request);
    if(isCacheable(response)) cache.put(request, response.clone());
    return response;
  }catch(err){
    // Offline: this exact URL, else the shell, else a plain message.
    const cached = await cache.match(request) || await cache.match("./index.html");
    if(cached) return cached;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

/* Cache-first with revalidation: answer instantly from cache, and
   refresh the entry in the background for next time. */
async function cacheFirst(request){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request).then((response) => {
    if(isCacheable(response)) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  if(cached){
    network.catch(() => {});   // revalidate without blocking the response
    return cached;
  }
  return (await network) || new Response("", { status: 504, statusText: "Offline" });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Never interfere with POST/PUT and friends.
  if(request.method !== "GET") return;

  let url;
  try{ url = new URL(request.url); }catch(err){ return; }

  // Live rates: pass through untouched so a cached rate can never be served.
  if(url.hostname.endsWith(API_HOST)) return;

  // Page navigations (and index.html directly): network-first.
  if(request.mode === "navigate" || url.pathname.endsWith("index.html")){
    event.respondWith(networkFirst(request));
    return;
  }

  // Google Fonts: cache-first, so the mono font still renders offline.
  if(FONT_HOSTS.includes(url.hostname)){
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else we own (icons, manifest): cache-first.
  if(url.origin === self.location.origin){
    event.respondWith(cacheFirst(request));
  }
  // Other cross-origin requests fall through to the network untouched.
});
