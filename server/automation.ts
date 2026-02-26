import { storage } from "./storage";
import type { TaskConfig } from "@shared/schema";
import { log } from "./index";
import http from "http";
import https from "https";
import { URL } from "url";

let shouldStop = false;
let isRunning = false;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
];

function buildProxyUrl(raw: string): string {
  if (!raw || !raw.trim()) return "";

  const s = raw.trim();

  if (s.toLowerCase() === "rotating") return "";

  if (s.startsWith("http://") || s.startsWith("https://")) {
    return s;
  }

  const parts = s.split(":");

  if (parts.length === 2) {
    return `http://${parts[0]}:${parts[1]}`;
  }

  if (parts.length === 4) {
    return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
  }

  return "";
}

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpRequest(
  targetUrl: string,
  method: "GET" | "POST",
  headers: Record<string, string>,
  body: string | null,
  proxyUrl: string,
  followRedirects: boolean = true
): Promise<{ statusCode: number; body: string; cookies: string[] }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 20000);

    const doRequest = (url: string, redirectCount: number) => {
      const parsed = new URL(url);

      let requestOptions: http.RequestOptions;
      let transport: typeof http | typeof https;

      if (proxyUrl) {
        const proxy = new URL(proxyUrl);
        requestOptions = {
          hostname: proxy.hostname,
          port: parseInt(proxy.port) || 80,
          path: url,
          method,
          headers: {
            ...headers,
            Host: parsed.host,
          },
          timeout: 15000,
        };
        if (proxy.username) {
          requestOptions.headers!["Proxy-Authorization"] =
            "Basic " + Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString("base64");
        }
        transport = http;
      } else {
        requestOptions = {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method,
          headers,
          timeout: 15000,
        };
        transport = parsed.protocol === "https:" ? https : http;
      }

      const req = transport.request(requestOptions, (res) => {
        if (followRedirects && res.statusCode && [301, 302, 303, 307].includes(res.statusCode) && res.headers.location && redirectCount < 5) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith("/")) {
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          res.resume();
          doRequest(redirectUrl, redirectCount + 1);
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          clearTimeout(timer);
          const cookies = (res.headers["set-cookie"] || []).map((c: string) => c.split(";")[0]);
          resolve({
            statusCode: res.statusCode || 0,
            body: Buffer.concat(chunks).toString("utf-8"),
            cookies,
          });
        });
      });

      req.on("error", (err) => { clearTimeout(timer); reject(err); });
      req.on("timeout", () => { req.destroy(); clearTimeout(timer); reject(new Error("timeout")); });

      if (body && method === "POST") req.write(body);
      req.end();
    };

    doRequest(targetUrl, 0);
  });
}

async function doVote(url: string, proxyUrl: string, answerKey: string, rep: number, total: number): Promise<boolean> {
  const ua = randomUA();
  const encodedKey = answerKey.replace("[", "%5B").replace("]", "%5D");
  const origin = url.match(/https?:\/\/[^/]+/)?.[0] || "";

  storage.addLog(`[${rep}/${total}] Voting...`, "info", rep);

  let getResult;
  try {
    getResult = await httpRequest(url, "GET", {
      "User-Agent": ua,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    }, null, proxyUrl);
  } catch (err: any) {
    storage.addLog(`[${rep}] Connection failed: ${err.message}`, "warning", rep);
    return false;
  }

  if (!getResult.body) {
    storage.addLog(`[${rep}] Empty response`, "warning", rep);
    return false;
  }

const tokenMatch = getResult.body.match(/name="_token"\s+type="hidden"\s+value="([^"]+)"/)
  || getResult.body.match(/name="_token".*?value="([^"]+)"/);

