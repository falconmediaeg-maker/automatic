import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { taskConfigSchema } from "@shared/schema";
import { runTask, stopTask } from "./automation";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/task/start", (req, res) => {
    try {
      const progress = storage.getProgress();
      if (progress.status === "running") {
        return res.status(400).json({ message: "A task is already running" });
      }

      const parsed = taskConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }

      const config = parsed.data;

      runTask(config).catch(console.error);

      res.json({ message: "Task started", repetitions: config.repetitions });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/task/stop", (req, res) => {
    try {
      stopTask().catch(console.error);
      res.json({ message: "Task stop requested" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/task/progress", (_req, res) => {
    const progress = storage.getProgress();
    res.json(progress);
  });

  return httpServer;
}
