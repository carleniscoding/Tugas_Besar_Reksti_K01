import { createApp } from "./server.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(`[votely-backend] listening on http://localhost:${env.port}`);
});
