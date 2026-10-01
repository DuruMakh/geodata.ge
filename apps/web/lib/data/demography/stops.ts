/**
 * Every way preparation refuses to continue. Each is a stop-and-review event: the pipeline never
 * repairs data, guesses a label, or lets a changed value through without a human looking at it.
 */
export const STOP_CONDITIONS = [
  /** A unit or citizenship label that no reviewed file knows. */
  "unreviewed_label",
  /** A sheet, header, row order or column block that differs from the reviewed layout. */
  "layout_changed",
  /** Text other than the reviewed missing marker where a number belongs. */
  "unexpected_cell",
  /** A stored value that is not a whole number of persons: a display-rounded or re-scaled value. */
  "not_whole_person",
  /** A value that is required for a served row but blank. */
  "missing_served_cell",
  /** A value where none is allowed: an excluded unit, or a city row outside its published years. */
  "unexpected_value",
  /** An exact identity (parts to whole, natural increase, migration) that does not hold. */
  "identity_failed",
  /** A balancing residual other than the reviewed census step. */
  "balancing_residual",
  /** The census step no longer equals the recalculation Geostat published. */
  "census_residual_changed",
  /** The census count and the 1 January values disagree beyond the reviewed bounds. */
  "census_anchor",
  /** A published rate that no longer matches its counts within the published rounding. */
  "rate_deviation",
  /** A previously captured value that changed. */
  "revision",
] as const;

export type StopCondition = (typeof STOP_CONDITIONS)[number];

export class DemographyStopError extends Error {
  constructor(
    readonly condition: StopCondition,
    message: string,
  ) {
    super(message);
    this.name = "DemographyStopError";
  }
}
