import "dotenv/config";
import { createApp } from "./app.js";

const { app, mpp } = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Dublin Airport arrivals API listening on http://localhost:${PORT}`
  );
  console.log(
    `MPP enabled: $${mpp.price} via Tempo (${mpp.testnet ? "testnet" : "mainnet"}) → ${mpp.recipient}`
  );
});
