export type DeploymentModel = "self-hosted" | "legacy";

export function deploymentModel(): DeploymentModel {
  const value = process.env.CASTLINK_DEPLOYMENT_MODEL?.trim();
  if (!value || value === "self-hosted") return "self-hosted";
  if (value === "legacy") return "legacy";
  throw new Error("Unsupported deployment model");
}
