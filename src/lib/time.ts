import { format } from "date-fns";

export const toZonedDate = (date: Date, timeZone?: string): Date => {
  if (!timeZone) return date;
  try {
    return new Date(date.toLocaleString("en-US", { timeZone }));
  } catch {
    return date;
  }
};

export const getTimeBasedGreeting = (timeZone?: string): string => {
  const date = toZonedDate(new Date(), timeZone);
  const hour = date.getHours();
  
  if (hour < 12) {
    return "Good Morning";
  } else if (hour < 17) {
    return "Good Afternoon";
  } else if (hour < 21) {
    return "Good Evening";
  } else {
    return "Good Night";
  }
};

export const formatDate = (
  date: Date,
  dateFormat: string = "dd/MM/yyyy",
  timeZone?: string,
): string => {
  try {
    return format(toZonedDate(date, timeZone), dateFormat);
  } catch (error) {
    return format(toZonedDate(date, timeZone), "dd/MM/yyyy"); // fallback format
  }
};

export const formatTime = (
  date: Date,
  timeFormat: string = "12h",
  timeZone?: string,
): string => {
  const zonedDate = toZonedDate(date, timeZone);
  if (timeFormat === "24h") {
    return format(zonedDate, "HH:mm");
  } else {
    return format(zonedDate, "hh:mm a");
  }
};

export const formatInTimeZone = (
  date: Date,
  dateFormat: string,
  timeZone?: string,
): string => {
  try {
    return format(toZonedDate(date, timeZone), dateFormat);
  } catch {
    return format(date, dateFormat);
  }
};

export const toIsoFromDateInput = (
  value?: string,
  timeZone?: string,
): string | undefined => {
  if (!value) return undefined;
  const nowZoned = toZonedDate(new Date(), timeZone);
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return undefined;
  const combined = new Date(
    year,
    month - 1,
    day,
    nowZoned.getHours(),
    nowZoned.getMinutes(),
    nowZoned.getSeconds(),
    nowZoned.getMilliseconds(),
  );
  return combined.toISOString();
};
