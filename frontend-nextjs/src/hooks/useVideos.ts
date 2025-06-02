// src/hooks/useVideos.ts
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

//
// 1) The Video interface must match your actual `shop_videos` columns exactly.
//    Copy/paste these property names from your Supabase table:
//
//      aweme_id, username, caption, views, likes, shares, comments, shop, spark,
//      video_url, music_title, created_at, scraped_at, share_url, audio_url,
//      on_screen_text, thumbnail_url, video_duration, video_ratio,
//      product_id, product_name, product_image, product_link, category,
//      price, shop_name
//
export interface Video {
  aweme_id: string;
  username: string | null;
  caption: string | null;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  shop: boolean;
  spark: boolean;
  video_url: string | null;
  music_title: string | null;
  created_at: string | null;
  scraped_at: string | null;
  share_url: string | null;
  audio_url: string | null;
  on_screen_text: string | null;
  thumbnail_url: string | null;
  video_duration: number | null;
  video_ratio: string | null;
  product_id: string | null;
  product_name: string | null;
  product_image: string | null;     // ← exactly matches your "product_image" column
  product_link: string | null;
  category: string | null;
  price: string | null;
  shop_name: string | null;
  profile_pic?: string | null;      // Optional profile picture URL
}

//
// 2) FilterValues interface (you can adjust this as needed).
//
export interface FilterValues {
  startDate: Date | null;
  productId: string | null;
  postedWithin: "any" | "1" | "3" | "5";
  adType: "all" | "organic" | "ad";
  gender: "all" | "male" | "female" | "other";
  sortBy: "view_growth" | "engagement" | "recent";
}

//
// 3) The hook that fetches from Supabase. We do select<Video,Video>("*")
//    so that Supabase returns _all_ columns, which TypeScript will cast to our Video interface.
//
export function useVideos(filters: FilterValues) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // ── Fetch every column from shop_videos, cast to Video type ──
        let { data, error: sbError } = await supabase
          .from("shop_videos")
          .select("*");

        if (sbError) {
          throw sbError;
        }

        setVideos(data ?? []);
      } catch (err: any) {
        setError(err.message);
        setVideos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [
    // You can add filters.productId, filters.startDate, etc. here if you plan to
    // filter your Supabase query. For now, this will simply load _all_ rows.
    filters.productId,
    filters.startDate,
    // (Add postedWithin, adType, gender, etc. if you wire them into the query)
  ]);

  return { videos, loading, error };
}
