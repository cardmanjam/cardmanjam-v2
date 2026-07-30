"use client";
import { useEffect, useMemo, useState } from "react";

export default function ProductDetailGallery({ title, imageUrls }: { title: string; imageUrls: string[] }) {
  const [selectedImage, setSelectedImage] = useState(imageUrls[0] || "");
  const [showLens, setShowLens] = useState(false);
  const [lensPosition, setLensPosition] = useState({ x: 50, y: 50 });
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const thumbnails = useMemo(() => imageUrls.filter((image): image is string => typeof image === "string" && Boolean(image)), [imageUrls]);

  useEffect(() => {
    if (!thumbnails.includes(selectedImage) && thumbnails.length > 0) {
      setSelectedImage(thumbnails[0]);
    }
  }, [selectedImage, thumbnails]);

  useEffect(() => {
    if (!isViewerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsViewerOpen(false);
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
      }

      if (event.key === "ArrowRight" && thumbnails.length > 1) {
        const currentIndex = thumbnails.findIndex((image) => image === selectedImage);
        const nextIndex = (currentIndex + 1 + thumbnails.length) % thumbnails.length;
        setSelectedImage(thumbnails[nextIndex]);
      }

      if (event.key === "ArrowLeft" && thumbnails.length > 1) {
        const currentIndex = thumbnails.findIndex((image) => image === selectedImage);
        const nextIndex = (currentIndex - 1 + thumbnails.length) % thumbnails.length;
        setSelectedImage(thumbnails[nextIndex]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isViewerOpen, selectedImage, thumbnails]);

  const openViewer = () => {
    setIsViewerOpen(true);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const closeViewer = () => {
    setIsViewerOpen(false);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const changeImage = (direction: 1 | -1) => {
    if (thumbnails.length <= 1) return;
    const currentIndex = thumbnails.findIndex((image) => image === selectedImage);
    const nextIndex = (currentIndex + direction + thumbnails.length) % thumbnails.length;
    setSelectedImage(thumbnails[nextIndex]);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleLensMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const xPercent = ((event.clientX - bounds.left) / bounds.width) * 100;
    const yPercent = ((event.clientY - bounds.top) / bounds.height) * 100;
    setLensPosition({ x: xPercent, y: yPercent });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoomLevel <= 1) return;
    setDragging(true);
    setDragOrigin({ x: event.clientX - panOffset.x, y: event.clientY - panOffset.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || zoomLevel <= 1) return;
    setPanOffset({ x: event.clientX - dragOrigin.x, y: event.clientY - dragOrigin.y });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const zoomIn = () => setZoomLevel((current) => Math.min(current + 0.25, 3));
  const zoomOut = () => setZoomLevel((current) => Math.max(current - 0.25, 1));
  const resetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div>
      <div
        style={{ marginBottom: "1rem", position: "relative", cursor: "zoom-in" }}
        onMouseEnter={() => setShowLens(true)}
        onMouseLeave={() => setShowLens(false)}
        onMouseMove={handleLensMove}
        onClick={openViewer}
        tabIndex={0}
        role="button"
        aria-label={`Open full-screen image viewer for ${title}`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openViewer();
          }
        }}
      >
        {selectedImage ? (
          <>
            <img
              src={selectedImage}
              alt={title}
              style={{ width: "100%", height: "520px", objectFit: "contain", background: "radial-gradient(circle,#243e72,#071024)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "1.25rem", boxShadow: "0 24px 48px rgba(0,0,0,0.28)", display: "block" }}
            />
            {showLens && selectedImage ? (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  width: "220px",
                  maxWidth: "45%",
                  height: "220px",
                  border: "3px solid #ffd83d",
                  boxShadow: "0 12px 24px rgba(0,0,0,0.35)",
                  backgroundImage: `url(${selectedImage})`,
                  backgroundSize: `${Math.max(zoomLevel * 150, 150)}%`,
                  backgroundPosition: `${lensPosition.x}% ${lensPosition.y}%`,
                  pointerEvents: "none",
                  top: 16,
                  right: 16,
                  zIndex: 2,
                }}
              />
            ) : null}
          </>
        ) : (
          <div className="placeholder" style={{ height: "420px" }}>JC</div>
        )}
      </div>
      {thumbnails.length > 0 ? (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {thumbnails.map((imageUrl, index) => (
            <button key={`${imageUrl}-${index}`} type="button" onClick={() => setSelectedImage(imageUrl)} style={{ padding: 0, border: selectedImage === imageUrl ? "2px solid #ffd83d" : "2px solid rgba(255,255,255,0.16)", background: "transparent", cursor: "pointer", borderRadius: "0.9rem", overflow: "hidden" }}>
              <img src={imageUrl} alt={`${title} ${index + 1}`} style={{ width: "96px", height: "96px", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      ) : null}

      {isViewerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onClick={closeViewer}
          style={{ position: "fixed", inset: 0, background: "rgba(3, 5, 10, 0.95)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(1100px, 100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" onClick={zoomOut} className="btn secondary" style={{ padding: "10px 12px" }}>−</button>
              <button type="button" onClick={zoomIn} className="btn" style={{ padding: "10px 12px" }}>+</button>
              <button type="button" onClick={resetZoom} className="btn secondary" style={{ padding: "10px 12px" }}>Reset</button>
              {thumbnails.length > 1 ? <><button type="button" onClick={() => changeImage(-1)} className="btn secondary" style={{ padding: "10px 12px" }}>← Prev</button><button type="button" onClick={() => changeImage(1)} className="btn secondary" style={{ padding: "10px 12px" }}>Next →</button></> : null}
              <button type="button" onClick={closeViewer} className="btn danger" style={{ padding: "10px 12px" }}>Close</button>
            </div>
            <div
              style={{ overflow: "hidden", border: "4px solid #111", background: "#05060a", cursor: zoomLevel > 1 ? "grab" : "default", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <img
                src={selectedImage}
                alt={title}
                style={{ transform: `scale(${zoomLevel}) translate(${panOffset.x / 2}px, ${panOffset.y / 2}px)`, transformOrigin: "center center", maxWidth: "100%", maxHeight: "76vh", objectFit: "contain", userSelect: "none", display: "block" }}
              />
            </div>
            <p className="eyebrow" style={{ textAlign: "center" }}>Tap or click outside the image to close • Use + / − to zoom • Drag to pan</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
