export type SelectionKey = "blend" | "roast" | "grind" | "device" | "weight" | "grindSize";

export type CartItemInput = {
  blend: string;
  roast: string;
  grind: string;
  device?: string;
  grindSize?: string;
  weight: string;
};

export type CartItem = CartItemInput & {
  id: number;
};

export const ADD_TO_CART_EVENT = "orenza:add-to-cart";
