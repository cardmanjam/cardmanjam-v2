import Link from "next/link";
export default function AdminNav() {
  return <aside className="admin-nav">
    <p className="eyebrow">VAULT ADMIN</p>
    <Link href="/admin">Dashboard</Link>
    <Link href="/admin/products">Products</Link>
    <Link href="/admin/products/new">+ Add Product</Link>
    <Link href="/admin/orders">Orders</Link>
    <Link href="/">View Store</Link>
  </aside>;
}
