import { useEffect } from 'react';

const SHOW_FOR_MS = 4000;

export default function Toast({ message, onClose }) {
  useEffect(function () {
    if (!message.text) {
      return undefined;
    }
    const timer = setTimeout(onClose, SHOW_FOR_MS);
    return function () {
      clearTimeout(timer);
    };
  }, [message, onClose]);

  if (!message.text) {
    return null;
  }

  return (
    <div className={'toast toast-' + message.type} role="status">
      <span>{message.text}</span>
      <button type="button" className="toast-close" aria-label="Close" onClick={onClose}>×</button>
    </div>
  );
}
