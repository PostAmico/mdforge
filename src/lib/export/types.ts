/**
 * Public option types shared by the PDF and DOCX exporters.
 */

export interface ExportOptions {
  /** Document title. Used in metadata and (DOCX) the page header. */
  title?: string;
  /** Document author, written to file metadata. */
  author?: string;
  /**
   * When true, throw if a chart block is present but the optional `canvas`
   * package isn't installed. Default false: charts are skipped, everything
   * else exports normally.
   */
  strictCharts?: boolean;
}

/** Accept either a bare title string (legacy) or a full options object. */
export type ExportInput = string | ExportOptions;

/** Normalize the second argument of an exporter into a consistent options object. */
export function resolveExportOptions(
  input: ExportInput | undefined,
  defaults: { title: string },
): Required<Pick<ExportOptions, "title">> & ExportOptions {
  if (typeof input === "string") {
    return { title: input || defaults.title };
  }
  return {
    title: input?.title || defaults.title,
    author: input?.author,
    strictCharts: input?.strictCharts,
  };
}
