import { XanCommand } from "@/types/xan";
import { xanCommands } from "@/data/commands";
import { CommandDialogState } from "@/components/dialog/CommandDialog";

export function handleCommandSubmit({
  commandDialog,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
}: {
  commandDialog: CommandDialogState;
  onAddCommand: (command: XanCommand, params?: Record<string, any>) => void;
  onStepUpdate?: (stepId: string, params: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
}) {
  if (commandDialog.isUpdate && commandDialog.stepId && onStepUpdate) {
    onStepUpdate(commandDialog.stepId, commandDialog.params);
  } else {
    const cmd = xanCommands.find((c) => c.id === commandDialog.type);
    if (cmd) {
      const params = {
        ...cmd.parameters.reduce(
          (acc, param) => {
            acc[param.name] = param.default;
            return acc;
          },
          {} as Record<string, any>,
        ),
        ...commandDialog.params,
      };
      onAddCommand(cmd, params);
    }
  }
  setCommandDialog(null);
}

export function updateParam(
  commandDialog: CommandDialogState,
  setCommandDialog: (d: CommandDialogState | null) => void,
  key: string,
  value: any,
) {
  setCommandDialog({
    ...commandDialog,
    params: { ...commandDialog.params, [key]: value },
  });
}
