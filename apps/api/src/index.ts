import "dotenv/config";
import { createApp } from "./app.js";
import { env } from "./lib/env.js";

const app = createApp();
const port = env.API_PORT;

app.listen(port, () => {
  console.log(`Sponsum API running on http://localhost:${port}`);
});
