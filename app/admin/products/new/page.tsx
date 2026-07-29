import { createProduct } from "./actions";
export default function NewProduct() {
  return <><p className="eyebrow">ADD TO THE VAULT</p><h1>New Product</h1>
    <form action={createProduct} className="form-card" encType="multipart/form-data">
      <div className="form-grid">
        <div className="field full"><label>Title</label><input name="title" required/></div>
        <div className="field"><label>Price ($)</label><input name="price" type="number" min="0.01" step="0.01" required/></div>
        <div className="field"><label>Quantity</label><input name="quantity" type="number" defaultValue="1" min="1" required/></div>
        <div className="field"><label>Category</label><select name="category"><option value="single">Raw Single</option><option value="slab">Slab</option><option value="sealed">Sealed</option></select></div>
        <div className="field"><label>Shipping</label><select name="shipping_class"><option value="card">$5 Card/Slab</option><option value="sealed">$15 Sealed</option></select></div>
        <div className="field full"><label>Condition</label><input name="condition" placeholder="LP, PSA 9, factory sealed..."/></div>
        <div className="field full"><label>Description</label><textarea name="description"/></div>
        <div className="field full"><label>Why it&apos;s in the Vault</label><textarea name="vault_note"/></div>
        <div className="field full"><label>Photos (up to 6)</label><input name="images" type="file" accept="image/*" multiple/></div>
        <label><input name="featured" type="checkbox"/> Jam&apos;s Pick</label>
        <label><input name="publish" type="checkbox" defaultChecked/> Publish immediately</label>
      </div><br/><button className="btn">PUBLISH PRODUCT</button>
    </form>
  </>;
}
