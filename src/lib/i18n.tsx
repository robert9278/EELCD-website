import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "zh";

const STORAGE_KEY = "ee_lang";

function detectDefaultLang(): Lang {
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  return nav.toLowerCase().startsWith("zh") ? "zh" : "en";
}

type I18nContextValue = {
  lang: Lang;
  setLang: (next: Lang) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Lang | null) ?? null;
    if (saved === "en" || saved === "zh") return saved;
    return detectDefaultLang();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => {
    return {
      lang,
      setLang: (next) => setLangState(next),
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("I18nProvider is missing");

  function toggleLang() {
    ctx.setLang(ctx.lang === "en" ? "zh" : "en");
  }

  function pickI18nText(obj: Record<string, string> | null | undefined) {
    const primary = (obj?.[ctx.lang] ?? "").toString();
    if (primary.trim()) return primary;
    const fallback = (obj?.[ctx.lang === "en" ? "zh" : "en"] ?? "").toString();
    return fallback;
  }

  const dict = {
    en: {
      langShort: "EN",
      langSwitch: "中文",
      login: "Login",
      nav_about: "About Us",
      nav_product: "Product",
      nav_news: "News",
      nav_case: "Industry Case Studies",
      nav_services: "Services & Support",
      nav_contact: "Contact Us",
      footer_company: "Company",
      footer_product: "Product",
      footer_connect: "Connect",
      footer_rights: "All rights reserved.",
      product_model: "Model",
      product_in_stock: "In stock",
      product_out_stock: "Out of stock",
      brand_intro_1: "We are one of the professional suppliers",
      brand_intro_2: "for custom display & industrial components.",
      notfound_title: "Page not found",
      notfound_desc: "The page you are looking for does not exist or has been moved.",
      notfound_back: "Back to home",
      contact_title: "Contact Us",
      contact_desc: "Email, phone and social channels for business inquiry.",
      contact_hidden: "Contact info is currently hidden.",
      contact_loading_failed: "Failed to load contact info",
      contact_not_set: "Not set",
      contact_sales_email: "Sales Email",
      contact_phone: "Phone",
      services_title: "Services & Support",
      services_desc: "Downloads, warranty policy, and issue feedback.",
      services_supabase_off: "Supabase is not configured. Configure environment variables to enable downloads and feedback.",
      services_loading: "Loading...",
      services_download: "Download",
      services_no_downloads: "No downloads yet. Add them in Admin → Services → Downloads.",
      services_open_file: "Open file",
      services_warranty_fallback: "Warranty Policy",
      services_feedback: "Issue feedback",
      services_required_3: "Required fields: Name, Phone, Email.",
      services_name: "Name",
      services_phone: "Phone",
      services_email: "Email",
      services_message_optional: "Message (Optional)",
      services_product_model_optional: "Product model (optional)",
      services_company_optional: "Company (optional)",
      services_submit: "Submit",
      services_submitting: "Submitting...",
      services_submitted: "Submitted. We will get back to you soon.",
      services_fill_required: "Please fill in Name, Phone, and Email.",
      services_supabase_missing: "Supabase is not configured.",
      inquiry_title: "Title",
      inquiry_h1: "Get a Quote",
      inquiry_form: "Form",
      inquiry_full_name: "Full Name",
      inquiry_email: "Email",
      inquiry_phone_whatsapp: "Phone / WhatsApp",
      inquiry_country: "Country",
      inquiry_quantity: "Quantity",
      inquiry_company: "Company",
      inquiry_requirements: "Requirements",
      inquiry_requirements_placeholder: "Size, resolution, interface, voltage or other details",
      inquiry_send: "Send Inquiry",
      inquiry_sending: "Sending...",
      inquiry_success: "Thank you! We will reply with quotation within 24 hours.",
      inquiry_fill_required: "Please fill in required fields.",
      inquiry_submit_failed: "Submit failed.",
      inquiry_supabase_missing: "Supabase is not configured.",
    },
    zh: {
      langShort: "中文",
      langSwitch: "EN",
      login: "登录",
      nav_about: "关于我们",
      nav_product: "产品",
      nav_news: "新闻",
      nav_case: "行业案例",
      nav_services: "服务与支持",
      nav_contact: "联系我们",
      footer_company: "公司",
      footer_product: "产品",
      footer_connect: "关注我们",
      footer_rights: "版权所有。",
      product_model: "型号",
      product_in_stock: "现货",
      product_out_stock: "缺货",
      brand_intro_1: "我们是专业的定制显示与工业组件供应商",
      brand_intro_2: "为全球客户提供可靠的交付与服务。",
      notfound_title: "页面不存在",
      notfound_desc: "你访问的页面不存在或已被移动。",
      notfound_back: "返回首页",
      contact_title: "联系我们",
      contact_desc: "用于业务咨询的邮箱、电话与社媒渠道。",
      contact_hidden: "联系信息当前已隐藏。",
      contact_loading_failed: "加载联系信息失败",
      contact_not_set: "未设置",
      contact_sales_email: "销售邮箱",
      contact_phone: "电话",
      services_title: "服务与支持",
      services_desc: "下载中心、保修政策与问题反馈。",
      services_supabase_off: "Supabase 未配置。请配置环境变量以启用下载与反馈功能。",
      services_loading: "加载中...",
      services_download: "下载中心",
      services_no_downloads: "暂无下载文件。请在后台 管理 → Services → Downloads 添加。",
      services_open_file: "打开文件",
      services_warranty_fallback: "保修政策",
      services_feedback: "问题反馈",
      services_required_3: "必填：姓名、电话、邮箱。",
      services_name: "姓名",
      services_phone: "电话",
      services_email: "邮箱",
      services_message_optional: "问题描述（选填）",
      services_product_model_optional: "产品型号（选填）",
      services_company_optional: "公司（选填）",
      services_submit: "提交",
      services_submitting: "提交中...",
      services_submitted: "已提交，我们会尽快与您联系。",
      services_fill_required: "请填写姓名、电话、邮箱。",
      services_supabase_missing: "Supabase 未配置。",
      inquiry_title: "标题",
      inquiry_h1: "获取报价",
      inquiry_form: "表单",
      inquiry_full_name: "姓名",
      inquiry_email: "邮箱",
      inquiry_phone_whatsapp: "电话 / WhatsApp",
      inquiry_country: "国家/地区",
      inquiry_quantity: "数量",
      inquiry_company: "公司名称",
      inquiry_requirements: "需求说明",
      inquiry_requirements_placeholder: "尺寸、分辨率、接口、电压或其他细节",
      inquiry_send: "发送询价",
      inquiry_sending: "发送中...",
      inquiry_success: "感谢您的咨询！我们将在 24 小时内回复报价。",
      inquiry_fill_required: "请填写必填项。",
      inquiry_submit_failed: "提交失败。",
      inquiry_supabase_missing: "Supabase 未配置。",
    },
  } as const;

  function t<K extends keyof (typeof dict)["en"]>(key: K) {
    return dict[ctx.lang][key];
  }

  return { lang: ctx.lang, setLang: ctx.setLang, toggleLang, t, pickI18nText };
}
