import { useState } from 'react';

export function ErrorPanel({ message, details }: { message: string; details?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="error-panel">
      <strong>{message}</strong>
      {details ? (
        <>
          <button type="button" className="link-button" onClick={() => setOpen((value) => !value)}>
            {open ? 'Скрыть детали' : 'Показать детали'}
          </button>
          {open ? <p>{details}</p> : null}
        </>
      ) : null}
    </section>
  );
}
