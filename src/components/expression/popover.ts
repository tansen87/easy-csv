export const POPOVER_WIDTH = 420;
export const POPOVER_ROW_HEIGHT = 28;
export const POPOVER_MIN_ROWS = 3;
export const POPOVER_MAX_ROWS = 6;
/** 4px list padding above + below, plus the 32px footer. */
export const POPOVER_CHROME = 40;

export interface PopoverPlacement {
  above: boolean;
  offset: number;
  left: number;
  width: number;
  listHeight: number;
}

/**
 * Caret offset (from the textarea's border box) at `pos`, plus the line
 * height. Measured on a hidden mirror with the textarea's own text metrics so
 * wrapped lines are accounted for — the popover can then sit under the word
 * being typed instead of below the whole editor.
 */
export function caretPosition(
  ta: HTMLTextAreaElement,
  pos: number,
): { top: number; left: number; lineHeight: number } {
  const cs = window.getComputedStyle(ta);
  const borderTop = parseFloat(cs.borderTopWidth) || 0;
  const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
  const mirror = document.createElement("div");
  mirror.style.position = "absolute";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.visibility = "hidden";
  mirror.style.boxSizing = "border-box";
  mirror.style.width = `${ta.clientWidth}px`;
  mirror.style.borderWidth = "0";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-all";
  for (const prop of [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "lineHeight",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "tabSize",
    "textIndent",
  ] as const) {
    mirror.style[prop] = cs[prop];
  }
  mirror.textContent = ta.value.slice(0, pos);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop + borderTop;
  const left = marker.offsetLeft + borderLeft;
  document.body.removeChild(mirror);
  return {
    top,
    left,
    lineHeight: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 20,
  };
}

/**
 * Place an autocomplete popover next to the word starting at `wordStartPos`:
 * under the caret when there is room, above it otherwise, clamped to the
 * editor and to the surrounding scroll viewport. Rows come in whole steps of
 * 28px (3–6 rows), so the list never ends on a half row.
 */
export function measurePopover(
  ta: HTMLTextAreaElement,
  wordStartPos: number,
): PopoverPlacement {
  const caret = caretPosition(ta, ta.selectionStart ?? ta.value.length);
  const wordStart = caretPosition(ta, wordStartPos);
  const visibleTop = caret.top - ta.scrollTop;
  const boxHeight = ta.offsetHeight;
  const gap = 4;
  // Stay inside the dialog's scroll viewport too, not just the editor box.
  const viewport = ta.closest<HTMLElement>(
    "[data-radix-scroll-area-viewport]",
  );
  const caretPageTop = ta.getBoundingClientRect().top + visibleTop;
  const pageBottom = viewport
    ? viewport.getBoundingClientRect().bottom
    : window.innerHeight;
  const pageTop = viewport ? viewport.getBoundingClientRect().top : 0;
  const below = Math.min(
    boxHeight - visibleTop - caret.lineHeight - gap,
    pageBottom - caretPageTop - caret.lineHeight - gap,
  );
  const above = Math.min(visibleTop - gap, caretPageTop - pageTop - gap);

  const width = Math.min(POPOVER_WIDTH, ta.clientWidth - 8);
  const left = Math.max(
    0,
    Math.min(wordStart.left - ta.scrollLeft, ta.clientWidth - width),
  );
  const aboveCaret = !(
    below >= POPOVER_MIN_ROWS * POPOVER_ROW_HEIGHT + POPOVER_CHROME ||
    below >= above
  );
  const available = aboveCaret ? above : below;
  const rows = Math.max(
    POPOVER_MIN_ROWS,
    Math.min(
      POPOVER_MAX_ROWS,
      Math.floor((available - POPOVER_CHROME) / POPOVER_ROW_HEIGHT),
    ),
  );

  return {
    above: aboveCaret,
    offset: aboveCaret
      ? boxHeight - visibleTop + gap
      : visibleTop + caret.lineHeight + gap,
    left,
    width,
    listHeight: rows * POPOVER_ROW_HEIGHT + 8,
  };
}
