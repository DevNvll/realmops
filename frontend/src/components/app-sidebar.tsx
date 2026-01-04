import * as React from "react"
import { Link, useRouterState, useNavigate } from "@tanstack/react-router"
import {
  Package,
  LayoutDashboard,
  Gamepad2,
  Server,
  LogOut,
  Settings,
  ChevronDown,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

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
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]

function SidebarHeaderContent() {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <SidebarHeader className="h-16 flex-row items-center border-b border-border p-0 w-full">
      <Link
        to="/"
        className={cn(
          "flex items-center gap-3 w-full h-full transition-all duration-200",
          isCollapsed ? "justify-center" : "px-4"
        )}
      >
        <div className="size-8 bg-foreground flex items-center justify-center shrink-0">
          <Gamepad2 className="size-4 text-background" />
        </div>
        {!isCollapsed && (
          <span className="text-base font-semibold tracking-tight">
            RealmOps
          </span>
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
    navigate({ to: "/login" })
  }

  if (!session?.user) return null

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : session.user.email?.charAt(0).toUpperCase() || "U"

  return (
    <SidebarFooter className="border-t border-border p-3">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {isCollapsed ? (
                <button className="flex h-10 w-10 items-center justify-center hover:bg-accent/50 transition-colors mx-auto">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-zinc-800 text-zinc-200 text-sm font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              ) : (
                <SidebarMenuButton
                  size="lg"
                  className="h-12 gap-3"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-zinc-800 text-zinc-200 text-sm font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="text-sm font-medium truncate w-full">
                      {session.user.name || "User"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {session.user.email}
                    </span>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </SidebarMenuButton>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <div className="px-2 py-2">
                <p className="text-sm font-medium">
                  {session.user.name || "User"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.user.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive"
              >
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
      <SidebarContent className="px-2">
        <SidebarGroup className="py-4">
          <SidebarGroupLabel className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navMain.map((item) => {
                const isActive = currentPath === item.url || (item.url !== '/' && currentPath.startsWith(item.url))
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "h-10 gap-3 font-medium transition-all duration-200",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Link to={item.url}>
                        <item.icon
                          className={cn(
                            "size-4 shrink-0 transition-colors duration-200",
                            isActive
                              ? "text-foreground"
                              : "text-muted-foreground"
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
