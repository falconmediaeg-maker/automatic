import type { TaskConfig, TaskProgress, TaskLog, TaskStatus } from "@shared/schema";
import { randomUUID } from "crypto";

const MAX_LOGS = 300;

export interface IStorage {
  getProgress(): TaskProgress;
  setProgress(progress: Partial<TaskProgress>): void;
  addLog(message: string, type: TaskLog["type"], repetition?: number): void;
  setLogs(logs: TaskLog[]): void;
  resetProgress(): void;
  setConfig(config: TaskConfig | null): void;
  getConfig(): TaskConfig | null;
  setShouldStop(val: boolean): void;
  getShouldStop(): boolean;
}

export class MemStorage implements IStorage {
  private progress: TaskProgress = {
    status: "idle",
    currentRepetition: 0,
    totalRepetitions: 0,
    logs: [],
  };
  private config: TaskConfig | null = null;
  private shouldStop = false;

  getProgress(): TaskProgress {
    return { ...this.progress, logs: [...this.progress.logs] };
  }

  setProgress(updates: Partial<TaskProgress>): void {
    this.progress = { ...this.progress, ...updates };
  }

  addLog(message: string, type: TaskLog["type"], repetition?: number): void {
    const log: TaskLog = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      message,
      type,
      repetition,
    };
    this.progress.logs.push(log);
    while (this.progress.logs.length > MAX_LOGS) {
      this.progress.logs.shift();
    }
  }

  setLogs(logs: TaskLog[]): void {
    this.progress.logs = logs.slice(-MAX_LOGS);
  }

  resetProgress(): void {
    this.progress = {
      status: "idle",
      currentRepetition: 0,
      totalRepetitions: 0,
      logs: [],
    };
    this.shouldStop = false;
  }

  setConfig(config: TaskConfig | null): void {
    this.config = config;
  }

  getConfig(): TaskConfig | null {
    return this.config;
  }

  setShouldStop(val: boolean): void {
    this.shouldStop = val;
  }

  getShouldStop(): boolean {
    return this.shouldStop;
  }
}

export const storage = new MemStorage();
