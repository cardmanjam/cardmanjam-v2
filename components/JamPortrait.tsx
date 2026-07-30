"use client";

type JamPortraitProps = {
  variant?: "hero" | "about";
};

export default function JamPortrait({ variant = "hero" }: JamPortraitProps) {
  const isAbout = variant === "about";

  return (
    <div className={isAbout ? "about-photo-card about-photo-card--portrait" : "hero-visual portrait-shell"}>
      <img
        className={isAbout ? "about-portrait" : "hero-portrait"}
        src="/about/jam-smiling-actual.jpeg"
        alt={isAbout ? "Jam smiling" : "Jam smiling"}
      />
    </div>
  );
}
