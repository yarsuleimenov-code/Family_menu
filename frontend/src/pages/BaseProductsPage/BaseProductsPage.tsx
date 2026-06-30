import { useState } from 'react';
import { Pencil, Power, RotateCcw } from 'lucide-react';
import { useAppState } from '../../app/AppState';
import type { BaseProduct } from '../../types/product';
import { formatTenge } from '../../utils/budget';

const emptyProduct = (): BaseProduct => ({
  productId: `BP-${Date.now()}`,
  productName: '',
  category: 'прочее',
  defaultQuantity: 1,
  unit: 'шт',
  includeByDefault: true,
  active: true,
  updatedAt: new Date().toISOString(),
});

export function BaseProductsPage() {
  const { data, saveBaseProduct, deactivateBaseProduct } = useAppState();
  const [editing, setEditing] = useState<BaseProduct | null>(null);

  const save = async (product: BaseProduct) => {
    await saveBaseProduct({ ...product, updatedAt: new Date().toISOString() });
    setEditing(null);
  };

  const toggleActive = async (product: BaseProduct) => {
    if (product.active) {
      await deactivateBaseProduct(product.productId);
      return;
    }
    await saveBaseProduct({ ...product, active: true, updatedAt: new Date().toISOString() });
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>Базовые продукты</h1>
          <p>Регулярные покупки и ориентировочные цены.</p>
        </div>
        <button className="primary" type="button" onClick={() => setEditing(emptyProduct())}>Добавить</button>
      </div>

      {editing ? <ProductForm product={editing} onSave={(product) => void save(product)} onCancel={() => setEditing(null)} /> : null}

      <div className="product-list">
        {data.baseProducts.map((product) => (
          <article className={`product-card ${!product.active ? 'product-card--inactive' : ''}`} key={product.productId}>
            <div>
              <h3>{product.productName}</h3>
              <p>{product.category} · {product.defaultQuantity} {product.unit}</p>
              <p className="muted">{product.storeNote || 'без комментария'}</p>
            </div>
            <div className="product-card__side">
              <strong>{formatTenge(product.estimatedPackagePrice || product.pricePerUnit)}</strong>
              <span>{product.includeByDefault ? 'по умолчанию' : 'по запросу'}</span>
              <div className="product-card__actions">
                <button className="icon-button" type="button" onClick={() => setEditing(product)} aria-label="Редактировать" title="Редактировать"><Pencil size={18} /></button>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => void toggleActive(product)}
                  aria-label={product.active ? 'Деактивировать' : 'Включить'}
                  title={product.active ? 'Деактивировать' : 'Включить'}
                >
                  {product.active ? <Power size={18} /> : <RotateCcw size={18} />}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductForm({ product, onSave, onCancel }: { product: BaseProduct; onSave: (product: BaseProduct) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(product);
  return (
    <form className="edit-form" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <h2>{product.productName ? 'Редактировать продукт' : 'Новый продукт'}</h2>
      <label>Продукт <input required value={draft.productName} onChange={(event) => setDraft({ ...draft, productName: event.target.value })} /></label>
      <div className="form-grid">
        <label>Категория <input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
        <label>Количество <input value={draft.defaultQuantity} onChange={(event) => setDraft({ ...draft, defaultQuantity: Number(event.target.value) || event.target.value })} /></label>
        <label>Единица <input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></label>
        <label>Цена за единицу <input type="number" value={draft.pricePerUnit || ''} onChange={(event) => setDraft({ ...draft, pricePerUnit: Number(event.target.value) || undefined })} /></label>
        <label>Цена упаковки <input type="number" value={draft.estimatedPackagePrice || ''} onChange={(event) => setDraft({ ...draft, estimatedPackagePrice: Number(event.target.value) || undefined })} /></label>
      </div>
      <label>Магазин / комментарий <input value={draft.storeNote || ''} onChange={(event) => setDraft({ ...draft, storeNote: event.target.value })} /></label>
      <label className="switch-row"><input type="checkbox" checked={draft.includeByDefault} onChange={(event) => setDraft({ ...draft, includeByDefault: event.target.checked })} /> Включать по умолчанию</label>
      <div className="toolbar">
        <button className="primary" type="submit">Сохранить</button>
        <button type="button" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}
