/** Tab-local, presentation-only: sending and access checks stay on the server. */
export function createConnectFlightGuard() {
  const played = new Set<string>();
  return (id: string) => {
    if (!id || played.has(id)) return false;
    played.add(id);
    return true;
  };
}