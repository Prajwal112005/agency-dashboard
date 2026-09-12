import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { errorHandler } from "./errors";
import { initSockets } from "./sockets";
import { startOverdueJob } from "./jobs/overdueJob";
import routes from "./routes";

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", routes);

// Must be registered last — Express only routes here when a handler above
// called next(err) or threw inside an asyncHandler.
app.use(errorHandler);

const httpServer = http.createServer(app);
initSockets(httpServer);
startOverdueJob();

httpServer.listen(config.port, () => {
  console.log(`API + WebSocket server listening on :${config.port}`);
});
