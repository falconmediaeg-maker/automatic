import { execSync } from "child_process";
import fs from "fs";

const TASK_FILE = "/tmp/vote_task.json";
const PROGRESS_FILE = "/tmp/vote_progress.json";

function rand(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }

const UA_LIST = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

interface Progress {
  status: string;
  currentRepetition: number;
  totalRepetitions: number;
  logs: Array<{ id: string; timestamp: string; message: string; type: string; repetition?: number }>;
  startedAt?: string;
  completedAt?: string;
}

function writeProgress(p: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p));
}

function addLog(p: Progress, msg: string, type: string, rep?: number) {
  p.logs.push({
    id: Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    message: msg,
    type,
    repetition: rep,
  });
  if (p.logs.length > 100) p.logs = p.logs.slice(-50);
}

function shouldStop(): boolean {
  try {
    return fs.existsSync("/tmp/vote_stop");
  } catch { return false; }
}

function doOneVote(url: string, proxyUrl: string, answerKey: string): number {
  const cookieFile = `/tmp/vc_${Date.now()}.txt`;
  const ua = pick(UA_LIST);
  const lang = ["en-US,en;q=0.9", "en-US,en;q=0.9,ar;q=0.8"][rand(0, 1)];

  try {
    let proxyArg = "";
    if (proxyUrl) proxyArg = `-x ${proxyUrl}`;

    const html = execSync(
      `curl -s -L --max-time 25 ${proxyArg} -c "${cookieFile}" ` +
      `-H "User-Agent: ${ua}" -H "Accept: text/html,application/xhtml+xml" ` +
      `-H "Accept-Language: ${lang}" "${url}"`,
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    ).toString();

    if (!html) return 0;

    const tokenMatch = html.match(/_token.*?value="([^"]+)"/);
    const pollMatch = html.match(/gidvnrj.*?value="(\d+)"/);
    if (!tokenMatch || !pollMatch) return 0;

    const token = tokenMatch[1];
    const pollId = pollMatch[1];
    const origin = url.match(/https?:\/\/[^/]+/)?.[0] || "";
    const encodedKey = answerKey.replace("[", "%5B").replace("]", "%5D");
    const form = `gidvnrj=${pollId}&sex=${rand(1,2)}&age=${rand(1,5)}&_token=${token}&${encodedKey}=1`;

    const sleepMs = rand(300, 900);
    execSync(`sleep ${sleepMs / 1000}`);

    const status = execSync(
      `curl -s --max-time 25 ${proxyArg} -b "${cookieFile}" ` +
      `-H "User-Agent: ${ua}" -H "Referer: ${url}" -H "Origin: ${origin}" ` +
      `-H "Content-Type: application/x-www-form-urlencoded" ` +
      `-d '${form}' -o /dev/null -w "%{http_code}" "${origin}/pvote"`,
      { timeout: 30000 }
    ).toString().trim();

    return parseInt(status) || 0;
  } catch (err: any) {
    return -1;
  } finally {
    try { fs.unlinkSync(cookieFile); } catch {}
  }
}

async function main() {
  if (!fs.existsSync(TASK_FILE)) {
    console.log("No task file found");
    process.exit(1);
  }

  const task = JSON.parse(fs.readFileSync(TASK_FILE, "utf-8"));
  const { url, proxyUrl, answerKey, repetitions, delayBetweenReps } = task;

  try { fs.unlinkSync("/tmp/vote_stop"); } catch {}

  const progress: Progress = {
    status: "running",
    currentRepetition: 0,
    totalRepetitions: repetitions,
    logs: [],
    startedAt: new Date().toISOString(),
  };

  addLog(progress, `Starting ${repetitions} votes`, "info");
  addLog(progress, `Target: ${url}`, "info");
  if (proxyUrl) addLog(progress, `Proxy: rotating`, "success");
  addLog(progress, `Answer: ${answerKey}`, "info");
  writeProgress(progress);

  let ok = 0;
  let fail = 0;

  for (let i = 1; i <= repetitions; i++) {
    if (shouldStop()) {
      addLog(progress, "Stopped by user", "warning");
      progress.status = "idle";
      progress.completedAt = new Date().toISOString();
      writeProgress(progress);
      process.exit(0);
    }

    addLog(progress, `[${i}/${repetitions}] Voting...`, "info", i);
    writeProgress(progress);

    const status = doOneVote(url, proxyUrl, answerKey);

    if (status === 302 || status === 200) {
      ok++;
      addLog(progress, `[${i}] SUCCESS (${ok} total)`, "success", i);
    } else if (status === -1) {
      fail++;
      addLog(progress, `[${i}] Error`, "error", i);
    } else if (status === 0) {
      fail++;
      addLog(progress, `[${i}] No response`, "warning", i);
    } else {
      fail++;
      addLog(progress, `[${i}] HTTP ${status}`, "warning", i);
    }

    progress.currentRepetition = i;
    writeProgress(progress);

    if (i < repetitions && !shouldStop()) {
      const delay = delayBetweenReps + rand(0, 1000);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  addLog(progress, `Done: ${ok} success, ${fail} failed / ${repetitions}`, ok > 0 ? "success" : "error");
  progress.status = ok > 0 ? "completed" : "error";
  progress.completedAt = new Date().toISOString();
  writeProgress(progress);

  try { fs.unlinkSync(TASK_FILE); } catch {}
}

main().catch(err => {
  console.error("Worker error:", err);
  process.exit(1);
});
