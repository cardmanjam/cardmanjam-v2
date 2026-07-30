type ShippableItem = {
  shipping_class: "card" | "sealed";
};

export function resolveShippingClass(category: "single" | "slab" | "sealed") {
  return category === "sealed" ? "sealed" : "card";
}

export function getOrderShippingAmount(items: ShippableItem[]) {
  return items.some((item) => item.shipping_class === "sealed") ? 1500 : 500;
}

export function getOrderShippingLabel(items: ShippableItem[]) {
  return getOrderShippingAmount(items) === 1500
    ? "Sealed or mixed-order shipping"
    : "Tracked card/slab shipping";
}
