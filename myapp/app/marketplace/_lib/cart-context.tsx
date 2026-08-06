"use client";

import type { CartItem, Product } from "@/lib/marketplace/types";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useSession } from "@/lib/auth-context";
import { mapProductRow, type ProductRow } from "./mappers";
import { formatSupabaseError, isMissingTableError } from "./errors";

type CartContextType = {
  cartItems: CartItem[];
  addToCart: (product: Product) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  cartCount: number;
  isLoading: boolean;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const PRODUCT_SELECT = "*, profiles:seller_id(*)";

export function CartProvider({ children }: { children: ReactNode }) {
  const { supabase, user } = useSession();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCart = useCallback(async () => {
    if (!user) {
      setCartItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data: cartRows, error } = await supabase
      .from("cart_items")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      if (!isMissingTableError(error)) {
        console.error("Error fetching saved items:", formatSupabaseError(error));
      }
      setIsLoading(false);
      return;
    }

    const items: CartItem[] = [];
    for (const row of cartRows ?? []) {
      const { data: productRow } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("id", row.product_id)
        .single();
      if (productRow) {
        items.push({
          product: mapProductRow(productRow as ProductRow),
          quantity: 1,
          status: (row.status as CartItem["status"]) || "Unpaid",
        });
      }
    }
    setCartItems(items);
    setIsLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const addToCart = async (product: Product) => {
    if (!user) return;
    const { error } = await supabase
      .from("cart_items")
      .upsert({
        user_id: user.id,
        product_id: product.id,
        quantity: 1,
        status: "Unpaid",
      })
      .eq("user_id", user.id)
      .eq("product_id", product.id);
    if (error) throw error;
    await loadCart();
  };

  const removeFromCart = async (productId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);
    if (error) throw error;
    await loadCart();
  };

  const clearCart = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id);
    if (error) throw error;
    await loadCart();
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        clearCart,
        cartCount: cartItems.length,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
