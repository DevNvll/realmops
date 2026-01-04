import * as React from "react"
import { Link, useRouterState, useNavigate } from "@tanstack/react-router"
import {
  Package,
  LayoutDashboard,
  Gamepad2,
  Server,
  LogOut,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession, signOut } from "@/lib/auth-client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navMain = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Servers",
    url: "/servers",
    icon: Server,
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
    <SidebarHeader className="!h-16 !flex-row !items-center border-b border-border/40 !p-0 !w-full">
      <Link
        to="/"
        className={cn(
          "flex items-center gap-3 w-full",
          isCollapsed ? "justify-center" : "px-4"
        )}
      >
        <div className="size-8 bg-brand flex items-center justify-center shrink-0">
          <Gamepad2 className="size-4 text-white" />
        </div>
        {!isCollapsed && (
          <span className="text-lg font-bold tracking-tight uppercase text-textMain">Soar</span>
        )}
      </Link>
    </SidebarHeader>
  )
}

function SidebarUserFooter() {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const { data: session } = useSession()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/login' })
  }

  if (!session?.user) return null

  return (
    <SidebarFooter className="border-t border-border/40">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                className={cn(
                  "text-[14px] font-medium transition-all bg-transparent",
                  "text-textMuted hover:bg-surfaceHighlight/50 hover:text-textMain"
                )}
              >
                <User className="shrink-0 text-textMuted/60" />
                {!isCollapsed && (
                  <span className="truncate">{session.user.name || session.user.email}</span>
                )}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {session.user.email}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:text-red-500">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
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
      <SidebarUserFooter />
    </Sidebar>
  )
}
