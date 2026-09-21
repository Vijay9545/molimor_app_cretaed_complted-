export interface Product {
  _id: string;
  title: string;
  sku: string;
  categoryId?: string;
  categoryName?: string;
  gst?: string;
  hsnCode?: string;
  mainImage: string;
  images?: string[]; // array of product images
  isActive: boolean;
  isDelete: boolean;
  description?: string;
  highlights?: string[];
  benefits?: string[];
  specifications?: { [key: string]: string };
  rating?: number;
  reviewCount?: number;
  variants: VariantsByRole; // distributor/retailer/customer
}

export interface VariantsByRole {
  distributor: VariantOption;
  retailer: VariantOption;
  customer: VariantOption;
}

export interface VariantOption {
  qty: number;          // available quantity
  price: number;        // selling price
  mrp: number;     // e.g., "500ml", "1L"
  miniOrderQty: number; // minimum order requirement
}
