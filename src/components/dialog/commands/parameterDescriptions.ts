import { xanCommands } from "@/data/commands";
import type { EffectiveLanguage } from "@/i18n/translations";

export function getParameterDescription(
  commandId: string,
  paramName: string,
  language: EffectiveLanguage = "en",
): string {
  const command = xanCommands.find((c) => c.id === commandId);
  if (!command) return "";
  const param = command.parameters.find((p) => p.name === paramName);
  if (!param) return "";
  return language === "zh"
    ? param.descriptionCn || param.description
    : param.description;
}
