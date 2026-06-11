export type CartItem = { product_id: string; quantity: number };

const STORAGE_KEY = "ee_shop_cart";

export function loadCart(): CartItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.product_id === "string") : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addToCart(productId: string, quantity = 1) {
  const q = Math.max(1, Math.floor(quantity));
  const items = loadCart();
  const idx = items.findIndex((i) => i.product_id === productId);
  if (idx >= 0) items[idx] = { product_id: productId, quantity: (items[idx]?.quantity ?? 0) + q };
  else items.push({ product_id: productId, quantity: q });
  saveCart(items);
  return items;
}

export function updateCartItem(productId: string, quantity: number) {
  const q = Math.max(0, Math.floor(quantity));
  const items = loadCart().filter((i) => i.product_id !== productId);
  if (q > 0) items.push({ product_id: productId, quantity: q });
  saveCart(items);
  return items;
}

export function clearCart() {
  localStorage.removeItem(STORAGE_KEY);
}

