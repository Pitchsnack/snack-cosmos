type EitherText = string | null | undefined;
const filled = (value: EitherText) => !!value?.trim();

export function sellerDescriptionTagsDone(s: {
  short_description?: EitherText; short_description_th?: EitherText;
  product_tags?: string[] | null; product_tags_th?: string[] | null;
  market_tags?: string[] | null; market_tags_th?: string[] | null;
}) {
  const tags = (s.product_tags?.length ?? 0) + (s.product_tags_th?.length ?? 0)
    + (s.market_tags?.length ?? 0) + (s.market_tags_th?.length ?? 0);
  return (filled(s.short_description) || filled(s.short_description_th)) && tags > 0;
}

export function sellerHeadlineDone(row: { headline?: EitherText; headline_th?: EitherText } | null | undefined) {
  return !!row && (filled(row.headline) || filled(row.headline_th));
}
