import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import {
  Package,
  LayoutDashboard,
  Gamepad2,
} from "lucide-react"
import { cn } from "@/lib/utils"

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
  useSidebar,
} from "@/components/ui/sidebar"

const navMain = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Game Packs",
    url: "/packs",
    icon: Package,
  },
]

function SidebarHeaderContent() {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <SidebarHeader className="!h-16 !flex-row !items-center border-b border-border/40 !p-0 justify-center group-data-[state=expanded]:justify-start group-data-[state=expanded]:px-4">
      <Link to="/" className="flex items-center gap-2">
        {isCollapsed ? (
          <Gamepad2 className="size-5 text-textMain" />
        ) : (
          <span className="text-xl font-bold tracking-tight uppercase text-textMain">Soar</span>
        )}
      </Link>
    </SidebarHeader>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeaderContent />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold text-textMuted/60 uppercase tracking-widest">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => {
                const isActive = currentPath === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "text-[14px] font-medium transition-all bg-transparent",
                        isActive
                          ? "bg-surfaceHighlight text-textMain"
                          : "text-textMuted hover:bg-surfaceHighlight/50 hover:text-textMain"
                      )}
                    >
                      <Link to={item.url}>
                        <item.icon
                          className={cn(
                            "shrink-0",
                            isActive ? "text-brand" : "text-textMuted/60"
                          )}
                        />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  )
}
