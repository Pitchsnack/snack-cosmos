import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryPage } from "@/components/public-site/discovery-page";
import { getDiscovery } from "@/lib/discovery.functions";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

const discoveryQuery = queryOptions({queryKey:['public-discovery'],queryFn:()=>getDiscovery(),staleTime:60000});

export const Route = createFileRoute("/discovery")({
  loader: ({context})=>context.queryClient.ensureQueryData(discoveryQuery),
  head: () => ({
    meta: [
      { title: "PitchSnack · Discovery" },
      { name: "description", content: "Explore open buy orders and confidential Thai businesses for sale on PitchSnack." },
      { property: "og:title", content: "PitchSnack · Discovery" },
      { property: "og:description", content: "Discover buyers seeking businesses and owners open to selling, with identities protected until agreement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiscoveryRoute,
});
function DiscoveryRoute(){const {data}=useSuspenseQuery(discoveryQuery);return <DiscoveryPage data={data}/>;}
