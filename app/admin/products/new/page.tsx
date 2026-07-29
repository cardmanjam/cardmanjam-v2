"use client";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { canUploadProductImages, createProduct } from "./actions";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "") || "image";
}

export default function NewProduct() {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImageSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setSelectedImages((current) => {
      const remainingSlots = 6 - current.length;
      if (remainingSlots <= 0) {
        setErrorMessage("You can add up to 6 images.");
        event.target.value = "";
        return current;
      }

      const nextImages = files.slice(0, remainingSlots).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      setErrorMessage(null);
      event.target.value = "";
      return [...current, ...nextImages];
    });
  };

  const removeImage = (imageId: string) => {
    setSelectedImages((current) => current.filter((image) => image.id !== imageId));
  };

  const uploadImages = async () => {
    if (!selectedImages.length) return [];

    setUploading(true);
    setErrorMessage(null);

    try {
      await canUploadProductImages();

      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        throw new Error("You must be signed in as an admin to upload photos.");
      }

      const uploadedUrls: string[] = [];

      for (const image of selectedImages) {
        const safeName = `products/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${sanitizeFileName(image.file.name)}`;
        const { error } = await supabase.storage.from("product-images").upload(safeName, image.file, {
          contentType: image.file.type || "application/octet-stream",
          upsert: false,
        });

        if (error) {
          throw new Error(`Upload failed for ${image.file.name}: ${error.message}`);
        }

        const { data } = supabase.storage.from("product-images").getPublicUrl(safeName);
        uploadedUrls.push(data.publicUrl);
      }

      return uploadedUrls;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (uploading || publishing) return;

    if (!formRef.current) return;

    try {
      setPublishing(true);
      setErrorMessage(null);
      const uploadedUrls = selectedImages.length ? await uploadImages() : [];

      const title = (formRef.current.elements.namedItem("title") as HTMLInputElement | null)?.value ?? "";
      const price = (formRef.current.elements.namedItem("price") as HTMLInputElement | null)?.value ?? "";
      const quantity = (formRef.current.elements.namedItem("quantity") as HTMLInputElement | null)?.value ?? "1";
      const category = (formRef.current.elements.namedItem("category") as HTMLSelectElement | null)?.value ?? "single";
      const shippingClass = (formRef.current.elements.namedItem("shipping_class") as HTMLSelectElement | null)?.value ?? "card";
      const condition = (formRef.current.elements.namedItem("condition") as HTMLInputElement | null)?.value ?? "";
      const description = (formRef.current.elements.namedItem("description") as HTMLTextAreaElement | null)?.value ?? "";
      const vaultNote = (formRef.current.elements.namedItem("vault_note") as HTMLTextAreaElement | null)?.value ?? "";
      const featured = (formRef.current.elements.namedItem("featured") as HTMLInputElement | null)?.checked ? "on" : "";
      const publishImmediately = (formRef.current.elements.namedItem("publish_immediately") as HTMLInputElement | null)?.checked ? "on" : "";

      const formData = new FormData();
      formData.set("title", title);
      formData.set("price", price);
      formData.set("quantity", quantity);
      formData.set("category", category);
      formData.set("shipping_class", shippingClass);
      formData.set("condition", condition);
      formData.set("description", description);
      formData.set("vault_note", vaultNote);
      formData.set("featured", featured);
      formData.set("publish_immediately", publishImmediately);
      formData.set("image_urls", JSON.stringify(uploadedUrls));

      await createProduct(formData, uploadedUrls);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to publish the product right now.";
      setErrorMessage(message);
    } finally {
      setPublishing(false);
    }
  };

  return <><p className="eyebrow">ADD TO THE VAULT</p><h1>New Product</h1>
    <form ref={formRef} onSubmit={handleSubmit} className="form-card">
      <div className="form-grid">
        <div className="field full"><label>Title</label><input name="title" required/></div>
        <div className="field"><label>Price ($)</label><input name="price" type="number" min="0.01" step="0.01" required/></div>
        <div className="field"><label>Quantity</label><input name="quantity" type="number" defaultValue="1" min="1" required/></div>
        <div className="field"><label>Category</label><select name="category"><option value="single">Raw Single</option><option value="slab">Graded Slab</option><option value="sealed">Sealed Product</option></select></div>
        <div className="field"><label>Shipping</label><select name="shipping_class"><option value="card">$5 Card/Slab</option><option value="sealed">$15 Sealed</option></select></div>
        <div className="field full"><label>Condition</label><input name="condition" placeholder="LP, PSA 9, factory sealed..."/></div>
        <div className="field full"><label>Description</label><textarea name="description"/></div>
        <div className="field full"><label>Why it&apos;s in the Vault</label><textarea name="vault_note"/></div>
        <div className="field full">
          <label>Photos (up to 6)</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageSelection} disabled={selectedImages.length >= 6} />
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
            {selectedImages.map((image) => (
              <div key={image.id} style={{ position: "relative", width: 96, height: 96, border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
                <img src={image.previewUrl} alt={image.file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button type="button" onClick={() => removeImage(image.id)} style={{ position: "absolute", top: 4, right: 4, border: "none", borderRadius: "999px", cursor: "pointer" }}>×</button>
              </div>
            ))}
          </div>
          {uploading ? <p style={{ marginTop: "0.75rem" }}>Uploading photos...</p> : null}
          {errorMessage ? <p style={{ marginTop: "0.75rem", color: "#b91c1c" }}>{errorMessage}</p> : null}
        </div>
        <label><input name="featured" type="checkbox"/> Jam&apos;s Pick</label>
        <label><input name="publish_immediately" type="checkbox" defaultChecked/> Publish immediately</label>
      </div><br/><button className="btn" disabled={uploading || publishing}>{uploading ? "Uploading photos..." : publishing ? "Publishing..." : "PUBLISH PRODUCT"}</button>
    </form>
  </>;
}
