import { NextRequest, NextResponse } from "next/server";
import { markdownToPdf } from "@/lib/export/markdown-to-pdf";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { markdown, title = "Exported Document" } = body;

    if (!markdown) {
      return NextResponse.json({ error: "Markdown content is required" }, { status: 400 });
    }

    const pdfBuffer = await markdownToPdf(markdown, title);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF Export Error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
