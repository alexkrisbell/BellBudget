import { create } from 'zustand'

interface AppState {
  householdId: string | null
  currentMonth: number
  currentYear: number
  notifCount: number
  setHouseholdId: (id: string | null) => void
  setCurrentMonth: (month: number, year: number) => void
  setNotifCount: (count: number) => void
  incrementNotifCount: () => void
  decrementNotifCount: () => void
}

export const useAppStore = create<AppState>((set) => ({
  householdId: null,
  currentMonth: new Date().getMonth() + 1,
  currentYear: new Date().getFullYear(),
  notifCount: 0,
  setHouseholdId: (id) => set({ householdId: id }),
  setCurrentMonth: (month, year) => set({ currentMonth: month, currentYear: year }),
  setNotifCount: (count) => set({ notifCount: count }),
  incrementNotifCount: () =>
    set((state) => ({ notifCount: state.notifCount + 1 })),
  decrementNotifCount: () =>
    set((state) => ({ notifCount: Math.max(0, state.notifCount - 1) })),
}))
