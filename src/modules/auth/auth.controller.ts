import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { firebaseConfig } from '../../config/firebase.config';

@Controller('auth')
export class AuthController {
  constructor(private readonly configService: ConfigService) {}

  @Get('reset-password')
  async getResetPasswordPage(
    @Query('lang') lang: string,
    @Query('oobCode') oobCode: string,
    @Query('mode') mode: string,
    @Query('databaseId') databaseId: string,
    @Res() res: Response,
  ) {
    // Default to English if language not specified
    const language = lang === 'ar' ? 'ar' : 'en';

    // Determine which template to use
    const templateFileName =
      language === 'ar' ? 'redirectoin_ar.html' : 'redirectoin_en.html';

    // Try multiple possible paths (development and production)
    // __dirname in production points to dist/modules/auth/auth.controller.js
    // So we need to go up to find templates
    const possiblePaths = [
      // Path from compiled location (production - if templates are copied to dist)
      join(__dirname, '..', 'templates', 'redirection', templateFileName),
      // Path from source (development and production fallback)
      join(
        process.cwd(),
        'src',
        'modules',
        'auth',
        'templates',
        'redirection',
        templateFileName,
      ),
      // Alternative: from dist root (if templates are copied during build)
      join(
        process.cwd(),
        'dist',
        'modules',
        'auth',
        'templates',
        'redirection',
        templateFileName,
      ),
    ];

    let templatePath: string | null = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        templatePath = path;
        console.log(`Found template at: ${templatePath}`);
        break;
      }
    }

    if (!templatePath) {
      console.error('Template not found. Searched paths:');
      possiblePaths.forEach((path, index) => {
        console.error(`  ${index + 1}. ${path} (exists: ${existsSync(path)})`);
      });
      console.error(`Current working directory: ${process.cwd()}`);
      console.error(`__dirname: ${__dirname}`);
      return res
        .status(404)
        .send(
          `Password reset template not found. Template: ${templateFileName}`,
        );
    }

    let template = readFileSync(templatePath, 'utf-8');

    const clientFirebaseConfig = {
      apiKey:
        this.configService.get<string>('FIREBASE_WEB_API_KEY') ||
        firebaseConfig.apiKey,
      authDomain:
        this.configService.get<string>('FIREBASE_AUTH_DOMAIN') ||
        firebaseConfig.authDomain,
      projectId:
        this.configService.get<string>('FIREBASE_PROJECT_ID') ||
        firebaseConfig.projectId,
    };

    const loginBaseUrl =
      this.configService.get<string>('LOGIN_BASE_URL') || '';

    // Add Firebase SDK script and initialization
    const firebaseScript = `
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
    <script>
      // Initialize Firebase
      firebase.initializeApp(${JSON.stringify(clientFirebaseConfig)});
      const auth = firebase.auth();
      
      // Get action code from URL
      const urlParams = new URLSearchParams(window.location.search);
      const actionCode = urlParams.get('oobCode') || urlParams.get('code');
      const mode = urlParams.get('mode');

      // Tenant database id and language used to build the post-reset login URL
      const databaseId = ${JSON.stringify(databaseId || '')};
      const lang = ${JSON.stringify(language)};
      const loginBaseUrl = ${JSON.stringify(loginBaseUrl)};
      const loginRedirectUrl = databaseId && loginBaseUrl
        ? loginBaseUrl.replace('{databaseId}', databaseId).replace('{lang}', lang)
        : '/';
      
      // Handle password reset
      document.getElementById('submitBtn').addEventListener('click', async function() {
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm_password').value;
        
        if (password !== confirmPassword) {
          alert(${language === 'ar' ? "'كلمات المرور غير متطابقة'" : "'Passwords do not match'"});
          return;
        }
        
        if (!actionCode) {
          alert(${language === 'ar' ? "'رمز إعادة التعيين غير صالح'" : "'Invalid reset code'"});
          return;
        }
        
        try {
          // Confirm password reset
          await auth.confirmPasswordReset(actionCode, password);
          alert(${language === 'ar' ? "'تم إعادة تعيين كلمة المرور بنجاح!'" : "'Password reset successfully!'"});
          // Redirect to the tenant login page after a successful reset
          window.location.href = loginRedirectUrl;
        } catch (error) {
          console.error('Password reset error:', error);
          alert(${language === 'ar' ? "'حدث خطأ أثناء إعادة تعيين كلمة المرور: ' + error.message" : "'Error resetting password: ' + error.message"});
        }
      });
      
      // If action code is in the URL, we're ready to reset
      if (actionCode) {
        console.log('Action code found, ready to reset password');
      }
    </script>
    `;

    // Inject the Firebase script before closing body tag
    template = template.replace('</body>', firebaseScript + '</body>');

    res.setHeader('Content-Type', 'text/html');
    res.send(template);
  }
}
