import type { CommandFormProps } from "@/types/dialog";
import { COMMAND_FORMS } from "@/modules/dialogs/command";
import {
  ParamSheet,
  usesParamSheet,
} from "@/modules/dialogs/command/ParamSheet";

/**
 * The parameter editor itself (design 081): the single mount point for the
 * anchored popover, so every command renders through the same path.
 */
export function CommandFormBody(props: CommandFormProps) {
  const { commandDialog } = props;

  if (usesParamSheet(commandDialog.type)) {
    // Remount per command so editor state never leaks between them.
    return <ParamSheet key={commandDialog.type} {...props} />;
  }

  const FormComponent = COMMAND_FORMS[commandDialog.type];
  return FormComponent ? <FormComponent {...props} /> : null;
}
