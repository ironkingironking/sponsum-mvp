import "dotenv/config";
import { createApp } from "./app.js";
import { env } from "./lib/env.js";

const app = createApp();
const port = env.API_PORT;
const host = process.env.API_HOST ?? "127.0.0.1";

app.listen(port, host, () => {
  console.log(`Sponsum API running on http://${host}:${port}`);
});
