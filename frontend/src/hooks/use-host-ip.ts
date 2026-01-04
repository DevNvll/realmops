import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useHostIP() {
  const { data } = useQuery({
    queryKey: ['system-info'],
    queryFn: api.system.info,
    staleTime: Infinity, // IP doesn't change during session
    gcTime: Infinity,
  })

  return data?.hostIP ?? window.location.hostname
}
