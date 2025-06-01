import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import crypto from "crypto";
import { sendResetEmail } from "@/app/lib/email";
import {
  handleApiError,
  validateEmail,
  validateRequiredFields,
  createApiError,
} from "../../lib/error-handler";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const missingField = validateRequiredFields(body, ["email"]);
    if (missingField) {
      throw createApiError(missingField, 400);
    }

    const { email } = body;

    // Validate email format
    if (!validateEmail(email)) {
      throw createApiError("Invalid email format", 400);
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return success even if user doesn't exist for security
      return NextResponse.json(
        {
          message:
            "If an account exists, you will receive a password reset email",
        },
        { status: 200 }
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to database
    await prisma.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send reset email
    try {
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
      await sendResetEmail(email, resetUrl);
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
      throw createApiError("Failed to send reset email", 500);
    }

    return NextResponse.json(
      {
        message:
          "If an account exists, you will receive a password reset email",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
