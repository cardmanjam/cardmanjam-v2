"use client";
import { useMemo, useState } from "react";

export default function ProductDetailGallery({ title, imageUrls }: { title: string; imageUrls: string[] }) {
  const [selectedImage, setSelectedImage] = useState(imageUrls[0] || "");
  const thumbnails = useMemo(() => imageUrls.filter((image): image is string => typeof image === "string" && Boolean(image)), [imageUrls]);

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        {selectedImage ? (
          <img src={selectedImage} alt={title} style={{ width: "100%", height: "420px", objectFit: "contain", background: "radial-gradient(circle,#243e72,#071024)", border: "3px solid #111" }} />
        ) : (
          <div className="placeholder" style={{ height: "420px" }}>JC</div>
        )}
      </div>
      {thumbnails.length > 0 ? (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {thumbnails.map((imageUrl, index) => (
            <button key={`${imageUrl}-${index}`} type="button" onClick={() => setSelectedImage(imageUrl)} style={{ padding: 0, border: selectedImage === imageUrl ? "3px solid #ffd83d" : "3px solid #111", background: "transparent", cursor: "pointer" }}>
              <img src={imageUrl} alt={`${title} ${index + 1}`} style={{ width: "96px", height: "96px", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
