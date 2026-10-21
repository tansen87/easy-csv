import { FilterQuickForm } from "@/modules/dialogs/quick/forms/FilterQuickForm";
import { SortQuickForm } from "@/modules/dialogs/quick/forms/SortQuickForm";
import { ReplaceQuickForm } from "@/modules/dialogs/quick/forms/ReplaceQuickForm";
import { PivotQuickForm } from "@/modules/dialogs/quick/forms/PivotQuickForm";
import { DateQuickForm } from "@/modules/dialogs/quick/forms/DateQuickForm";
import { TextTransformQuickForm } from "@/modules/dialogs/quick/forms/TextTransformQuickForm";
import { NumberTransformQuickForm } from "@/modules/dialogs/quick/forms/NumberTransformQuickForm";
import { SliceQuickForm } from "@/modules/dialogs/quick/forms/SliceQuickForm";
import { PadQuickForm } from "@/modules/dialogs/quick/forms/PadQuickForm";
import { WindowQuickForm } from "@/modules/dialogs/quick/forms/WindowQuickForm";
import { BatchFilterQuickForm } from "@/modules/dialogs/quick/forms/BatchFilterQuickForm";
import type { QuickFormProps } from "@/modules/dialogs/quick/types";

/** Chooses the guided form for the context menu entry the user clicked. */
export function QuickActionDialog(props: QuickFormProps) {
  switch (props.request.kind) {
    case "filter":
      return <FilterQuickForm {...props} />;
    case "sort":
      return <SortQuickForm {...props} />;
    case "replace":
      return <ReplaceQuickForm {...props} />;
    case "pivot":
      return <PivotQuickForm {...props} />;
    case "date":
      return <DateQuickForm {...props} />;
    case "text-transform":
      return <TextTransformQuickForm {...props} />;
    case "number-transform":
      return <NumberTransformQuickForm {...props} />;
    case "slice":
      return <SliceQuickForm {...props} />;
    case "pad":
      return <PadQuickForm {...props} />;
    case "window":
      return <WindowQuickForm {...props} />;
    case "batch-filter":
      return <BatchFilterQuickForm {...props} />;
    default:
      return null;
  }
}
