import type { CommandFormProps } from "@/types/dialog";
import { COMMAND_FORMS } from "@/modules/dialogs/command";
import {
  ParamSheet,
  usesParamSheet,
} from "@/modules/dialogs/command/ParamSheet";

/**
 * The parameter editor itself (design 081): shared by the right-hand inspector
 * (A) and the wide split dialog (D) so both mount exactly the same form.
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
