import { createAdminClient } from "@/lib/supabase/admin";

type OrderProductDetail = {
  id?: string;
  title?: string;
  price_cents?: number;
  quantity?: number;
};

type OrderRow = {
  id: string;
  created_at: string;
  customer_email: string | null;
  customer_name: string | null;
  shipping_address: Record<string, string | null> | null;
  amount_total: number;
  shipping_total: number;
  status: string;
  fulfillment_status: string | null;
  stripe_session_id: string;
  receipt_url: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  product_ids: string[];
  product_details: OrderProductDetail[] | null;
};

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatAddress(address: OrderRow["shipping_address"]) {
  if (!address) return "—";
  return [
    address.name,
    address.line1,
    address.line2,
    [address.city, address.state, address.postal_code].filter(Boolean).join(", "),
    address.country
  ]
    .filter(Boolean)
    .join("\n");
}

function getProductNames(order: OrderRow) {
  if (Array.isArray(order.product_details) && order.product_details.length > 0) {
    return order.product_details
      .map((item) => item.title)
      .filter((title): title is string => Boolean(title))
      .join(", ");
  }

  if (order.product_ids.length > 0) {
    return order.product_ids.join(", ");
  }

  return "—";
}

function getItemsTotal(order: OrderRow) {
  if (Array.isArray(order.product_details) && order.product_details.length > 0) {
    return order.product_details.reduce((total, item) => {
      return total + (item.price_cents ?? 0) * (item.quantity ?? 1);
    }, 0);
  }

  return Math.max(order.amount_total - order.shipping_total, 0);
}

export default async function Orders() {
  const db = createAdminClient();
  const { data } = await db.from("orders").select("*").order("created_at", { ascending: false });
  const orders = (data ?? []) as OrderRow[];

  return <>
    <p className="eyebrow">FULFILLMENT</p>
    <h1>Orders</h1>
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Address</th>
            <th>Products</th>
            <th>Items</th>
            <th>Shipping</th>
            <th>Total</th>
            <th>Order Status</th>
            <th>Fulfillment</th>
            <th>Receipt</th>
            <th>Carrier</th>
            <th>Tracking</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => <tr key={order.id}>
            <td>{new Date(order.created_at).toLocaleString()}</td>
            <td>
              <div>{order.customer_name || "—"}</div>
              <div>{order.customer_email || "—"}</div>
            </td>
            <td style={{ whiteSpace: "pre-line", minWidth: 220 }}>{formatAddress(order.shipping_address)}</td>
            <td style={{ minWidth: 260 }}>{getProductNames(order)}</td>
            <td>{formatMoney(getItemsTotal(order))}</td>
            <td>{formatMoney(order.shipping_total ?? 0)}</td>
            <td>{formatMoney(order.amount_total ?? 0)}</td>
            <td className="status">{order.status}</td>
            <td className="status">{order.fulfillment_status || "unfulfilled"}</td>
            <td>{order.receipt_url ? <a href={order.receipt_url} target="_blank" rel="noreferrer">View receipt</a> : "—"}</td>
            <td>{order.shipping_carrier || "—"}</td>
            <td>{order.tracking_number || "—"}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </>;
}
