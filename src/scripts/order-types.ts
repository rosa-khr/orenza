export type SelectionKey = "blend" | "roast" | "grind" | "device" | "weight" | "grindSize";

export type CartItemInput = {
  productId: string;
  productTitle: string;
  blend: string;
  roast: string;
  grind: string;
  device?: string;
  grindSize?: string;
  weight: string;
  weightGrams: 100 | 250 | 500 | 1000;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type CartItem = CartItemInput & {
  id: number;
};

export const ADD_TO_CART_EVENT = "orenza:add-to-cart";
