export function initialsOf(name) {
  const parts = name.trim().split(' ');
  let initials = parts[0].charAt(0);
  if (parts.length > 1) {
    initials = initials + parts[parts.length - 1].charAt(0);
  }
  return initials.toUpperCase();
}
