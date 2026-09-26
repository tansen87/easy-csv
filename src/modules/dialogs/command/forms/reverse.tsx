import { CommandFormProps } from "@/types/dialog";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";

export function ReverseForm(props: CommandFormProps) {
  return (
    <CommandFormShell {...props}>
      <></>
    </CommandFormShell>
  );
}
