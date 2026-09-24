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
  weightGrams: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type CartItem = CartItemInput & {
  id: number;
};

export const ADD_TO_CART_EVENT = "orenza:add-to-cart";
export const CHANGE_CART_QUANTITY_EVENT = "orenza:change-cart-quantity";
export const CART_UPDATED_EVENT = "orenza:cart-updated";

export type CartQuantityChange = Pick<
  CartItemInput,
  "productId" | "blend" | "roast" | "grind" | "device" | "grindSize" | "weightGrams"
> & {
  delta: 1 | -1;
};

export const cartSelectionKey = (item: CartQuantityChange | CartItemInput) => JSON.stringify([
  item.productId,
  item.blend,
  item.roast,
  item.grind,
  item.device || "",
  item.grindSize || "",
  item.weightGrams
]);
