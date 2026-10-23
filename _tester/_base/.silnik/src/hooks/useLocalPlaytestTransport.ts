'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { checkLocalPlaytestTransport, getLocalPlaytestTransport, getServerPlaytestTransport, subscribeLocalPlaytestTransport } from '@/lib/local-playtest-transport';

export function useLocalPlaytestTransport() {
  const state = useSyncExternalStore(subscribeLocalPlaytestTransport, getLocalPlaytestTransport, getServerPlaytestTransport);
  useEffect(() => { void checkLocalPlaytestTransport(); }, []);
  return state;
}
