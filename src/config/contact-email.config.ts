export const contactEmailConfig = {
  smtpHost: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
  smtpPort: process.env.EMAIL_SMTP_PORT || '465',
  secure: process.env.EMAIL_SECURE || 'true',
  user: process.env.EMAIL_USER || '',
  password: process.env.EMAIL_PASSWORD || '',
  from: process.env.EMAIL_FROM || '',
  receiver: process.env.EMAIL_RECEIVER || '',
};
