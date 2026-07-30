import logoAsset from "../../assets/logo.png";
import owlAsset from "../../assets/owl-mascot.png";

interface DocWiseLogoProps {
  /** Height or bounding size in px */
  size?: number;
  className?: string;
}

/**
 * Owl Mascot image component using the exact uploaded image file.
 */
export function DocWiseLogo({ size = 40, className = "" }: DocWiseLogoProps) {
  return (
    <img
      src={owlAsset}
      alt="docWise Owl Mascot"
      style={{ height: size, width: "auto" }}
      className={`object-contain inline-block select-none mix-blend-multiply ${className}`}
    />
  );
}

interface DocWiseFullLogoProps {
  /** Height in px of the full logo image */
  height?: number;
  /** Legacy size parameter */
  size?: number;
  /** Variant for light or dark container backgrounds */
  variant?: "dark" | "light";
  className?: string;
}

/**
 * Complete official DocWise brand logo component rendering the user's exact uploaded logo image.
 */
export function DocWiseFullLogo({ height, size = 48, variant = "dark", className = "" }: DocWiseFullLogoProps) {
  const h = height || size;

  if (variant === "light") {
    // For dark headers/backgrounds
    return (
      <div className={`inline-flex items-center rounded-xl bg-white/95 px-3.5 py-2 shadow-md backdrop-blur-sm select-none ${className}`}>
        <img
          src={logoAsset}
          alt="docWise INTELLIGENT AI DOCUMENT EDITOR"
          style={{ height: h, width: "auto" }}
          className="object-contain"
        />
      </div>
    );
  }

  // For light headers/toolbars
  return (
    <img
      src={logoAsset}
      alt="docWise INTELLIGENT AI DOCUMENT EDITOR"
      style={{ height: h, width: "auto" }}
      className={`object-contain inline-block select-none mix-blend-multiply ${className}`}
    />
  );
}
