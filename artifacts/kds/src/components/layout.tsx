import { Link, useLocation } from "wouter";
import { LayoutDashboard, MonitorSpeaker, Settings, Monitor, ListOrdered } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "KDS Display", href: "/", icon: MonitorSpeaker },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Orders", href: "/orders", icon: ListOrdered },
  { title: "Devices", href: "/devices", icon: Monitor },
  { title: "Setup", href: "/setup", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background font-mono text-foreground">
        <Sidebar className="border-r border-border">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-border">
            <h1 className="text-xl font-bold tracking-tight text-primary">LineOps KDS</h1>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-muted-foreground uppercase text-xs">Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={location === item.href}>
                        <Link href={item.href} className="flex items-center gap-3 py-6 text-base">
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
