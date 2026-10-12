import { useCallback, useEffect, useRef, useState } from "react";

/** Polls `load` every `ms` (Monad blocks are ~400ms, so 1s keeps the UI live). */
export function usePoll<T>(load: () => Promise<T>, ms = 1000, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (alive) await refresh();
    };
    tick();
    const id = setInterval(tick, ms);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, refresh, ...deps]);

  return { data, error, refresh };
}

/** Runs an async action with busy/error/ok state for buttons. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const msg = await fn();
      if (msg) setOk(msg);
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
      // Monad's RPC reports an unfunded sender as -32602 "invalid parameters".
      setError(/invalid parameters|insufficient funds/i.test(msg) ? "Not enough MON for gas. Fund this account with testnet MON and retry." : msg);
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, ok, run };
}
