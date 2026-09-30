export type TenantScope = {
  organizationId: string;
  studioId: string;
  roomId?: string;
};

const safeId = /^[A-Za-z0-9._:-]{6,128}$/;

export function validateTenantScope(scope: TenantScope) {
  if (!safeId.test(scope.organizationId)) throw new Error("Invalid organizationId");
  if (!safeId.test(scope.studioId)) throw new Error("Invalid studioId");
  if (scope.roomId !== undefined && !safeId.test(scope.roomId)) throw new Error("Invalid roomId");
  return scope;
}

export function tenantKey(scope: TenantScope) {
  const valid = validateTenantScope(scope);
  return [valid.organizationId, valid.studioId, valid.roomId || "-"].join("/");
}

export function sameStudio(a: TenantScope, b: TenantScope) {
  return a.organizationId === b.organizationId && a.studioId === b.studioId;
}

export function sameRoom(a: TenantScope, b: TenantScope) {
  return sameStudio(a, b) && !!a.roomId && a.roomId === b.roomId;
}
