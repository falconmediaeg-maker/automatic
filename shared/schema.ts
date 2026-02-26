import { z } from "zod";

export const actionTypes = [
  "click",
  "type",
  "wait",
  "scroll",
  "select",
  "screenshot",
] as const;

export const actionSchema = z.object({
  id: z.string(),
  type: z.enum(actionTypes),
  selector: z.string().optional(),
  value: z.string().optional(),
  description: z.string().optional(),
});

export const taskConfigSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  actions: z.array(actionSchema).min(1, "Add at least one action"),
  repetitions: z.number().int().min(1).max(1000),
  delayBetweenReps: z.number().int().min(0).max(300000).default(1000),
  proxyListUrl: z.string().optional(),
});

export type Action = z.infer<typeof actionSchema>;
export type TaskConfig = z.infer<typeof taskConfigSchema>;

export type TaskStatus = "idle" | "running" | "paused" | "completed" | "error";

export interface TaskLog {
  id: string;
  timestamp: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
  repetition?: number;
}

export interface TaskProgress {
  status: TaskStatus;
  currentRepetition: number;
  totalRepetitions: number;
  logs: TaskLog[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export const users = undefined;
export type InsertUser = never;
export type User = never;
