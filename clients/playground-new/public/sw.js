const u = "tiny-ui-",
  l = "tiny-ui-bundles-v1",
  c = "/tiny-ui/runtime.html",
  h = "/virtual/",
  r = self,
  d = (t) => {
    if (t.method !== "GET") return !1;
    const e = new URL(t.url);
    return e.origin !== r.location.origin ? !1 : e.pathname === c || e.pathname.startsWith(h);
  },
  f = async (t, e) => {
    const a = await t.match(e);
    if (a) return a;
    const s = new URL(e.url),
      n = await t.match(s.pathname);
    if (n) return n;
    if (s.pathname === c) {
      const o = await t.match(c);
      if (o) return o;
    }
    return null;
  };
r.addEventListener("install", (t) => {
  t.waitUntil(r.skipWaiting());
});
r.addEventListener("activate", (t) => {
  t.waitUntil(
    (async () => {
      await r.clients.claim();
      const s = (await caches.keys()).filter((n) => n !== l && n.startsWith(u)).map((n) => caches.delete(n));
      await Promise.all(s);
    })(),
  );
});
r.addEventListener("fetch", (t) => {
  const e = t,
    { request: a } = e;
  if (!d(a)) return;
  e.respondWith(
    (async () => {
      const s = await caches.open(l),
        n = await f(s, a);
      if (n) return n;
      if (new URL(a.url).pathname === c)
        try {
          const i = await fetch(a);
          return (i && i.ok && (await s.put(c, i.clone())), i);
        } catch (i) {
          return (console.error("SW runtime fetch failed:", i), new Response("Runtime unavailable", { status: 503 }));
        }
      return new Response("Not found", { status: 404 });
    })(),
  );
});
r.addEventListener("error", (t) => {
  console.error("SW error:", t.message, t.filename, t.lineno, t.colno, t.error);
});
r.addEventListener("unhandledrejection", (t) => {
  console.error("SW unhandledrejection:", t.reason);
});
