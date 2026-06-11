import { HashRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Products from "@/pages/Products";
import ProductDetail from "@/pages/ProductDetail";
import News from "@/pages/News";
import NewsDetail from "@/pages/NewsDetail";
import CaseStudies from "@/pages/CaseStudies";
import CaseStudyDetail from "@/pages/CaseStudyDetail";
import Services from "@/pages/Services";
import Contact from "@/pages/Contact";
import Inquiry from "@/pages/Inquiry";
import PageContent from "@/pages/PageContent";
import Shop from "@/pages/Shop";
import ShopCart from "@/pages/ShopCart";
import ShopCheckout from "@/pages/ShopCheckout";
import ShopOrders from "@/pages/ShopOrders";
import ShopAccount from "@/pages/ShopAccount";
import ShopAfterSales from "@/pages/ShopAfterSales";
import ShopPay from "@/pages/ShopPay";
import ShopPaypalReturn from "@/pages/ShopPaypalReturn";
import AdminLogin from "@/pages/AdminLogin";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { I18nProvider } from "@/lib/i18n";
import FloatingContact from "@/components/FloatingContact";
import CookieConsent from "@/components/CookieConsent";
import { supabase } from "@/lib/supabaseClient";

function SessionTouch() {
  const loc = useLocation();
  useEffect(() => {
    void supabase.auth.getSession();
  }, [loc.pathname, loc.search, loc.hash]);
  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <Router>
        <div className="min-h-dvh bg-white text-zinc-900">
          <SessionTouch />
          <SiteHeader />
          <main className="min-h-[60vh]">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:slug" element={<ProductDetail />} />
              <Route path="/news" element={<News />} />
              <Route path="/news/:slug" element={<NewsDetail />} />
              <Route path="/case-studies" element={<CaseStudies />} />
              <Route path="/case-studies/:slug" element={<CaseStudyDetail />} />
              <Route path="/services" element={<Services />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/inquiry" element={<Inquiry />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/cart" element={<ShopCart />} />
              <Route path="/shop/checkout" element={<ShopCheckout />} />
              <Route path="/shop/pay" element={<ShopPay />} />
              <Route path="/shop/paypal/return" element={<ShopPaypalReturn />} />
              <Route path="/shop/orders" element={<ShopOrders />} />
              <Route path="/shop/account" element={<ShopAccount />} />
              <Route path="/shop/after-sales" element={<ShopAfterSales />} />
              <Route path="/p/:slug" element={<PageContent />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <SiteFooter />
          <FloatingContact />
          <CookieConsent />
        </div>
      </Router>
    </I18nProvider>
  );
}
