import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// html2canvasのキャプチャ解像度倍率。セクション境界のpx→mm変換で再利用する。
const CAPTURE_SCALE = 2;

// このdata-pdf-section名を持つセクションは「自由に改ページしてよい」セクション。
// 境界スナップの対象から除外し、従来通り固定高さでの機械的な輪切りを許容する
// （詳細分析レポートのような長文セクションや、末尾のフッターが該当）。
const FREE_FLOW_SECTIONS = new Set(["report", "footer"]);

/**
 * DOM上の [data-pdf-section] 要素から「ここで改ページしてよい」Y座標（CSS px、
 * キャプチャ対象要素の上端を0とする相対座標）の一覧を取得する。
 * FREE_FLOW_SECTIONS に該当するセクションは、内部で分断されても良いため対象外。
 */
function collectSectionBoundaries(root: HTMLElement): number[] {
  const rootTop = root.getBoundingClientRect().top;
  const sections = Array.from(
    root.querySelectorAll<HTMLElement>("[data-pdf-section]")
  );

  const boundaries: number[] = [];
  for (const section of sections) {
    const name = section.dataset.pdfSection ?? "";
    if (FREE_FLOW_SECTIONS.has(name)) continue;
    const rect = section.getBoundingClientRect();
    // セクションの下端 = 「ここまでは分断せずに収める」境界線
    boundaries.push(rect.bottom - rootTop);
  }
  boundaries.sort((a, b) => a - b);
  return boundaries;
}

export async function generatePdf(elementId: string, filename: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("PDF要素が見つかりません");

  // キャプチャ前にDOM上でセクション境界（CSS px）を測っておく
  // （html2canvasのcanvasは scale: 2 で描画されるため、後でCAPTURE_SCALE倍して揃える）
  const sectionBoundariesPx = collectSectionBoundaries(el);

  // Capture at 2x for retina quality
  const canvas = await html2canvas(el, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const imgW = canvas.width;
  const imgH = canvas.height;

  // A4: 210 x 297 mm。常に標準A4サイズを使い、長いレポートは下の while で複数ページに分割する
  // (以前は1ページがコンテンツ全体の高さになる特大サイズを使っていたため、印刷・銀行提出時に正しく出力できなかった)
  const pdfW = 210;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageH = pdf.internal.pageSize.getHeight();
  const pageW = pdf.internal.pageSize.getWidth();
  const ratio = pageW / imgW;
  const totalH = imgH * ratio;

  // セクション境界をmm単位（= このファイル内のyOffset/pageHと同じ座標系）に変換
  // CSS px → canvas px（×CAPTURE_SCALE） → mm（×ratio）
  const sectionBoundariesMm = sectionBoundariesPx
    .map((b) => b * CAPTURE_SCALE * ratio)
    .filter((b) => b > 0 && b < totalH);

  let yOffset = 0;
  let page = 0;

  while (yOffset < totalH) {
    if (page > 0) pdf.addPage();

    pdf.addImage(
      imgData,
      "PNG",
      0,
      -yOffset,
      pageW,
      totalH
    );

    const naturalNextY = yOffset + pageH;

    if (naturalNextY < totalH) {
      // 次ページの終端（naturalNextY）に最も近い、かつそれを超えないセクション境界を探す。
      // 見つかれば改ページ位置をそこにスナップし、カード・表がページの境目で
      // 分断されるのを防ぐ。見つからない場合（1セクションがpageHより大きい場合）は
      // 従来通り固定高さで機械的に輪切りにする。
      let snapped = naturalNextY;
      for (const boundary of sectionBoundariesMm) {
        if (boundary > yOffset && boundary <= naturalNextY) {
          snapped = boundary;
        } else if (boundary > naturalNextY) {
          break; // ソート済みなのでこれ以降は候補にならない
        }
      }
      yOffset = snapped;
    } else {
      yOffset = naturalNextY;
    }

    page++;
  }

  pdf.save(filename);
}
