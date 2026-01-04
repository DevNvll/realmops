import React, { createContext, useContext, useState, useLayoutEffect, useCallback, useRef } from 'react'

interface HeaderActionsContextType {
  subscribe: (callback: () => void) => () => void
  getActions: () => React.ReactNode
  setActions: (actions: React.ReactNode) => void
}

const HeaderActionsContext = createContext<HeaderActionsContextType | undefined>(undefined)

export function HeaderActionsProvider({ children }: { children: React.ReactNode }) {
  const actionsRef = useRef<React.ReactNode>(null)
  const subscribersRef = useRef<Set<() => void>>(new Set())

  const subscribe = useCallback((callback: () => void) => {
    subscribersRef.current.add(callback)
    return () => subscribersRef.current.delete(callback)
  }, [])

  const getActions = useCallback(() => actionsRef.current, [])

  const setActions = useCallback((actions: React.ReactNode) => {
    actionsRef.current = actions
    subscribersRef.current.forEach(cb => cb())
  }, [])

  const contextValue = React.useMemo(
    () => ({ subscribe, getActions, setActions }),
    [subscribe, getActions, setActions]
  )

  return (
    <HeaderActionsContext.Provider value={contextValue}>
      {children}
    </HeaderActionsContext.Provider>
  )
}

export function useHeaderActions(actions: React.ReactNode) {
  const context = useContext(HeaderActionsContext)

  useLayoutEffect(() => {
    if (!context) return
    context.setActions(actions)
    return () => context.setActions(null)
  })
}

export function useHeaderActionsValue() {
  const context = useContext(HeaderActionsContext)
  if (!context) {
    throw new Error('useHeaderActionsValue must be used within a HeaderActionsProvider')
  }

  const [, forceUpdate] = useState({})

  useLayoutEffect(() => {
    return context.subscribe(() => forceUpdate({}))
  }, [context])

  return context.getActions()
}
