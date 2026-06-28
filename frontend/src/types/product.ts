export interface BaseProduct {
  productId: string;
  productName: string;
  category: string;
  defaultQuantity: number | string;
  unit: string;
  pricePerUnit?: number;
  estimatedPackagePrice?: number;
  storeNote?: string;
  buyFreshOrStore?: string;
  includeByDefault: boolean;
  active: boolean;
  updatedAt: string;
}
