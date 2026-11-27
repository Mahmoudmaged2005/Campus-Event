export function replaceById(items, changedItem) {
  const result = [];
  for (const item of items) {
    if (item.id === changedItem.id) {
      result.push({ ...item, ...changedItem });
    } else {
      result.push(item);
    }
  }
  return result;
}

export function removeById(items, id) {
  const result = [];
  for (const item of items) {
    if (item.id !== id) {
      result.push(item);
    }
  }
  return result;
}
