const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");

setGlobalOptions({
  maxInstances: 10
});

exports.newsFeed = onRequest(
  {
    cors: true
  },
  (req, res) => {

    res.status(200).json({
      ok: true,
      updatedAt: new Date().toISOString(),

      news: [
        {
          id: "test-1",
          source: "KYIV безпека",
          time: new Date().toISOString(),
          title: "Тестова новина",
          text: "Стрічка новин успішно підключена до Firebase.",
          url: null
        },
        {
          id: "test-2",
          source: "KYIV безпека",
          time: new Date().toISOString(),
          title: "Система працює",
          text: "Це тестове повідомлення для перевірки новинної стрічки.",
          url: null
        }
      ]
    });

  }
);