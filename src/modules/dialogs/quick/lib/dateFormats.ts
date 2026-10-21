/** Date format choices carried over from the v0.5.0 date-transform dialog. */
export const DATE_FORMATS = [
  { label: "YYYYMMDD", value: "%Y%m%d" },
  { label: "YYYYMMDDHHMMSS", value: "%Y%m%d%H%M%S" },
  { label: "YYYYMMDDHHMM", value: "%Y%m%d%H%M" },
  { label: "DDMMYYYY", value: "%d%m%Y" },
  { label: "DDMMYYYYHHMMSS", value: "%d%m%Y%H%M%S" },
  { label: "MMDDYYYY", value: "%m%d%Y" },
  { label: "MMDDYYYYHHMMSS", value: "%m%d%Y%H%M%S" },

  // YMD
  { label: "YYYY-MM-DD", value: "%Y-%m-%d" },
  { label: "YYYY/MM/DD", value: "%Y/%m/%d" },
  { label: "YYYY-MM-DD HH:mm:ss", value: "%Y-%m-%d %H:%M:%S" },
  { label: "YYYY/MM/DD HH:mm:ss", value: "%Y/%m/%d %H:%M:%S" },

  // YDM
  { label: "YYYY-DD-MM", value: "%Y-%d-%m" },
  { label: "YYYY/DD/MM", value: "%Y/%d/%m" },
  { label: "YYYY-DD-MM HH:mm:ss", value: "%Y-%d-%m %H:%M:%S" },
  { label: "YYYY/DD/MM HH:mm:ss", value: "%Y/%d/%m %H:%M:%S" },

  // MDY
  { label: "MM-DD-YYYY", value: "%m-%d-%Y" },
  { label: "MM/DD/YYYY", value: "%m/%d/%Y" },
  { label: "MM-DD-YYYY HH:mm:ss", value: "%m-%d-%Y %H:%M:%S" },
  { label: "MM/DD/YYYY HH:mm:ss", value: "%m/%d/%Y %H:%M:%S" },

  // MYD
  { label: "MM-YYYY-DD", value: "%m-%Y-%d" },
  { label: "MM/YYYY/DD", value: "%m/%Y/%d" },
  { label: "MM-YYYY-DD HH:mm:ss", value: "%m-%Y-%d %H:%M:%S" },
  { label: "MM/YYYY/DD HH:mm:ss", value: "%m/%Y/%d %H:%M:%S" },

  // DMY
  { label: "DD-MM-YYYY", value: "%d-%m-%Y" },
  { label: "DD/MM/YYYY", value: "%d/%m/%Y" },
  { label: "DD-MM-YYYY HH:mm:ss", value: "%d-%m-%Y %H:%M:%S" },
  { label: "DD/MM/YYYY HH:mm:ss", value: "%d/%m/%Y %H:%M:%S" },

  // DYM
  { label: "DD-YYYY-MM", value: "%d-%Y-%m" },
  { label: "DD/YYYY/MM", value: "%d/%Y/%m" },
  { label: "DD-YYYY-MM HH:mm:ss", value: "%d-%Y-%m %H:%M:%S" },
  { label: "DD/YYYY/MM HH:mm:ss", value: "%d/%Y/%m %H:%M:%S" },
];

export const DATE_INPUT_DEFAULT = "%Y%m%d";
export const DATE_OUTPUT_DEFAULT = "%d/%m/%Y";
export const DATE_OUTPUT_COLUMN_DEFAULT = "new_date";
