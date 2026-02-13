import { ApiError } from "@/lib/types";

export interface ErrorDisplay {
  title: string;
  message: string;
  icon: "lock" | "shield" | "search" | "clock" | "server" | "alert";
}

const ERROR_MESSAGES: Record<number, ErrorDisplay> = {
  401: {
    title: "Session Expired",
    message: "Oops! Your session expired. Please log in again.",
    icon: "lock",
  },
  403: {
    title: "Access Denied",
    message: "Access denied. You don't have permission for this.",
    icon: "shield",
  },
  404: {
    title: "Not Found",
    message: "We couldn't find what you're looking for.",
    icon: "search",
  },
  429: {
    title: "Daily limit reached",
    message: "Come back tomorrow to continue.",
    icon: "clock",
  },
  500: {
    title: "Server Error",
    message: "Houston, we have a problem... Our servers hit a snag.",
    icon: "server",
  },
};

const DEFAULT_ERROR: ErrorDisplay = {
  title: "Something went wrong",
  message: "An unexpected error occurred.",
  icon: "alert",
};

export function getErrorDisplay(error: ApiError | Error | string): ErrorDisplay {
  if (typeof error === "string") {
    return { ...DEFAULT_ERROR, message: error };
  }

  if (error instanceof ApiError) {
    const mapping = ERROR_MESSAGES[error.status];
    if (mapping) {
      return mapping;
    }
    return { ...DEFAULT_ERROR, message: error.message };
  }

  if (error instanceof Error) {
    return { ...DEFAULT_ERROR, message: error.message };
  }

  return DEFAULT_ERROR;
}

export function getStatusCodeFromError(error: ApiError | Error | string): number | null {
  if (error instanceof ApiError) {
    return error.status;
  }
  return null;
}
