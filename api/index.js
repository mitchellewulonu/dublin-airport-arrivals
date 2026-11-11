require("dotenv").config();

let app;

try {
  const { createApp } = require("../src/app");
  app = createApp().app;
} catch (err) {
  const express = require("express");
  app = express();
  app.use((_req, res) => {
    res.status(500).json({
      error: "Failed to boot Dublin Airport arrivals API",
      detail: err && err.message ? err.message : String(err),
    });
  });
}

module.exports = app;
