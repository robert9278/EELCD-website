export type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type SocialLink = {
  label: "Facebook" | "YouTube" | "TikTok" | "LinkedIn";
  href: string;
};

export type NavLink = {
  label: string;
  href: string;
};

const footerCompanyLinks: FooterLink[] = [
  { label: "Home", href: "/" },
  { label: "About us", href: "/about" },
  { label: "Product", href: "/products" },
  { label: "News", href: "/news" },
  { label: "Contact", href: "/contact" },
];

const footerProductLinks: FooterLink[] = [
  { label: "TFT Customization", href: "/products?category=TFT" },
  { label: "OLED Displays", href: "/products?category=OLED" },
  { label: "PCAP Touch Panels", href: "/products?category=PCAP" },
  { label: "EPD / E-Ink", href: "/products?category=EPD" },
  { label: "Mechanical Parts", href: "/products?category=Mechanical" },
  { label: "Download Center", href: "/services#download" },
];

const footerSocialLinks: SocialLink[] = [
  { label: "Facebook", href: "" },
  { label: "YouTube", href: "" },
  { label: "TikTok", href: "" },
  { label: "LinkedIn", href: "" },
];

export const siteConfig = {
  brand: {
    mark: "TM",
    name: "EAGLE EYE TECH",
    introLines: [
      "We are one of the professional suppliers",
      "for custom display & industrial components.",
    ],
  },
  header: {
    navLinks: [
      { label: "About Us", href: "/about" },
      { label: "Product", href: "/products" },
      { label: "News", href: "/news" },
      { label: "Industry Case Studies", href: "/case-studies" },
      { label: "Services & Support", href: "/services" },
      { label: "Contact Us", href: "/contact" },
    ],
    loginHref: "/admin/login",
  },
  footer: {
    companyLinks: footerCompanyLinks,
    productLinks: footerProductLinks,
    socialLinks: footerSocialLinks,
  },
};
