import "dotenv/config";
import express from "express";

let app;

try {
  const { createApp } = await import("../src/app.js");
  app = createApp().app;
} catch (err) {
  app = express();
  app.use((_req, res) => {
    res.status(500).json({
      error: "Failed to boot Dublin Airport arrivals API",
      detail: err && err.message ? err.message : String(err),
    });
  });
}

export default app;
