export const PIPELINE_LOGO_TRANSFORM = { width: 88, height: 88, resize: 'contain' as const };

/** No stored copies; originals remain available if image transforms are unsupported. */
export async function signPipelineLogos(bucket: any, paths: string[]) {
  const logos: Record<string, { small: string; original: string }> = {};
  const unique = [...new Set(paths)];
  const originals = await bucket.createSignedUrls(unique, 3600);
  for (const row of originals.data ?? []) {
    if (row.path && row.signedUrl) logos[row.path] = { small: row.signedUrl, original: row.signedUrl };
  }
  for (let i = 0; i < unique.length; i += 6) {
    await Promise.all(unique.slice(i, i + 6).map(async path => {
      const original = logos[path];
      if (!original) return;
      try {
        const result = await bucket.createSignedUrl(path, 3600, { transform: PIPELINE_LOGO_TRANSFORM });
        if (!result.error && result.data?.signedUrl) original.small = result.data.signedUrl;
      } catch { /* Keep the original. */ }
    }));
  }
  return logos;
}