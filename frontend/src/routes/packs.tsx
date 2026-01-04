import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/packs')({
  component: PacksLayout
})

function PacksLayout() {
  return <Outlet />
}
