import { NextRequest, NextResponse } from "next/server";
import { markdownToDocx } from "@/lib/export/markdown-to-docx";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { markdown, title = "Exported Document" } = body;

    if (!markdown) {
      return NextResponse.json({ error: "Markdown content is required" }, { status: 400 });
    }

    const docxBuffer = await markdownToDocx(markdown, title);

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx"`,
      },
    });
  } catch (error) {
    console.error("DOCX Export Error:", error);
    return NextResponse.json({ error: "Failed to generate DOCX" }, { status: 500 });
  }
}
