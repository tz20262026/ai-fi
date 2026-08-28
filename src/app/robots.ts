import type { MetadataRoute } from "next";

// 非公開の社内ツール。検索エンジンには一切クロールさせない。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
