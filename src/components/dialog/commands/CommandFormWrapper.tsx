import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CommandDialogState } from "@/components/dialog/CommandDialog";
import { XanCommand } from "@/types/xan";
import { handleCommandSubmit } from "@/components/dialog/commands/helpers";

interface CommandFormWrapperProps {
  commandDialog: CommandDialogState;
  onAddCommand: (command: XanCommand, params?: Record<string, any>) => void;
  onStepUpdate?: (stepId: string, params: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
  disabled?: boolean;
  children?: ReactNode;
  scrollHeight?: string;
}

export function CommandFormWrapper({
  commandDialog,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
  disabled,
  children,
  scrollHeight,
}: CommandFormWrapperProps) {
  const content = <div className="space-y-3 pr-2.5">{children}</div>;

  const buttons = (
    <div className="flex justify-end gap-2 mt-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setCommandDialog(null)}
      >
        Cancel
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          handleCommandSubmit({
            commandDialog,
            onAddCommand,
            onStepUpdate,
            setCommandDialog,
          })
        }
        disabled={disabled}
      >
        {commandDialog.isUpdate ? "Update" : "Add"}
      </Button>
    </div>
  );

  if (scrollHeight) {
    return (
      <>
        <ScrollArea className={`h-[${scrollHeight}]`}>{content}</ScrollArea>
        {buttons}
      </>
    );
  }

  return (
    <>
      {content}
      {buttons}
    </>
  );
}
