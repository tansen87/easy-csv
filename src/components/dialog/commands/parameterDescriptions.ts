import { xanCommands } from "@/data/commands";

export function getParameterDescription(
  commandId: string,
  paramName: string,
  language: "en" | "zh" = "en",
): string {
  const command = xanCommands.find((c) => c.id === commandId);
  if (!command) return "";
  const param = command.parameters.find((p) => p.name === paramName);
  if (!param) return "";
  return language === "zh"
    ? param.descriptionCn || param.description
    : param.description;
}
