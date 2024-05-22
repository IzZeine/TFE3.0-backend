export function generateRandomIndexForKey(rowCount) {
  const num = Math.floor(Math.random() * rowCount);
  return num === 0 || num === 19 ? generateRandomIndexForKey() : num;
}
