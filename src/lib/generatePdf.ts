import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function generatePdf(elementId: string, filename: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("PDF要素が見つかりません");

  // Capture at 2x for retina quality
  const canvas = await html2canvas(el, {
    scale: 2,
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

    yOffset += pageH;
    page++;
  }

  pdf.save(filename);
}
