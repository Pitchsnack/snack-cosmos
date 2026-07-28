/**
 * Gateway adapter — FAILS CLOSED.
 *
 * The approved SnackPortal2 publication contract does not exist yet:
 *   POST /tenant/startups/{startup_ref}/publish
 *   POST /tenant/startups/{startup_ref}/unpublish
 *   GET  /directory/startups
 *   GET  /directory/startups/{publication_ref}
 *
 * Until those endpoints exist and are approved, this adapter returns an
 * explicit PublicationCapabilityUnavailable outcome. It NEVER returns mock
 * success and NEVER marks a startup as published without a real backend
 * response. No endpoint is created or modified by this file.
 */
import { getGatewayBaseUrl } from "@/lib/sp2/gateway-client";
import type {
  PublicationAdapter,
  PublicationOutcome,
  StartupPublication,
  StartupRef,
} from "./types";

export const PUBLICATION_CAPABILITY_UNAVAILABLE =
  "PublicationCapabilityUnavailable: the approved directory publication endpoints are not available.";

function unavailable<T>(): PublicationOutcome<T> {
  return { kind: "capability_unavailable", reason: PUBLICATION_CAPABILITY_UNAVAILABLE };
}

/**
 * Contract probe only. Even when a Gateway base URL is configured, the
 * publication capability is treated as unavailable because the publication
 * contract has not been published/approved. Flipping this on requires a
 * backend contract change, not a frontend edit.
 */
const PUBLICATION_CONTRACT_AVAILABLE = false;

export const gatewayPublicationAdapter: PublicationAdapter = {
  mode: "gateway",
  get canMutate() {
    return PUBLICATION_CONTRACT_AVAILABLE && getGatewayBaseUrl() !== null;
  },
  previewNotice: null,

  async getStatus(startupRef: StartupRef): Promise<PublicationOutcome<StartupPublication>> {
    if (!PUBLICATION_CONTRACT_AVAILABLE) return unavailable<StartupPublication>();
    // Unreachable until the approved contract exists.
    void startupRef;
    return unavailable<StartupPublication>();
  },

  async publish() {
    return unavailable<StartupPublication>();
  },

  async unpublish() {
    return unavailable<StartupPublication>();
  },
};
