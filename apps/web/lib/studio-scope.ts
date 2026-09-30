const studioIdPattern = /^[A-Za-z0-9._:-]{6,128}$/;

export function defaultStudioId() {
  const value = process.env.STUDIOLINK_DEFAULT_STUDIO_ID?.trim() || "studio-default";
  return validateStudioId(value);
}

export function validateStudioId(value: string) {
  const clean = value.trim();
  if (!studioIdPattern.test(clean)) throw new Error("Invalid studioId");
  return clean;
}
