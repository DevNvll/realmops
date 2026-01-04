import { createFileRoute, Outlet, Link, useRouterState } from '@tanstack/react-router'
import { Key, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
  staticData: {
    title: 'Settings'
  }
})

const settingsNav = [
  {
    title: 'SSH Keys',
    href: '/settings/ssh-keys',
    icon: Key,
    description: 'Manage SSH keys for SFTP access',
  },
  {
    title: 'Security',
    href: '/settings/security',
    icon: Shield,
    description: 'Security and authentication settings',
    disabled: true,
  },
]

function SettingsLayout() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  return (
    <div className="flex flex-1 flex-col gap-8 p-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight uppercase">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application settings and preferences.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <nav className="md:w-64 shrink-0">
          <ul className="space-y-1">
            {settingsNav.map((item) => {
              const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  {item.disabled ? (
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-not-allowed opacity-50",
                        "text-muted-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </div>
                  ) : (
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
