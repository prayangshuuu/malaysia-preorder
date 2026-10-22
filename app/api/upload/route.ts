import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getStorageConfig, validateUploadFile, uploadImageFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Image / Attachment Upload API Route
 *
 * Enforces:
 * 1. User authentication
 * 2. Storage configuration status (graceful message if unconfigured, no fake uploads)
 * 3. File type check (JPEG, PNG, WEBP, GIF, AVIF)
 * 4. File size limits (max 5MB)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required to upload attachments." },
        { status: 401 }
      );
    }

    const storageConfig = getStorageConfig();
    if (!storageConfig.isConfigured) {
      return NextResponse.json(
        {
          error: "Cloud storage is not currently configured by the administrator.",
          requiresConfiguration: true,
          missingKeys: storageConfig.missingKeys,
        },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in form data." },
        { status: 400 }
      );
    }

    // Validate type and size
    const validation = validateUploadFile(file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await uploadImageFile(buffer, file.name, file.type);
    if (!uploadResult.success) {
      return NextResponse.json(
        { error: uploadResult.error || "Failed to upload file." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        url: uploadResult.url,
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("[Upload API] Error:", err);
    return NextResponse.json(
      { error: "Internal server error during upload." },
      { status: 500 }
    );
  }
}
