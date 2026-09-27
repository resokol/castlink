/** Read a Studio Control JSON response without exposing parser errors or server HTML. */
export async function readControlResponse(response: Response, fallback: string): Promise<any> {
  let payload: unknown;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    payload = undefined;
  }

  const data = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : undefined;

  if (!response.ok) {
    const apiError = typeof data?.error === "string" && data.error.trim() ? data.error : undefined;
    throw new Error(apiError || `${fallback} (HTTP ${response.status}).`);
  }
  if (!data) throw new Error(`Сервер вернул пустой или некорректный ответ (HTTP ${response.status}).`);
  return data;
}
