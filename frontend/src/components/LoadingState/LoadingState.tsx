import { useEffect, useState } from 'react';

export function LoadingState() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsSlow(true), 8000);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div className="loading-state">
      <strong>Загружаем меню...</strong>
      {isSlow ? <span>Google Sheets может отвечать дольше обычного. Подождите ещё немного.</span> : null}
    </div>
  );
}
