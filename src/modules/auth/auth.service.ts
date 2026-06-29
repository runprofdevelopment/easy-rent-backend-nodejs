import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as nodemailer from 'nodemailer';
import { RefreshTokenInput } from './dto/refresh-token.input';
import { RefreshTokenResponse } from './dto/refresh-token-response.type';
import { ResetPasswordInput } from './dto/reset-password.input';
import { ResetPasswordResponse } from './dto/reset-password-response.type';
import { ChangePasswordInput } from './dto/change-password.input';
import { ChangePasswordResponse } from './dto/change-password-response.type';
import { UnauthorizedException } from '@nestjs/common';
import { firebaseConfig } from '../../config/firebase.config';
import { contactEmailConfig } from '../../config/contact-email.config';

@Injectable()
export class AuthService {
  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      // Initialize Firebase Admin if not already initialized
      if (!admin.apps.length) {
        const serviceAccountPath = this.configService.get<string>(
          'GOOGLE_APPLICATION_CREDENTIALS',
        );
        const projectId =
          this.configService.get<string>('FIREBASE_PROJECT_ID') || '';

        if (serviceAccountPath) {
          const resolvedPath = serviceAccountPath.startsWith('./')
            ? join(process.cwd(), serviceAccountPath)
            : serviceAccountPath;

          if (existsSync(resolvedPath)) {
            try {
              const serviceAccount = require(resolvedPath);
              admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: projectId || serviceAccount.project_id,
              });
              console.info(
                'Firebase Admin initialized with service account credentials',
              );
            } catch (error) {
              console.warn(
                `Failed to load Firebase credentials: ${error.message}`,
              );
            }
          }
        } else {
          // Try to initialize with default credentials
          try {
            admin.initializeApp({
              projectId: projectId,
            });
            console.info('Firebase Admin initialized with default credentials');
          } catch (error) {
            console.warn(
              `Failed to initialize Firebase Admin: ${error.message}`,
            );
          }
        }
      }
    } catch (error) {
      console.error(`Error during Firebase initialization: ${error.message}`);
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Shared HTML email delivery (Nodemailer, SendGrid, or custom API).
   */
  private async sendHtmlEmail(
    recipientEmail: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const emailProvider = this.configService.get<string>('EMAIL_PROVIDER');
    const emailSmtpHost =
   
      contactEmailConfig.smtpHost;
    const emailSmtpPort =
   
      contactEmailConfig.smtpPort;
    const emailSecure =

      contactEmailConfig.secure;
    const emailUser =
    contactEmailConfig.user;
    const emailPassword =
    
      contactEmailConfig.password;
    const emailFrom =
      contactEmailConfig.from;
    const sendGridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const emailApiUrl = this.configService.get<string>('EMAIL_API_URL');
    const emailApiKey = this.configService.get<string>('EMAIL_API_KEY');

    try {
      if (
        (emailProvider === 'nodemailer' || emailSmtpHost) &&
        emailUser &&
        emailPassword
      ) {
        let fromEmail = emailUser;
        let fromName = 'Easy Rent';
        if (emailFrom) {
          const fromMatch = emailFrom.match(/^(.+?)\s*<(.+?)>$/);
          if (fromMatch) {
            fromName = fromMatch[1].trim();
            fromEmail = fromMatch[2].trim();
          } else {
            fromEmail = emailFrom;
          }
        }

        const transporter = nodemailer.createTransport({
          host: emailSmtpHost || 'smtp.gmail.com',
          port: parseInt(emailSmtpPort || '465', 10),
          secure: emailSecure === 'true',
          auth: {
            user: emailUser,
            pass: emailPassword,
          },
        });

        const mailOptions = {
          from: `${fromName} <${fromEmail}>`,
          to: recipientEmail,
          subject,
          html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully via Nodemailer:', info.messageId);
      } else if (sendGridApiKey) {
        const sendGridUrl = 'https://api.sendgrid.com/v3/mail/send';
        const sendGridResponse = await fetch(sendGridUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sendGridApiKey}`,
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: recipientEmail }],
              },
            ],
            from: {
              email:
                this.configService.get<string>('EMAIL_FROM') ||
                'noreply@example.com',
              name: 'Easy Rent',
            },
            subject,
            content: [
              {
                type: 'text/html',
                value: html,
              },
            ],
          }),
        });

        if (!sendGridResponse.ok) {
          const errorText = await sendGridResponse.text();
          console.error('SendGrid error:', errorText);
          throw new Error(
            `SendGrid API error: ${sendGridResponse.status} - ${errorText}`,
          );
        }

        console.log('Email sent successfully via SendGrid');
      } else if (emailApiUrl && emailApiKey) {
        const emailResponse = await fetch(emailApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${emailApiKey}`,
          },
          body: JSON.stringify({
            to: recipientEmail,
            subject,
            html,
          }),
        });

        if (!emailResponse.ok) {
          let errorData: any = {};
          const contentType = emailResponse.headers.get('content-type');

          try {
            if (contentType && contentType.includes('application/json')) {
              errorData = await emailResponse.json();
            } else {
              const textError = await emailResponse.text();
              errorData = {
                message:
                  textError ||
                  `HTTP ${emailResponse.status}: ${emailResponse.statusText}`,
              };
            }
          } catch (parseError) {
            errorData = {
              message: `HTTP ${emailResponse.status}: ${emailResponse.statusText}`,
              status: emailResponse.status,
              statusText: emailResponse.statusText,
            };
          }

          console.error('Email API error:', errorData);
          throw new Error(
            `Email API error: ${errorData?.message || 'Unknown error'}`,
          );
        }

        console.log('Email sent successfully via custom email API');
      } else {
        console.warn(
          'No email service configured. Cannot send custom email templates.',
        );
        console.warn(
          'To use custom email templates, configure one of the following:',
        );
        console.warn(
          '1. Nodemailer/SMTP: Set EMAIL_PROVIDER=nodemailer, EMAIL_SMTP_HOST, EMAIL_USER, EMAIL_PASSWORD',
        );
        console.warn('2. SendGrid: Set SENDGRID_API_KEY');
        console.warn('3. Custom API: Set EMAIL_API_URL and EMAIL_API_KEY');

        throw new BadRequestException(
          'Email service not configured. Please configure Nodemailer (EMAIL_SMTP_HOST, EMAIL_USER, EMAIL_PASSWORD), SendGrid (SENDGRID_API_KEY), or custom email API (EMAIL_API_URL, EMAIL_API_KEY) to send custom email templates.',
        );
      }
    } catch (emailError) {
      if (emailError instanceof BadRequestException) {
        throw emailError;
      }

      console.error('Email sending error:', {
        message: emailError.message,
        stack: emailError.stack,
      });

      throw new BadRequestException(
        `Failed to send email: ${emailError.message || 'Unknown error'}. Please check your email service configuration (Nodemailer/SMTP, SendGrid, or custom API).`,
      );
    }
  }

  /**
   * Send login email and generated password for new employees (not a reset link).
   */
  async sendEmployeeCredentialsEmail(
    email: string,
    password: string,
    language: string,
  ): Promise<void> {
    const lang = language && language.toLowerCase() === 'ar' ? 'ar' : 'en';
    const safeEmail = this.escapeHtml(email);
    const safePassword = this.escapeHtml(password);

    const subject =
      lang === 'ar'
        ? 'بيانات حسابك في Easy Rent'
        : 'Your Easy Rent account credentials';

    const html =
      lang === 'ar'
        ? `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; background:#f5f5f5; padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border-top:4px solid #4DBFA6;">
    <h1 style="color:#2A3450;margin:0 0 16px;">مرحباً</h1>
    <p style="color:#555;line-height:1.6;">تم إنشاء حسابك. استخدم البيانات التالية لتسجيل الدخول:</p>
    <table style="width:100%;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#7A869A;">البريد الإلكتروني</td></tr>
      <tr><td style="padding:8px 12px;background:#f0f4f8;border-radius:6px;font-family:monospace;font-size:15px;">${safeEmail}</td></tr>
      <tr><td style="padding:8px 0;color:#7A869A;">كلمة المرور</td></tr>
      <tr><td style="padding:8px 12px;background:#f0f4f8;border-radius:6px;font-family:monospace;font-size:15px;">${safePassword}</td></tr>
    </table>
    <p style="color:#888;font-size:13px;margin-top:24px;">ننصحك بتغيير كلمة المرور بعد أول تسجيل دخول.</p>
  </div></body></html>`
        : `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; background:#f5f5f5; padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border-top:4px solid #4DBFA6;">
    <h1 style="color:#2A3450;margin:0 0 16px;">Welcome</h1>
    <p style="color:#555;line-height:1.6;">Your account has been created. Sign in with:</p>
    <table style="width:100%;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#7A869A;">Email</td></tr>
      <tr><td style="padding:8px 12px;background:#f0f4f8;border-radius:6px;font-family:monospace;font-size:15px;">${safeEmail}</td></tr>
      <tr><td style="padding:8px 0;color:#7A869A;">Password</td></tr>
      <tr><td style="padding:8px 12px;background:#f0f4f8;border-radius:6px;font-family:monospace;font-size:15px;">${safePassword}</td></tr>
    </table>
    <p style="color:#888;font-size:13px;margin-top:24px;">Please change your password after your first login.</p>
  </div></body></html>`;

    await this.sendHtmlEmail(email, subject, html);
  }

  async refreshToken(
    refreshTokenInput: RefreshTokenInput,
  ): Promise<RefreshTokenResponse> {
    const { uid } = refreshTokenInput;

    if (!uid || uid.trim() === '') {
      throw new BadRequestException('UID is required');
    }

    try {
      // Verify Firebase Admin is initialized
      if (!admin.apps.length) {
        throw new Error(
          'Firebase Admin SDK is not initialized. Please check your configuration.',
        );
      }

      // Verify the user exists
      try {
        await admin.auth().getUser(uid);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          throw new BadRequestException(`User with uid ${uid} not found`);
        }
        throw error;
      }

      // Create a custom token for the user using Firebase Admin SDK
      // This requires the service account to have proper IAM roles
      const customToken = await admin.auth().createCustomToken(uid);

      return {
        token: customToken,
        uid: uid,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle permission errors with helpful guidance
      if (
        error.message?.includes('PERMISSION_DENIED') ||
        error.message?.includes('permission') ||
        error.message?.includes('Permission') ||
        error.message?.includes('signBlob') ||
        error.message?.includes('iam.serviceAccounts') ||
        error.message?.includes('403') ||
        error.code === 'permission-denied'
      ) {
        const projectId =
          this.configService.get<string>('FIREBASE_PROJECT_ID') || '';

        // Try to get service account email
        let serviceAccountEmail = 'unknown';
        try {
          const serviceAccountPath = this.configService.get<string>(
            'GOOGLE_APPLICATION_CREDENTIALS',
          );
          if (serviceAccountPath) {
            const resolvedPath = serviceAccountPath.startsWith('./')
              ? join(process.cwd(), serviceAccountPath)
              : serviceAccountPath;

            if (existsSync(resolvedPath)) {
              const serviceAccount = require(resolvedPath);
              serviceAccountEmail = serviceAccount.client_email || 'unknown';
            }
          }
        } catch (e) {
          // If we can't get it from file, try from app
          try {
            const app = admin.app();
            const credential = app.options.credential as any;
            if (credential?.serviceAccountEmail) {
              serviceAccountEmail = credential.serviceAccountEmail;
            }
          } catch (e2) {
            // Ignore
          }
        }

        // Extract clean error message (remove raw JSON responses)
        let cleanErrorMessage = error.message || 'Unknown permission error';

        // Try to parse JSON error if present
        try {
          const jsonMatch = cleanErrorMessage.match(
            /Raw server response: "({.*})"/,
          );
          if (jsonMatch) {
            const errorJson = JSON.parse(jsonMatch[1].replace(/\\"/g, '"'));
            if (errorJson?.error?.message) {
              cleanErrorMessage = errorJson.error.message;
            }
          }
        } catch (e) {
          // If parsing fails, use original message but clean it up
          cleanErrorMessage = cleanErrorMessage
            .replace(/Raw server response:.*$/, '')
            .replace(/\/\/console\.developers\.google\.com[^\s]*/g, '')
            .trim();
        }

        // Check if this is specifically a signBlob permission error
        const isSignBlobError =
          cleanErrorMessage.includes('signBlob') ||
          cleanErrorMessage.includes('iam.serviceAccounts.signBlob');

        let errorMessage: string;
        if (isSignBlobError) {
          errorMessage = `Permission denied: The service account "${serviceAccountEmail}" does not have the required IAM permission 'iam.serviceAccounts.signBlob' to create custom tokens.

To fix this issue:
1. Go to Google Cloud Console IAM: https://console.cloud.google.com/iam-admin/iam?project=${projectId}
2. Find your service account: ${serviceAccountEmail}
3. Click "Edit" (pencil icon) and add one of these roles:
   - Service Account Token Creator (roles/iam.serviceAccountTokenCreator) - RECOMMENDED
     This role includes the 'iam.serviceAccounts.signBlob' permission needed for createCustomToken()
   - OR Firebase Admin SDK Administrator Service Agent (roles/firebase.admin)
     This provides full Firebase Admin access including custom token creation
4. Ensure the Identity Toolkit API is enabled: https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=${projectId}
5. Wait 1-2 minutes for permissions to propagate, then retry

For Cloud Run deployments, the service account is specified in cloudbuild.yaml with --service-account flag.
Make sure that service account has the roles/iam.serviceAccountTokenCreator role.

Error details: ${cleanErrorMessage}`;
        } else {
          errorMessage = `Permission denied: The service account "${serviceAccountEmail}" does not have the required permissions to create custom tokens.

To fix this issue:
1. Go to Google Cloud Console IAM: https://console.cloud.google.com/iam-admin/iam?project=${projectId}
2. Find your service account: ${serviceAccountEmail}
3. Click "Edit" and add the "Service Account Token Creator" role (roles/iam.serviceAccountTokenCreator)
   This is the minimum required role. You can also add:
   - Firebase Admin SDK Administrator Service Agent (roles/firebase.admin) for full Firebase Admin access
4. Ensure the Identity Toolkit API is enabled: https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=${projectId}
5. Wait a few minutes for permissions to propagate

Error details: ${cleanErrorMessage}`;
        }

        throw new BadRequestException(errorMessage);
      }

      throw new BadRequestException(
        `Failed to refresh token: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async resetPassword(
    resetPasswordInput: ResetPasswordInput,
    databaseId?: string,
  ): Promise<ResetPasswordResponse> {
    const { email, language } = resetPasswordInput;

    // Validate inputs
    if (!email || email.trim() === '') {
      throw new BadRequestException('Email is required');
    }

    if (!language || !['en', 'ar'].includes(language.toLowerCase())) {
      throw new BadRequestException('Language must be "en" or "ar"');
    }

    try {
      // Verify Firebase Admin is initialized
      if (!admin.apps.length) {
        throw new Error(
          'Firebase Admin SDK is not initialized. Please check your configuration.',
        );
      }

      // Get user by email
      let user;
      try {
        user = await admin.auth().getUserByEmail(email);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // Don't reveal if user exists or not for security
          return {
            success: true,
            message:
              language.toLowerCase() === 'ar'
                ? 'إذا كان هذا البريد الإلكتروني مسجلاً، سيتم إرسال رابط إعادة تعيين كلمة المرور.'
                : 'If this email is registered, a password reset link will be sent.',
          };
        }
        throw error;
      }

      // Generate password reset link using Firebase
      // Redirect to our custom password reset page with language parameter
      const baseUrl =
        this.configService.get<string>('PASSWORD_RESET_REDIRECT_URL') ||
        'http://localhost:8080';
      const redirectUrl = `${baseUrl}/auth/reset-password?lang=${language.toLowerCase()}`;

      // Get Firebase auth domain (usually already allowlisted)
      const projectId =
        this.configService.get<string>('FIREBASE_PROJECT_ID') || '';
      const firebaseAuthDomain = `${projectId}.firebaseapp.com`;

      const actionCodeSettings = {
        url: redirectUrl,
        handleCodeInApp: false,
      };

      let resetLink: string;
      try {
        resetLink = await admin
          .auth()
          .generatePasswordResetLink(email, actionCodeSettings);
      } catch (firebaseError) {
        // Handle domain allowlist error specifically
        if (
          firebaseError.message?.includes('Domain not allowlisted') ||
          firebaseError.message?.includes('domain') ||
          firebaseError.code === 'auth/unauthorized-continue-uri'
        ) {
          const domain = new URL(redirectUrl).hostname;

          // Try fallback: generate link without custom redirect (uses Firebase default)
          console.warn(
            `Domain ${domain} not allowlisted, attempting to generate link without custom redirect URL`,
          );
          try {
            resetLink = await admin.auth().generatePasswordResetLink(email);
            console.log(
              'Successfully generated password reset link without custom redirect URL',
            );
          } catch (fallbackError) {
            // If fallback also fails, provide detailed instructions
            throw new BadRequestException(
              `Domain not allowlisted: The domain "${domain}" is not authorized in your Firebase project.

To fix this issue:
1. In Firebase Console, click "Authentication" in the left sidebar (under Project shortcuts)
2. Click the "Settings" tab at the top
3. Scroll down to "Authorized domains" section
4. Click "Add domain" button
5. Enter: ${domain}
6. Click "Add"
7. Wait 2-3 minutes for changes to propagate

Alternative: If you have a frontend URL, set PASSWORD_RESET_REDIRECT_URL environment variable to that URL instead.

Current redirect URL: ${redirectUrl}
Firebase Console: https://console.firebase.google.com/project/${projectId}/authentication/settings`,
            );
          }
        } else {
          throw firebaseError;
        }
      }

      // Read email template based on language
      const emailTemplatePath = join(
        process.cwd(),
        'src',
        'modules',
        'auth',
        'templates',
        'email',
        language.toLowerCase() === 'ar'
          ? 'emailtemp_ar.html'
          : 'emailTemp_en.html',
      );

      if (!existsSync(emailTemplatePath)) {
        throw new Error(`Email template not found: ${emailTemplatePath}`);
      }

      let emailTemplate = readFileSync(emailTemplatePath, 'utf-8');

      // Read redirection template
      const redirectionTemplatePath = join(
        process.cwd(),
        'src',
        'modules',
        'auth',
        'templates',
        'redirection',
        language.toLowerCase() === 'ar'
          ? 'redirectoin_ar.html'
          : 'redirectoin_en.html',
      );

      if (!existsSync(redirectionTemplatePath)) {
        throw new Error(
          `Redirection template not found: ${redirectionTemplatePath}`,
        );
      }

      const redirectionTemplate = readFileSync(
        redirectionTemplatePath,
        'utf-8',
      );

      // Extract the action code (oobCode) from the Firebase reset link
      // Firebase reset link format: https://...firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=XXX&continueUrl=...
      let oobCode: string | null = null;
      try {
        const resetLinkUrl = new URL(resetLink);
        oobCode = resetLinkUrl.searchParams.get('oobCode');
        console.log(
          'Extracted oobCode from Firebase link:',
          oobCode ? 'Found' : 'Not found',
        );
      } catch (e) {
        console.warn('Failed to parse Firebase reset link URL:', e);
        // Try alternative parsing if URL constructor fails
        const oobCodeMatch = resetLink.match(/[?&]oobCode=([^&]+)/);
        if (oobCodeMatch) {
          oobCode = decodeURIComponent(oobCodeMatch[1]);
        }
      }

      // Build the custom reset link pointing directly to our templates
      // Reuse baseUrl that was declared earlier
      let customResetLink = `${baseUrl}/auth/reset-password?lang=${language.toLowerCase()}`;
      if (databaseId) {
        // Pass the tenant databaseId so the reset page can redirect the user
        // back to their tenant login after a successful reset.
        customResetLink += `&databaseId=${encodeURIComponent(databaseId)}`;
      }
      if (oobCode) {
        customResetLink += `&oobCode=${encodeURIComponent(oobCode)}`;
      } else {
        // If we couldn't extract oobCode, log a warning but still use the custom link
        // The controller will handle the case when oobCode is missing
        console.warn(
          'Could not extract oobCode from Firebase reset link. The link may not work properly.',
        );
      }

      // Replace {{reset_link}} in email template with our custom reset link
      emailTemplate = emailTemplate.replace(
        /\{\{reset_link\}\}/g,
        customResetLink,
      );

      // Optionally create a short link using Dynalinks API (optional feature)
      // If Dynalinks is not configured or fails, the custom reset link will be used directly
      const dynalinksApiKey =
        this.configService.get<string>('DYNALINKS_API_KEY') ||
        'zkTCz7VfEQptWjxzWyYU8W75';
      const dynalinksApiUrl =
        this.configService.get<string>('DYNALINKS_API_URL') ||
        'https://dynalinks.app/api/v1/links';

      let finalResetLink = customResetLink;

      // Try to create a Dynalink that wraps the Firebase reset link (optional)
      if (dynalinksApiKey) {
        try {
          // Generate a unique path for this reset link
          const linkPath = `reset-password/${Date.now()}-${Math.random().toString(36).substring(7)}`;

          const dynalinkResponse = await fetch(dynalinksApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${dynalinksApiKey}`,
            },
            body: JSON.stringify({
              name: 'Password Reset Link',
              path: linkPath,
              url: customResetLink, // Use custom reset link instead of Firebase link
            }),
          });

          if (dynalinkResponse.ok) {
            const dynalinkData = await dynalinkResponse.json();
            // Dynalinks API returns the link in different possible fields
            if (
              dynalinkData?.shortLink ||
              dynalinkData?.link ||
              dynalinkData?.url ||
              dynalinkData?.dynalink
            ) {
              finalResetLink =
                dynalinkData.shortLink ||
                dynalinkData.link ||
                dynalinkData.url ||
                dynalinkData.dynalink;
              console.log('Dynalink created successfully:', finalResetLink);
            } else {
              console.warn(
                'Dynalinks API response format unexpected:',
                dynalinkData,
              );
            }
          } else {
            const errorText = await dynalinkResponse
              .text()
              .catch(() => 'Unknown error');
            console.warn(
              `Dynalinks API error (${dynalinkResponse.status} ${dynalinkResponse.statusText}): ${errorText}. Using Firebase reset link directly.`,
            );
            // Fallback: use Firebase reset link directly
          }
        } catch (e) {
          // If Dynalinks fails, use Firebase link directly (this is expected if Dynalinks is not configured)
          console.warn(
            `Failed to create Dynalink (${e.message}), using Firebase reset link directly. This is normal if Dynalinks is not configured.`,
          );
        }
      } else {
        console.log(
          'Dynalinks API key not configured, using Firebase reset link directly.',
        );
      }

      // Replace {{reset_link}} in email template with final link (Dynalink or Firebase link)
      emailTemplate = emailTemplate.replace(
        /\{\{reset_link\}\}/g,
        finalResetLink,
      );

      // Send email using configured email service (see sendHtmlEmail)
      const emailSubject =
        language.toLowerCase() === 'ar'
          ? 'إعادة تعيين كلمة المرور - Easy Rent'
          : 'Reset Your Password - Easy Rent';

      await this.sendHtmlEmail(email, emailSubject, emailTemplate);

      return {
        success: true,
        message:
          language.toLowerCase() === 'ar'
            ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.'
            : 'Password reset link has been sent to your email.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Reset password error:', error);
      throw new BadRequestException(
        `Failed to send password reset email: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Verify Firebase ID token and extract UID
   * Also handles custom tokens by decoding them (custom tokens should be exchanged for ID tokens on client)
   */
  async verifyTokenAndGetUid(token: string): Promise<string> {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    try {
      // Try to verify as ID token first
      const decodedToken = await admin.auth().verifyIdToken(cleanToken);
      return decodedToken.uid;
    } catch (error) {
      // Check if it's a custom token error
      if (
        error.message?.includes('custom token') ||
        error.message?.includes('ID token')
      ) {
        // Try to decode custom token (custom tokens are JWTs)
        try {
          const decoded = this.decodeCustomToken(cleanToken);
          if (decoded && decoded.uid) {
            // Custom token decoded successfully, but warn that ID token should be used
            console.warn(
              'Custom token detected. Please exchange it for an ID token on the client side using signInWithCustomToken()',
            );
            return decoded.uid;
          }
        } catch (decodeError) {
          // If decoding fails, throw the original error with helpful message
          throw new UnauthorizedException(
            `Invalid token type. You provided a custom token, but an ID token is required. ` +
              `Please exchange your custom token for an ID token on the client side using Firebase's signInWithCustomToken() method, ` +
              `then use the ID token in the Authorization header. ` +
              `Original error: ${error.message}`,
          );
        }
      }

      // For other errors, throw with original message
      throw new UnauthorizedException(
        `Invalid or expired token: ${error.message}`,
      );
    }
  }

  /**
   * Decode custom token (JWT) to extract UID
   * Note: This doesn't verify the signature, but custom tokens are signed by our service account
   */
  private decodeCustomToken(token: string): { uid?: string } | null {
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode the payload (second part)
      const payload = parts[1];
      // Add padding if needed (base64url decoding)
      const paddedPayload =
        payload + '='.repeat((4 - (payload.length % 4)) % 4);
      const decodedPayload = Buffer.from(
        paddedPayload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf-8');

      const parsed = JSON.parse(decodedPayload);
      return { uid: parsed.uid };
    } catch (error) {
      return null;
    }
  }

  async changePassword(
    changePasswordInput: ChangePasswordInput,
    token: string,
  ): Promise<ChangePasswordResponse> {
    const { oldPassword, newPassword, confirmPassword } = changePasswordInput;

    // Validate inputs
    if (!oldPassword || oldPassword.trim() === '') {
      throw new BadRequestException('Old password is required');
    }

    if (!newPassword || newPassword.trim() === '') {
      throw new BadRequestException('New password is required');
    }

    if (!confirmPassword || confirmPassword.trim() === '') {
      throw new BadRequestException('Confirm password is required');
    }

    // Check if new password matches confirm password
    if (newPassword !== confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    // Check if old password and new password are different
    if (oldPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from old password',
      );
    }

    // Validate token
    if (!token) {
      throw new UnauthorizedException('Token is required in header');
    }

    try {
      // Verify Firebase Admin is initialized
      if (!admin.apps.length) {
        throw new Error(
          'Firebase Admin SDK is not initialized. Please check your configuration.',
        );
      }

      // Verify token and get user UID (handles both ID tokens and custom tokens)
      const uid = await this.verifyTokenAndGetUid(token);

      // Get user from Firebase Auth to get email
      let user;
      try {
        user = await admin.auth().getUser(uid);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          throw new BadRequestException('User not found');
        }
        throw error;
      }

      if (!user.email) {
        throw new BadRequestException(
          'User does not have an email address associated',
        );
      }

      // Verify old password using Firebase Auth REST API
      const projectId =
        this.configService.get<string>('FIREBASE_PROJECT_ID') || '';
      // Try to get API key from environment variable first, then fallback to firebase config
      const apiKey =
        this.configService.get<string>('FIREBASE_WEB_API_KEY') ||
        firebaseConfig.apiKey;

      if (!apiKey) {
        throw new BadRequestException(
          'FIREBASE_WEB_API_KEY is not configured. Please set it in your environment variables or ensure firebase.config.ts has the apiKey.',
        );
      }

      // Use Firebase Auth REST API to verify password
      const verifyPasswordUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

      try {
        const verifyResponse = await fetch(verifyPasswordUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            password: oldPassword,
            returnSecureToken: false,
          }),
        });

        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json().catch(() => ({}));
          const errorMessage =
            errorData?.error?.message || 'Failed to verify old password';

          // Check if it's an invalid password error
          if (
            errorMessage.includes('INVALID_PASSWORD') ||
            errorMessage.includes('INVALID_LOGIN_CREDENTIALS') ||
            errorMessage.includes('wrong password')
          ) {
            throw new UnauthorizedException('Old password is incorrect');
          }

          throw new BadRequestException(
            `Failed to verify old password: ${errorMessage}`,
          );
        }
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Failed to verify old password: ${error.message || 'Unknown error'}`,
        );
      }

      // Update password using Firebase Admin SDK
      try {
        await admin.auth().updateUser(uid, {
          password: newPassword,
        });
      } catch (error) {
        throw new BadRequestException(
          `Failed to update password: ${error.message || 'Unknown error'}`,
        );
      }

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      console.error('Change password error:', error);
      throw new BadRequestException(
        `Failed to change password: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
