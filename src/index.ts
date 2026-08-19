import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { config } from "./config";
import { errorHandler } from "./middleware";
import routes from "./routes";
import { initializeDatabase } from "./db/initialize";

dotenv.config();

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(errorHandler);

async function start(): Promise<void> {
  try {
    await initializeDatabase();
    console.log("Starting API...");
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

start();

export default app;
