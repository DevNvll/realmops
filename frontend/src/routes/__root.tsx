import * as React from "react"
import { Outlet, createRootRouteWithContext, useMatches, Link } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

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
  
  // Filter out the root route and routes without context/meta if needed
  // For now, we'll assume routes have a staticData.title or we use the path
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
          if (crumb.path === '/') return null; // Skip dashboard as it's hardcoded
          
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

function RootLayout() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="soar-ui-theme">
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
      </HeaderActionsProvider>
    </ThemeProvider>
  )
}
