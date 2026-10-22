import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getStorageConfig, validateUploadFile, uploadImageFile } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    // 1. Authorization check: must be authenticated user
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized. Please sign in to upload files." }, { status: 401 });
    }

    // 2. Storage configuration check
    const storageConfig = getStorageConfig();
    if (!storageConfig.isConfigured) {
      return NextResponse.json(
        {
          error: "Cloud storage is not configured on this server.",
          details: `Missing environment configuration: ${storageConfig.missingKeys.join(", ")}. Please contact administration or provide direct image web links in reference fields.`,
          isConfigured: false,
        },
        { status: 503 }
      );
    }

    // 3. Parse formData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided in form-data." }, { status: 400 });
    }

    // 4. Validate file type and size (5MB max)
    const validation = validateUploadFile(file.type, file.size, 5 * 1024 * 1024);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 5. Read buffer and invoke storage provider
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadResult = await uploadImageFile(buffer, file.name, file.type);
    if (!uploadResult.success) {
      return NextResponse.json(
        {
          error: uploadResult.error || "File upload failed.",
          requiresConfiguration: uploadResult.requiresConfiguration,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fileUrl: uploadResult.url,
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
    });
  } catch (error: unknown) {
    console.error("[Upload API Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error during upload." },
      { status: 500 }
    );
  }
}
