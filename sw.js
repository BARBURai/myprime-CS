// ============================================================
// sw.js — הרכיב שרץ ברקע
// מקבל פוש גם כשהאפליקציה סגורה, ומציג התראה במכשיר.
// ============================================================

self.addEventListener("push", event => {
  let data = { title: "MyPrime", body: "", ref: "" };
  try { data = { ...data, ...event.data.json() }; } catch { }
  event.waitUntil(
    self.registration.showNotification(data.title || "MyPrime", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      dir: "rtl",
      lang: "he",
      data: { ref: data.ref || "" },
      tag: data.ref || undefined,
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const ref = event.notification.data?.ref || "";
  const url = ref ? `/?ref=${encodeURIComponent(ref)}` : "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) if ("focus" in c) { c.navigate(url); return c.focus(); }
      return clients.openWindow(url);
    })
  );
});
