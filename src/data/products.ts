export type ProductMediaImage = {
  url: string;
  alt: string;
};

export type ProductAttachment = {
  label: string;
  url: string;
};

export type ProductCategory = "TFT" | "OLED" | "PCAP" | "EPD" | "Mechanical";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  model?: string;
  inStock?: boolean;
  shortDescription: string;
  specSize?: string;
  specResolution?: string;
  specLcdType?: string;
  specLuminance?: string;
  specOperatingTemp?: string;
  images: ProductMediaImage[];
  videoUrl?: string;
  attachments: ProductAttachment[];
};

export const productCategories: { key: ProductCategory; label: string }[] = [
  { key: "TFT", label: "TFT Customization" },
  { key: "OLED", label: "OLED Displays" },
  { key: "PCAP", label: "PCAP Touch Panels" },
  { key: "EPD", label: "EPD / E-Ink" },
  { key: "Mechanical", label: "Mechanical Parts" },
];

export const products: Product[] = [
  {
    id: "ftp-001",
    model: "FTP-001",
    inStock: true,
    name: "Custom FPC / FTP Cable",
    category: "TFT",
    shortDescription: "Custom pitch, length, and connector options for industrial applications.",
    specSize: "",
    specResolution: "",
    specLcdType: "",
    specLuminance: "",
    specOperatingTemp: "",
    images: [{ url: "/favicon.svg", alt: "Custom FPC / FTP Cable" }],
    attachments: [{ label: "Spec PDF", url: "/downloads/ftp-001.pdf" }],
  },
  {
    id: "oled-001",
    model: "OLED-001",
    inStock: true,
    name: "Small OLED Display Module",
    category: "OLED",
    shortDescription: "High-contrast OLED modules with customizable interface and size.",
    specSize: "1.3 inch",
    specResolution: "128×64",
    specLcdType: "OLED",
    specLuminance: "≥120 cd/m²",
    specOperatingTemp: "-20~70°C",
    images: [{ url: "/favicon.svg", alt: "OLED Display Module" }],
    videoUrl: "",
    attachments: [{ label: "Datasheet PDF", url: "/downloads/oled-001.pdf" }],
  },
  {
    id: "pcap-001",
    model: "PCAP-001",
    inStock: false,
    name: "PCAP Touch Panel",
    category: "PCAP",
    shortDescription: "Multi-touch projected capacitive panels for industrial HMI.",
    specSize: "7 inch",
    specResolution: "800×480",
    specLcdType: "PCAP",
    specLuminance: "",
    specOperatingTemp: "-20~70°C",
    images: [{ url: "/favicon.svg", alt: "PCAP Touch Panel" }],
    attachments: [{ label: "Drawing PDF", url: "/downloads/pcap-001.pdf" }],
  },
  {
    id: "epd-001",
    model: "EPD-001",
    inStock: true,
    name: "EPD / E-Ink Display",
    category: "EPD",
    shortDescription: "Low-power EPD solutions for signage and IoT devices.",
    specSize: "2.9 inch",
    specResolution: "296×128",
    specLcdType: "EPD",
    specLuminance: "",
    specOperatingTemp: "0~50°C",
    images: [{ url: "/favicon.svg", alt: "EPD / E-Ink Display" }],
    attachments: [{ label: "Spec PDF", url: "/downloads/epd-001.pdf" }],
  },
  {
    id: "mech-001",
    model: "MECH-001",
    inStock: true,
    name: "Custom Mechanical Parts",
    category: "Mechanical",
    shortDescription: "CNC machining and custom mechanical components per drawing.",
    specSize: "",
    specResolution: "",
    specLcdType: "",
    specLuminance: "",
    specOperatingTemp: "",
    images: [{ url: "/favicon.svg", alt: "Mechanical Parts" }],
    attachments: [{ label: "Capabilities PDF", url: "/downloads/mech-001.pdf" }],
  },
];
