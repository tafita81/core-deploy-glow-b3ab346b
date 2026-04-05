import {
  Brain,
  LayoutDashboard,
  FileText,
  Share2,
  ScrollText,
  Settings,
  Zap,
  ChevronLeft,
  MessageCircle,
  Lightbulb,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Estratégia", url: "/strategy", icon: Lightbulb },
  { title: "Conteúdo", url: "/content", icon: FileText },
  { title: "Comunidade", url: "/community", icon: MessageCircle },
  { title: "Canais", url: "/channels", icon: Share2 },
  { title: "Logs", url: "/logs", icon: ScrollText },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-heading text-sm font-bold text-sidebar-accent-foreground">
                Daniela Brain
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                Sistema Autônomo
              </span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={toggleSidebar}
              className="ml-auto rounded-md p-1 text-sidebar-foreground/40 hover:text-sidebar-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent p-3">
            <Zap className="h-4 w-4 text-sidebar-primary" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-sidebar-accent-foreground">
                Sistema Ativo
              </span>
              <span className="text-[10px] text-sidebar-foreground/50">
                24/7 • GitHub Actions
              </span>
            </div>
            <div className="ml-auto h-2 w-2 animate-pulse-glow rounded-full bg-success" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
