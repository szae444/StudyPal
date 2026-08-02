import { useState } from 'react';

// Note: parents should pass a `key` derived from the item being confirmed
// (e.g. an id) so this component remounts with a fresh `value` per open,
// instead of syncing defaultValue via an effect.
export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    showInput = false,
    inputPlaceholder = '',
    defaultValue = '',
    danger = false,
    onConfirm,
    onCancel,
}) {
    const [value, setValue] = useState(defaultValue);

    if (!open) return null;

    return (
        <div className="dialog-overlay" onClick={onCancel}>
            <div className="dialog-panel" onClick={(e) => e.stopPropagation()}>
                <div className="dialog-title">{title}</div>
                {message && <p className="dialog-message">{message}</p>}
                {showInput && (
                    <textarea
                        className="dialog-input"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={inputPlaceholder}
                        autoFocus
                    />
                )}
                <div className="dialog-actions">
                    <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
                    <button
                        className="btn-primary"
                        style={danger ? { background: 'var(--error)', borderColor: 'var(--error)' } : undefined}
                        onClick={() => onConfirm(showInput ? value : undefined)}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
