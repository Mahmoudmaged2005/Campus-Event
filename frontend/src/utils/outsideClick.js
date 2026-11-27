export function listenForOutsideClick(boxId, onOutside) {
  function handleMouseDown(mouseEvent) {
    if (!mouseEvent.target.closest('#' + boxId)) {
      onOutside();
    }
  }

  function handleKeyDown(keyEvent) {
    if (keyEvent.key === 'Escape') {
      onOutside();
    }
  }

  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('keydown', handleKeyDown);

  return function stopListening() {
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('keydown', handleKeyDown);
  };
}
