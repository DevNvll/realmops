import * as React from "react"
import { Outlet, createRootRouteWithContext, useMatches, Link, useRouter, useLocation } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { useQuery } from "@tanstack/react-query"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbLink,
} from "@/components/ui/breadcrumb"
import { ThemeProvider } from "@/hooks/use-theme"
import { HeaderActionsProvider, useHeaderActionsValue } from "@/components/header-actions"
import { useSession, checkSetupStatus } from "@/lib/auth-client"
import { Loader2 } from "lucide-react"

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools"

import type { QueryClient } from "@tanstack/react-query"

interface MyRouterContext {
  queryClient: QueryClient
  title?: string
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootLayout,
})

function HeaderActions() {
  const actions = useHeaderActionsValue()
  return <div className="ml-auto flex items-center gap-2">{actions}</div>
}

function DynamicBreadcrumbs() {
  const matches = useMatches()

  const breadcrumbs = matches
    .filter((match) => match.context.title || (match.staticData as any)?.title)
    .map((match) => ({
      title: (match.staticData as any)?.title || match.context.title,
      path: match.pathname,
    }))

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
             <Link to="/">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {breadcrumbs.map((crumb, index) => {
          if (crumb.path === '/') return null;

          return (
            <React.Fragment key={crumb.path}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {index === breadcrumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.path}>{crumb.title}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function AuthenticatedLayout() {
  return (
    <HeaderActionsProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-4 px-6 border-b border-border/40 bg-background sticky top-0 z-10">
            <div className="flex items-center gap-4 flex-1">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="h-5 bg-border/60"
              />
              <DynamicBreadcrumbs />
              <HeaderActions />
            </div>
          </header>
          <div className="flex flex-1 flex-col bg-zinc-50/50 dark:bg-zinc-950/50 h-[calc(100vh-4rem)] overflow-hidden">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </HeaderActionsProvider>
  )
}

function UnauthenticatedLayout() {
  return <Outlet />
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

function RootLayout() {
  const location = useLocation()
  const router = useRouter()
  const { data: session, isPending: sessionPending } = useSession()

  const { data: setupStatus, isPending: setupPending } = useQuery({
    queryKey: ['setup-status'],
    queryFn: checkSetupStatus,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })

  const isAuthPage = location.pathname === '/login' || location.pathname === '/setup'
  const isLoading = sessionPending || setupPending

  React.useEffect(() => {
    if (isLoading) return

    const isAuthenticated = !!session?.user
    const needsSetup = setupStatus?.needsSetup ?? false

    if (needsSetup && location.pathname !== '/setup') {
      router.navigate({ to: '/setup' })
      return
    }

    if (!needsSetup && location.pathname === '/setup') {
      router.navigate({ to: '/login' })
      return
    }

    if (!isAuthenticated && !isAuthPage && !needsSetup) {
      router.navigate({ to: '/login' })
      return
    }

    if (isAuthenticated && location.pathname === '/login') {
      router.navigate({ to: '/' })
      return
    }
  }, [isLoading, session, setupStatus, location.pathname, router, isAuthPage])

  if (isLoading) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="soar-ui-theme">
        <LoadingScreen />
      </ThemeProvider>
    )
  }

  const isAuthenticated = !!session?.user

  return (
    <ThemeProvider defaultTheme="dark" storageKey="soar-ui-theme">
      {isAuthPage || !isAuthenticated ? (
        <UnauthenticatedLayout />
      ) : (
        <AuthenticatedLayout />
      )}
      <TanStackDevtools
        config={{
          position: "bottom-right",
        }}
        plugins={[
          {
            name: "Tanstack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
          TanStackQueryDevtools,
        ]}
      />
    </ThemeProvider>
  )
}
