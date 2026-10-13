/** Guest invitations keep their credential fragment when embedded on the home page. */
export function roomEntryInviteUrl(path: string, origin: string, entryPath?: string) {
  const url = new URL(path, origin);
  if (entryPath === "/") {
    url.pathname = "/";
    url.searchParams.set("mode", "guest");
  }
  return url.toString();
}
