import express from "express";
import { errorHandler } from "./middlewares/errorHandler";
import { logger } from "./middlewares/logger";
import { notFound } from "./middlewares/notFound";
import routes from "./routes";
import { successBody } from "./utils/response";

const app = express();

app.use(logger);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json(
    successBody("MLBB Shop API berjalan dengan baik", { timestamp: new Date().toISOString() })
  );
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