const pollIdMatch = getResult.body.match(/name="gidvnrj"\s+value="(\d+)"/)
  || getResult.body.match(/name="gidvnrj".*?value="(\d+)"/);

  if (!tokenMatch || !pollIdMatch) {
    storage.addLog(`[${rep}] Could not extract token/poll ID`, "warning", rep);
    return false;
  }

  const token = tokenMatch[1];
  const pollId = pollIdMatch[1];

  await sleep(300 + Math.random() * 700);

  const sex = Math.floor(Math.random() * 2) + 1;
  const age = Math.floor(Math.random() * 5) + 1;
  const formData = `gidvnrj=${pollId}&sex=${sex}&age=${age}&_token=${token}&${encodedKey}=1`;

  const cookieHeader = getResult.cookies.join("; ");

  let postResult;
  try {
    postResult = await httpRequest(`${origin}/pvote`, "POST", {
      "User-Agent": ua,
      "Referer": url,
      "Origin": origin,
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(formData).toString(),
      "Cookie": cookieHeader,
    }, formData, proxyUrl, false);
  } catch (err: any) {
    storage.addLog(`[${rep}] POST failed: ${err.message}`, "warning", rep);
    return false;
  }

  if (postResult.statusCode === 302 || postResult.statusCode === 200) {
    return true;
  } else {
    storage.addLog(`[${rep}] HTTP ${postResult.statusCode}`, "warning", rep);
    return false;
  }
}

async function voteLoop(config: TaskConfig, answerKey: string, proxyUrl: string): Promise<void> {
  let successCount = 0;
  let failCount = 0;

  storage.addLog(`Target: ${config.url}`, "info");
  storage.addLog(`Answer: ${answerKey}`, "info");
  if (proxyUrl) storage.addLog("Proxy: rotating", "success");

  for (let i = 1; i <= config.repetitions; i++) {
    if (shouldStop) {
      storage.addLog("Stopped by user", "warning");
      storage.setProgress({ status: "idle", currentRepetition: i - 1 });
      isRunning = false;
      return;
    }

    storage.setProgress({ currentRepetition: i - 1 });

    try {
      const success = await doVote(config.url, proxyUrl, answerKey, i, config.repetitions);
      if (success) {
        successCount++;
        storage.addLog(`[${i}] SUCCESS (${successCount} total)`, "success", i);
      } else {
        failCount++;
      }
    } catch (err: any) {
      failCount++;
      storage.addLog(`[${i}] Error: ${err.message}`, "error", i);
    }

    storage.setProgress({ currentRepetition: i });

    if (i < config.repetitions && !shouldStop) {
      const jitter = Math.floor(Math.random() * 1000);
      await sleep(config.delayBetweenReps + jitter);
    }
  }

  const finalStatus = successCount > 0 ? "completed" : "error";
  storage.addLog(`Done: ${successCount} success, ${failCount} failed / ${config.repetitions}`, successCount > 0 ? "success" : "error");
  storage.setProgress({
    status: finalStatus,
    currentRepetition: config.repetitions,
    completedAt: new Date().toISOString(),
  });
  isRunning = false;
}

export async function runTask(config: TaskConfig): Promise<void> {
  let answerKey = "";
  for (const a of config.actions) {
    if (a.type === "click" && a.selector?.includes("answers[")) {
      const m = a.selector.match(/answers\[(\d+)\]/);
      if (m) { answerKey = `answers[${m[1]}]`; break; }
    }
  }

  if (!answerKey) {
    storage.addLog("No answer selector found in actions", "error");
    storage.setProgress({ status: "error", completedAt: new Date().toISOString() });
    return;
  }

  const proxyUrl = buildProxyUrl(config.proxyListUrl || "");

  shouldStop = false;
  isRunning = true;

  storage.resetProgress();
  storage.setConfig(config);
  storage.setProgress({
    status: "running",
    totalRepetitions: config.repetitions,
    currentRepetition: 0,
    startedAt: new Date().toISOString(),
  });
  storage.addLog(`Starting ${config.repetitions} votes`, "info");

  log(`Starting ${config.repetitions} votes`);

  voteLoop(config, answerKey, proxyUrl).catch((err) => {
    storage.addLog(`Fatal error: ${err.message}`, "error");
    storage.setProgress({ status: "error", error: err.message });
    isRunning = false;
  });
}

export async function stopTask(): Promise<void> {
  shouldStop = true;
  storage.addLog("Stop requested...", "warning");
}
