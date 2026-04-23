type LogPayload = unknown[];
type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|cookie|apikey|api_key)/i;
const MAX_SERIALIZED_LENGTH = 8_000;
const REMOTE_LOG_TIMEOUT_MS = 3_000;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const resolveConfiguredLevel = (): LogLevel => {
  const rawLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL ?? "").toLowerCase();
  if (rawLevel === "debug" || rawLevel === "info" || rawLevel === "warn" || rawLevel === "error") {
    return rawLevel;
  }
  return process.env.NODE_ENV === "development" ? "debug" : "info";
};

const configuredLevel = resolveConfiguredLevel();
const remoteLogEndpoint = (process.env.NEXT_PUBLIC_LOG_ENDPOINT ?? "").trim();

const redactObject = (input: unknown, depth = 0): unknown => {
  if (input === null || input === undefined) return input;
  if (depth > 5) return "[Truncated]";
  if (typeof input === "string") {
    return input.length > 1000 ? `${input.slice(0, 1000)}...[truncated]` : input;
  }
  if (typeof input !== "object") return input;

  if (Array.isArray(input)) {
    return input.map((entry) => redactObject(entry, depth + 1));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      redacted[key] = "[REDACTED]";
      continue;
    }
    redacted[key] = redactObject(value, depth + 1);
  }
  return redacted;
};

const shouldLog = (level: LogLevel): boolean =>
  LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel];

const serializeForRemote = (args: LogPayload): string => {
  try {
    const serialized = JSON.stringify(args.map((arg) => redactObject(arg)));
    if (serialized.length > MAX_SERIALIZED_LENGTH) {
      return `${serialized.slice(0, MAX_SERIALIZED_LENGTH)}...[truncated]`;
    }
    return serialized;
  } catch {
    return JSON.stringify(["[Unserializable log payload]"]);
  }
};

const sendRemoteLog = (level: LogLevel, args: LogPayload): void => {
  if (!remoteLogEndpoint || typeof window === "undefined") return;
  if (level !== "warn" && level !== "error") return;

  const body = JSON.stringify({
    level,
    message: serializeForRemote(args),
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  });

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REMOTE_LOG_TIMEOUT_MS);
    void fetch(remoteLogEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      signal: controller.signal,
    }).finally(() => {
      window.clearTimeout(timeout);
    });
  } catch {
    // Never throw from logger.
  }
};

const writeLog = (level: LogLevel, args: LogPayload): void => {
  if (!shouldLog(level)) return;
  const logger = console[level] ?? console.log;
  logger(...args.map((arg) => redactObject(arg)));
  sendRemoteLog(level, args);
};

export const appLogger = {
  debug: (...args: LogPayload) => writeLog("debug", args),
  info: (...args: LogPayload) => writeLog("info", args),
  warn: (...args: LogPayload) => writeLog("warn", args),
  error: (...args: LogPayload) => writeLog("error", args),
};

let errorReportingInitialized = false;

export const initClientErrorReporting = () => {
  if (typeof window === "undefined" || errorReportingInitialized) return;
  errorReportingInitialized = true;

  window.addEventListener("error", (event) => {
    appLogger.error("window.error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error
      ? { message: event.reason.message, stack: event.reason.stack }
      : event.reason;
    appLogger.error("window.unhandledrejection", reason);
  });
};
