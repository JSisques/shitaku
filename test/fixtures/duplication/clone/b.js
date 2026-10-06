export function duplicatedHelper(value) {
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return {
    value: normalized,
    length: normalized.length,
    chars: normalized.split(''),
  };
}
