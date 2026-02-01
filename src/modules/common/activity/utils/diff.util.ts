export function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, unknown> {
  if (!before && !after) {
    return {};
  }

  if (!before) {
    return after || {};
  }

  if (!after) {
    return before || {};
  }

  const changedFields: Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  const excludedFields = new Set(['createdAt', 'updatedAt', 'id']);

  for (const key of allKeys) {
    if (excludedFields.has(key)) {
      continue;
    }

    const beforeValue = before[key];
    const afterValue = after[key];

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changedFields[key] = {
        before: beforeValue,
        after: afterValue,
      };
    }
  }

  return changedFields;
}
