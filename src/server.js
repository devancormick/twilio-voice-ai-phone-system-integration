import http from "node:http";
import { getConfig, validateConfig } from "./config.js";
import { buildApp } from "./voice-app.js";

const config = getConfig();
validateConfig(config);

const app = buildApp({ config });

const server = http.createServer(app.handle);

server.listen(config.port, () => {
  console.log(`Voice app listening on port ${config.port}`);
});
