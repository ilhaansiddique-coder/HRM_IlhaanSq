const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const DEFAULT_LOCAL_API_PORT = "3201";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isLocalHostname = (hostname: string) => LOCAL_HOSTNAMES.has(hostname.toLowerCase());

const adaptUrlForLanAccess = (rawUrl: string): string => {
  if (typeof window === "undefined") {
    return rawUrl;
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const browserHostname = window.location.hostname;

    if (!isLocalHostname(parsedUrl.hostname) || isLocalHostname(browserHostname)) {
      return rawUrl;
    }

    parsedUrl.hostname = browserHostname;
    return parsedUrl.toString();
  } catch {
    return rawUrl;
  }
};

export const resolveApiBaseUrl = (configuredApiUrl?: string): string => {
  if (configuredApiUrl) {
    return trimTrailingSlash(adaptUrlForLanAccess(configuredApiUrl));
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return trimTrailingSlash(`${protocol}//${window.location.hostname}:${DEFAULT_LOCAL_API_PORT}/api`);
  }

  return `http://localhost:${DEFAULT_LOCAL_API_PORT}/api`;
};

export const resolveAppBaseUrl = (configuredAppUrl?: string): string => {
  if (configuredAppUrl) {
    return trimTrailingSlash(adaptUrlForLanAccess(configuredAppUrl));
  }

  if (typeof window !== "undefined") {
    return trimTrailingSlash(window.location.origin);
  }

  return "http://localhost:3000";
};
