export function formatCents(cents: number) {
  return `${cents.toLocaleString("en-US")}¢`;
}

export function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function toDateTimeLocal(value: Date | string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
