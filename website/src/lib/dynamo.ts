// Shared Dynamo error classification.
export function isConditionFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "ConditionalCheckFailedException") return true;
  if (err.name !== "TransactionCanceledException") return false;
  // A transact cancellation is a benign race only when every per-item reason
  // is a condition failure; throttling/conflict/validation must surface.
  const reasons = (err as { CancellationReasons?: { Code?: string }[] }).CancellationReasons;
  return !!reasons && reasons.every((r) => !r.Code || r.Code === "ConditionalCheckFailed" || r.Code === "None");
}
