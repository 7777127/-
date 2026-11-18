self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function () {
  self.clients.claim();
});

/*
  KYIV безпека — Web Push
  Приймає push-дані від сервера та показує
  системне сповіщення навіть коли PWA не відкрита.
*/
self.addEventListener("push", function (event) {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: "KYIV безпека",
      body: event.data ? event.data.text() : "Нове сповіщення"
    };
  }

  const level = data.level || "";
  const title =
    data.title ||
    (
      level === "red"
        ? "🔴 Ракетна небезпека"
        : level === "yellow"
          ? "🟡 Загроза БПЛА"
          : level === "end"
            ? "🟢 Відбій"
            : "KYIV безпека"
    );

  const body =
    data.body ||
    "Перевірте актуальний статус.";

  const vibration =
    level === "red"
      ? [220, 120, 220, 120, 420]
      : level === "yellow"
        ? [180, 100, 180]
        : [100, 80, 100];

  const options = {
    body: body,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: data.tag || "kyiv-bezpeka-alert",
    renotify: true,
    vibrate: vibration,
    data: {
      url: data.url || "./index.html",
      level: level
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url =
    event.notification.data &&
    event.notification.data.url
      ? event.notification.data.url
      : "./index.html";

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(function (clients) {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }

      return undefined;
    })
  );
});
