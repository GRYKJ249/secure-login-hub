import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Code2, ImageIcon, LayoutDashboard, LogOut, Menu, MessageSquare, PanelLeftClose, PanelLeftOpen, ShieldCheck, X } from "lucide-react";
import { OperaLogoMark } from "@/components/brand/OperaLogoMark";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useLang } from "@/lib/i18n";

const links = [
  { to: "/chat", icon: MessageSquare, en: "Chat workspace", ar: "المحادثات" },
  { to: "/studio", icon: ImageIcon, en: "Creative Studio", ar: "استوديو الصور" },
  { to: "/code", icon: Code2, en: "Code workspace", ar: "بيئة الأكواد" },
  { to: "/dashboard", icon: LayoutDashboard, en: "Dashboard & profile", ar: "لوحة التحكم والملف" },
  { to: "/security", icon: ShieldCheck, en: "Security & settings", ar: "الأمان والإعدادات" },
] as const;

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { username, displayName, avatarUrl } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const name = displayName || username || t("Your account", "حسابك");

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const sidebar = (
    <aside className={`flex h-full flex-col border-e border-border bg-card transition-[width] duration-200 ${collapsed ? "md:w-20" : "md:w-72"} w-72`}>
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-3" onClick={() => setMobileOpen(false)}>
          <OperaLogoMark className="h-9 w-9" />
          {!collapsed && <span className="truncate font-display text-base font-bold">Opera <span className="text-primary">AI</span></span>}
        </Link>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(false)} aria-label={t("Close menu", "إغلاق القائمة")}><X /></Button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {links.map((item) => (
          <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)} activeProps={{ className: "bg-primary/12 text-primary" }} className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{t(item.en, item.ar)}</span>}
          </Link>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <div className={`flex items-center gap-3 rounded-lg bg-muted/50 p-2 ${collapsed ? "justify-center" : ""}`}>
          <UserAvatar src={avatarUrl} name={name} className="h-10 w-10 shrink-0" />
          {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p dir="ltr" className="truncate text-xs text-muted-foreground">{username ? `@${username}` : user?.email}</p></div>}
          {!collapsed && <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label={t("Log out", "تسجيل الخروج")}><LogOut /></Button>}
        </div>
        <Button variant="ghost" className="mt-2 hidden w-full md:flex" onClick={() => setCollapsed((value) => !value)} aria-label={t("Toggle sidebar", "تبديل الشريط الجانبي")}>
          {collapsed ? <PanelLeftOpen /> : <><PanelLeftClose /><span>{t("Collapse", "طي الشريط")}</span></>}
        </Button>
      </div>
    </aside>
  );

  return <div dir={lang === "ar" ? "rtl" : "ltr"} className="flex h-dvh overflow-hidden bg-background">
    {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-background/75 backdrop-blur-sm md:hidden" aria-label={t("Close menu", "إغلاق القائمة")} onClick={() => setMobileOpen(false)} />}
    <div className={`fixed inset-y-0 z-50 transition-transform md:static md:translate-x-0 ${lang === "ar" ? "right-0" : "left-0"} ${mobileOpen ? "translate-x-0" : lang === "ar" ? "translate-x-full" : "-translate-x-full"}`}>{sidebar}</div>
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 md:hidden"><Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label={t("Open menu", "فتح القائمة")}><Menu /></Button><span className="font-display text-sm font-bold">Opera AI</span></header>
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  </div>;
}