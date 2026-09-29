import { useEffect, useRef, useState } from "react";

/** Returns a counter that increases whenever `n` goes up — use as a React key to replay a bump animation. */
export function useBump(n: number) {
  const prev = useRef(n);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (n > prev.current) setTick((t) => t + 1);
    prev.current = n;
  }, [n]);
  return tick;
}
