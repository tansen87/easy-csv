/**
 * Right-hand dock identities (design 076).
 *
 * The id lives here rather than next to the panel registry so `components/`
 * can name a panel without importing business code (019 §5.2 forbids that).
 */

export type ViewPanelId =
  | "profile"
  | "version"
  | "lineage"
  | "variables"
  | "ledger";

/** One row of the View menu; the app shell builds these from the registry. */
export interface ViewPanelMenuItem {
  id: ViewPanelId;
  label: string;
  /** Keycap shown after "Alt". */
  key: string;
  /** 数据概览 needs an input file; the other three always open. */
  disabled?: boolean;
}
