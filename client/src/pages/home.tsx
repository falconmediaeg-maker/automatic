import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Play,
  Square,
  Plus,
  Trash2,
  Globe,
  MousePointerClick,
  Type,
  Clock,
  ArrowDown,
  ListChecks,
  Repeat,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  GripVertical,
  Zap,
  Settings2,
  Camera,
  Shield,
} from "lucide-react";
import type { Action, TaskConfig, TaskProgress, TaskLog, TaskStatus } from "@shared/schema";

const actionTypeConfig = {
  click: { label: "Click", icon: MousePointerClick, color: "text-blue-500", desc: "Click on an element" },
  type: { label: "Type Text", icon: Type, color: "text-green-500", desc: "Type text into a field" },
  wait: { label: "Wait", icon: Clock, color: "text-amber-500", desc: "Wait for seconds" },
  scroll: { label: "Scroll", icon: ArrowDown, color: "text-purple-500", desc: "Scroll the page" },
  select: { label: "Select Option", icon: ListChecks, color: "text-cyan-500", desc: "Select from dropdown" },
  screenshot: { label: "Screenshot", icon: Camera, color: "text-pink-500", desc: "Take a screenshot" },
};

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function ActionCard({
  action,
  index,
  onUpdate,
  onRemove,
}: {
  action: Action;
  index: number;
  onUpdate: (id: string, updates: Partial<Action>) => void;
  onRemove: (id: string) => void;
}) {
  const config = actionTypeConfig[action.type];
  const Icon = config.icon;

  return (
    <div
      className="group flex items-start gap-3 p-3 rounded-md bg-card border border-card-border transition-all duration-200"
      data-testid={`action-card-${index}`}
    >
      <div className="flex items-center gap-2 pt-1">
        <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
        <div className={`p-1.5 rounded-md bg-muted ${config.color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs font-mono">
            #{index + 1}
          </Badge>
          <span className="text-sm font-medium">{config.label}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(action.type === "click" || action.type === "type" || action.type === "select") && (
            <div>
              <Label className="text-xs text-muted-foreground">CSS Selector</Label>
              <Input
                placeholder="e.g. #submit-btn, .my-class"
                value={action.selector || ""}
                onChange={(e) => onUpdate(action.id, { selector: e.target.value })}
                className="h-8 text-sm font-mono"
                data-testid={`input-selector-${index}`}
              />
            </div>
          )}
          {(action.type === "type" || action.type === "select") && (
            <div>
              <Label className="text-xs text-muted-foreground">
                {action.type === "type" ? "Text to Type" : "Option Value"}
              </Label>
              <Input
                placeholder={action.type === "type" ? "Enter text..." : "option value"}
                value={action.value || ""}
                onChange={(e) => onUpdate(action.id, { value: e.target.value })}
                className="h-8 text-sm"
                data-testid={`input-value-${index}`}
              />
            </div>
          )}
          {action.type === "wait" && (
            <div>
              <Label className="text-xs text-muted-foreground">Wait Time (ms)</Label>
              <Input
                type="number"
                placeholder="1000"
                value={action.value || ""}
                onChange={(e) => onUpdate(action.id, { value: e.target.value })}
                className="h-8 text-sm"
                data-testid={`input-wait-${index}`}
              />
            </div>
          )}
          {action.type === "scroll" && (
            <div>
              <Label className="text-xs text-muted-foreground">Scroll Amount (px)</Label>
              <Input
                type="number"
                placeholder="500"
                value={action.value || ""}
                onChange={(e) => onUpdate(action.id, { value: e.target.value })}
                className="h-8 text-sm"
                data-testid={`input-scroll-${index}`}
              />
            </div>
          )}
          <div className={action.type === "screenshot" ? "col-span-full" : ""}>
            <Label className="text-xs text-muted-foreground">Description (optional)</Label>
            <Input
              placeholder="What does this step do?"
              value={action.description || ""}
              onChange={(e) => onUpdate(action.id, { description: e.target.value })}
              className="h-8 text-sm"
              data-testid={`input-desc-${index}`}
            />
          </div>
        </div>
      </div>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => onRemove(action.id)}
        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1"
        data-testid={`button-remove-action-${index}`}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function LogEntry({ log }: { log: TaskLog }) {
  const iconMap = {
    info: <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
    success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
    error: <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
  };

  const colorMap = {
    info: "text-foreground/80",
    success: "text-emerald-400",
    error: "text-red-400",
    warning: "text-amber-400",
  };

  return (
    <div className="flex items-start gap-2 py-1 px-2 font-mono text-xs leading-relaxed" data-testid={`log-entry-${log.id}`}>
      {iconMap[log.type]}
      <span className="text-muted-foreground shrink-0">
        {new Date(log.timestamp).toLocaleTimeString()}
      </span>
      {log.repetition !== undefined && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
          #{log.repetition}
        </Badge>
      )}
      <span className={colorMap[log.type]}>{log.message}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const config: Record<TaskStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    idle: { label: "Ready", variant: "secondary" },
    running: { label: "Running", variant: "default" },
    paused: { label: "Paused", variant: "outline" },
    completed: { label: "Completed", variant: "secondary" },
    error: { label: "Error", variant: "destructive" },
  };
  const c = config[status];
  return (
    <Badge variant={c.variant} data-testid="badge-status">
      {status === "running" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
      {c.label}
    </Badge>
  );
}

export default function Home() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [repetitions, setRepetitions] = useState(1);
  const [delayBetweenReps, setDelayBetweenReps] = useState(1000);
  const [proxyListUrl, setProxyListUrl] = useState("");
  const [progress, setProgress] = useState<TaskProgress>({
    status: "idle",
    currentRepetition: 0,
    totalRepetitions: 0,
    logs: [],
  });
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const addAction = (type: Action["type"]) => {
    const newAction: Action = {
      id: generateId(),
      type,
      selector: "",
      value: type === "wait" ? "1000" : type === "scroll" ? "500" : "",
      description: "",
    };
    setActions((prev) => [...prev, newAction]);
  };

  const updateAction = (id: string, updates: Partial<Action>) => {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const removeAction = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const pollProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/task/progress", { credentials: "include" });
      if (res.ok) {
        const data: TaskProgress = await res.json();
        setProgress(data);
        if (data.status === "completed" || data.status === "error") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [progress.logs.length]);

  const startTask = async () => {
    if (!url) {
      toast({ title: "URL Required", description: "Please enter a valid URL", variant: "destructive" });
      return;
    }
    if (actions.length === 0) {
      toast({ title: "Actions Required", description: "Add at least one action", variant: "destructive" });
      return;
    }

    for (const action of actions) {
      if ((action.type === "click" || action.type === "type" || action.type === "select") && !action.selector?.trim()) {
        toast({ title: "Missing Selector", description: `Action "${action.type}" (step #${actions.indexOf(action) + 1}) requires a CSS selector`, variant: "destructive" });
        return;
      }
      if ((action.type === "type" || action.type === "select") && !action.value?.trim()) {
        toast({ title: "Missing Value", description: `Action "${action.type}" (step #${actions.indexOf(action) + 1}) requires a value`, variant: "destructive" });
        return;
      }
    }

    try {
      const config: TaskConfig = {
        url,
        actions,
        repetitions,
        delayBetweenReps,
        proxyListUrl: proxyListUrl.trim() || undefined,
      };
      await apiRequest("POST", "/api/task/start", config);
      toast({ title: "Task Started", description: `Running ${repetitions} repetition(s)` });
      
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(pollProgress, 500);
      pollProgress();
    } catch (err: any) {
      toast({ title: "Failed to Start", description: err.message, variant: "destructive" });
    }
  };

  const stopTask = async () => {
    try {
      await apiRequest("POST", "/api/task/stop");
      toast({ title: "Task Stopped" });
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      pollProgress();
    } catch (err: any) {
      toast({ title: "Failed to Stop", description: err.message, variant: "destructive" });
    }
  };

  const progressPercent =
    progress.totalRepetitions > 0
      ? (progress.currentRepetition / progress.totalRepetitions) * 100
      : 0;

  const isRunning = progress.status === "running";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-title">
              Browser Automator
            </h1>
            <p className="text-sm text-muted-foreground">
              Automate browser actions with headless Chrome
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel - Configuration */}
          <div className="lg:col-span-3 space-y-4">
            {/* URL Input */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <Label className="text-sm font-semibold">Target URL</Label>
              </div>
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono text-sm"
                disabled={isRunning}
                data-testid="input-url"
              />
            </Card>

            {/* Settings Row */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings2 className="w-4 h-4 text-primary" />
                <Label className="text-sm font-semibold">Settings</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Repetitions</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Repeat className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={repetitions}
                      onChange={(e) => setRepetitions(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-8 text-sm"
                      disabled={isRunning}
                      data-testid="input-repetitions"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Delay between reps (ms)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      max={300000}
                      step={500}
                      value={delayBetweenReps}
                      onChange={(e) => setDelayBetweenReps(Math.max(0, parseInt(e.target.value) || 0))}
                      className="h-8 text-sm"
                      disabled={isRunning}
                      data-testid="input-delay"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Proxy */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <Label className="text-sm font-semibold">Proxy (IP Rotation)</Label>
                <Badge variant="outline" className="text-xs">
                  {proxyListUrl ? "Active" : "Off"}
                </Badge>
              </div>
              <Input
                placeholder="Paste your Webshare proxy list URL here..."
                value={proxyListUrl}
                onChange={(e) => setProxyListUrl(e.target.value)}
                className="font-mono text-xs"
                disabled={isRunning}
                data-testid="input-proxy-url"
              />
              <p className="text-xs text-muted-foreground">
                Each repetition will use a different proxy IP to avoid detection. Get free proxies from webshare.io
              </p>
            </Card>

            {/* Actions */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-semibold">Actions</Label>
                  <Badge variant="outline" className="text-xs">
                    {actions.length}
                  </Badge>
                </div>
              </div>

              {/* Add action buttons */}
              <div className="flex flex-wrap gap-2">
                {(Object.entries(actionTypeConfig) as [Action["type"], typeof actionTypeConfig.click][]).map(
                  ([type, config]) => {
                    const Icon = config.icon;
                    return (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => addAction(type)}
                        disabled={isRunning}
                        data-testid={`button-add-${type}`}
                      >
                        <Icon className={`w-3.5 h-3.5 mr-1.5 ${config.color}`} />
                        {config.label}
                      </Button>
                    );
                  }
                )}
              </div>

              <Separator />

              {/* Action list */}
              {actions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground" data-testid="text-empty-actions">
                  <Plus className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No actions yet. Add actions above to build your automation.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {actions.map((action, i) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      index={i}
                      onUpdate={updateAction}
                      onRemove={removeAction}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Start/Stop */}
            <div className="flex gap-3">
              {!isRunning ? (
                <Button
                  onClick={startTask}
                  disabled={actions.length === 0 || !url}
                  className="flex-1"
                  data-testid="button-start"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Automation
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={stopTask}
                  className="flex-1"
                  data-testid="button-stop"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              )}
            </div>
          </div>

          {/* Right Panel - Progress & Logs */}
          <div className="lg:col-span-2 space-y-4">
            {/* Progress */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="text-sm font-semibold">Progress</Label>
                <StatusBadge status={progress.status} />
              </div>

              <Progress value={progressPercent} className="h-2" data-testid="progress-bar" />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span data-testid="text-progress">
                  {progress.currentRepetition} / {progress.totalRepetitions} repetitions
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>

              {progress.startedAt && (
                <div className="text-xs text-muted-foreground">
                  Started: {new Date(progress.startedAt).toLocaleTimeString()}
                </div>
              )}
              {progress.completedAt && (
                <div className="text-xs text-muted-foreground">
                  Completed: {new Date(progress.completedAt).toLocaleTimeString()}
                </div>
              )}
              {progress.error && (
                <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded-md" data-testid="text-error">
                  {progress.error}
                </div>
              )}
            </Card>

            {/* Logs */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <Label className="text-sm font-semibold">Logs</Label>
                <Badge variant="outline" className="text-xs">
                  {progress.logs.length}
                </Badge>
              </div>

              <div className="bg-muted/50 rounded-md border border-border">
                <ScrollArea className="h-[400px]" data-testid="logs-scroll">
                  {progress.logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-16">
                      Logs will appear here...
                    </div>
                  ) : (
                    <div className="py-1">
                      {progress.logs.map((log) => (
                        <LogEntry key={log.id} log={log} />
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
