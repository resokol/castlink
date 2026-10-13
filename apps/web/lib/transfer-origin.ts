/** Only authenticated server configuration/results may supply approved origins. */
export function parseTransferOrigin(value: string): string {
  const url = new URL(value);
  const development = ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(development && url.protocol === "http:")) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Адрес переноса должен быть чистым HTTPS origin.");
  return url.origin;
}
