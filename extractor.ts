// -----------------------------------------------------
// extractor.ts
// Full parsing logic ported from your N8N Code node
// -----------------------------------------------------
type ParsedVideo = {
  aweme_id: string;
  caption: string;
  username: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  video_url: string;
  audio_url: string;
  thumbnail_url: string;
  video_duration: number | null;
  video_ratio: string;
  share_url: string;
  music_title: string;
  created_at: string | null;
  on_screen_text: string;
  spark: boolean;
  commission_tag: string;
  shop: boolean;
  product_id: string | null;
  product_name: string;
  product_image: string;
  product_link: string;
};

export function extractVideos(pages: any[]): ParsedVideo[] {
  const videos: any[] = [];
  for (const page of pages) {
    videos.push(...(page.aweme_list ?? []));
  }

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const output: ParsedVideo[] = [];

  for (const v of videos) {
    if (!v?.aweme_id) continue;

    const w = v.video?.width ?? 0;
    const h = v.video?.height ?? 0;
    const ratio = w && h ? `${w / gcd(w, h)}:${h / gcd(w, h)}` : '';

    let product_id: string | null = null;
    let product_name = '';
    let product_image = '';
    let product_link = '';

    if (v.share_info?.share_url) {
      const match = decodeURIComponent(v.share_info.share_url).match(
        /"placeholder_product_id":"(\d+)"/
      );
      if (match) {
        product_id = match[1];
        product_link = `https://shop.tiktok.com/view/product/${product_id}`;
      }
    }

    const anchor = (v.anchors || []).find(
      (a: any) =>
        (a.component_key ?? '').includes('anchor_complex_shop') || a.component_key === 'anchor_shop'
    );

    if (anchor?.extra) {
      try {
        const raw = typeof anchor.extra === 'string' ? anchor.extra : JSON.stringify(anchor.extra);
        const idMatch = raw.match(/"product_id":\s*"?(\d+)"?/);
        if (!product_id && idMatch) product_id = idMatch[1];

        const outerArr = JSON.parse(raw);
        const outer = outerArr[0] ?? {};
        const metaRaw = outer.extra ?? '{}';
        const meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;

        product_name = meta.title ?? meta.elastic_title ?? outer.keyword ?? product_name;
        product_image =
          meta.cover_url ||
          (meta.cover ? `https://p16-oec-ttp.tiktokcdn-us.com/${meta.cover}` : '') ||
          outer.icon?.url_list?.[0] ||
          product_image;

        if (product_id && !product_link)
          product_link = `https://shop.tiktok.com/view/product/${product_id}`;
      } catch {}
    }

    let rawDur = v.video?.duration ?? v.added_sound_music_info?.audition_duration ?? null;
    const video_duration =
      rawDur == null ? null : rawDur > 600 ? Math.round(rawDur / 1000) : rawDur;

    output.push({
      aweme_id: v.aweme_id,
      caption: v.desc ?? '',
      username: v.author?.unique_id ?? '',
      views: v.statistics?.play_count ?? 0,
      likes: v.statistics?.digg_count ?? 0,
      shares: v.statistics?.share_count ?? 0,
      comments: v.statistics?.comment_count ?? 0,
      video_url: v.video?.play_addr?.url_list?.[0] ?? '',
      audio_url: v.video?.download_addr?.url_list?.[0] ?? '',
      thumbnail_url: v.video?.cover?.url_list?.[0] ?? '',
      video_duration,
      video_ratio: ratio,
      share_url: v.share_info?.share_url ?? '',
      music_title: v.music?.title ?? '',
      created_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
      on_screen_text:
        (v.interaction_stickers || []).map((s: any) => s.text_info).join('; ') || '',
      spark: v.commerce_info?.ad_source === 1,
      commission_tag: v.commerce_info?.bc_label_test_text ?? '',
      shop: !!product_id,
      product_id,
      product_name,
      product_image,
      product_link,
    });
  }

  return output;
}
