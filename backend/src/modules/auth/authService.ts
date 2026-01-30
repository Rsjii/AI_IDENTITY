import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Resend } from 'resend';
import { config, isProd } from '../../config/env';
import { logger } from '../../config/logger';

// ✅ FIXED OTP for development
const DEV_OTP = '123456';

// Email service - Using Resend API (HTTP-based, works on Railway)
export class EmailService {
  private resend: Resend;

  constructor() {
    const apiKey = config.mail.smtp.pass; // Use SMTP_PASS as Resend API key

    if (!apiKey) {
      logger.error('❌ [EMAIL] Resend API key not configured');
    } else if (!apiKey.startsWith('re_')) {
      logger.error('❌ [EMAIL] Invalid Resend API key format! API key should start with "re_"');
    } else {
      this.resend = new Resend(apiKey);
      logger.info('✅ [EMAIL] Resend API initialized successfully');
    }
  }

  async sendOTP(email: string, code: string, type: 'signup' | 'login' | 'forgot' | 'delete' | 'set_password' = 'login'): Promise<boolean> {
    try {
      if (!config.mail.smtp.pass) {
        logger.error('❌ [EMAIL] Resend API key not configured');
        return false;
      }

      if (!this.resend) {
        logger.error('❌ [EMAIL] Resend API not initialized');
        return false;
      }

      if (isProd) {

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
                <tr>
                  <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      <tr>
                        <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Selflyx</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 40px 30px;">
                          <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Verification Code</h2>
                          <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                            ${type === 'signup' ? 'Welcome to Selflyx! Use this code to complete your signup:' : type === 'forgot' ? 'Use this code to reset your password:' : type === 'delete' ? 'Use this code to confirm account deletion:' : type === 'set_password' ? 'Use this code to set your password:' : 'Use this code to verify your login:'}
                          </p>
                          <div style="background-color: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                            <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace;">
                              ${code}
                            </div>
                          </div>
                          <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.5;">
                            This code will expire in <strong>${config.otp.expiryMinutes} minutes</strong>.
                          </p>
                          <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.5;">
                            If you didn't request this code, please ignore this email or contact support if you have concerns.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 30px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
                          <p style="margin: 0; color: #999999; font-size: 12px;">
                            © ${new Date().getFullYear()} Selflyx. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
        `;

        try {
          const result = await this.resend.emails.send({
            from: config.mail.from || 'onboarding@resend.dev',
            to: email,
            subject: 'Your Selflyx Verification Code',
            html: htmlContent,
          });

          const { data, error } = result || { data: null, error: null };

          if (error) {
            const err = error as any;
            logger.error('❌ [EMAIL] Resend API error:', {
              statusCode: err?.statusCode,
              name: err?.name,
              message: err?.message || 'Unknown Resend API error',
            });
            return false;
          }

          logger.info(`✅ [EMAIL] OTP email sent successfully`, { emailId: data?.id });
          return true;
        } catch (error: any) {
          logger.error(`❌ [EMAIL] Failed to send OTP email:`, {
            message: error?.message || 'Unknown error',
          });
          return false;
        }
      }
      
      // Development: Don't send email
      return true;
    } catch (error: any) {
      logger.error('❌ [EMAIL] Failed to send OTP email:', error);
      return false;
    }
  }

  async sendContactEmail(name: string, email: string, subject: string, message: string): Promise<boolean> {
    try {
      if (!config.mail.smtp.pass || !this.resend) {
        logger.error('❌ [EMAIL] Resend API not configured. Cannot send contact email.');
        return false;
      }

      const supportEmail = config.mail.supportEmail || config.mail.from || 'onboarding@resend.dev';
      
      const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">New Contact Form Submission</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 40px 30px;">
                        <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">${subject}</h2>
                        <div style="margin-bottom: 30px;">
                          <p style="margin: 0 0 10px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                            <strong>From:</strong> ${name} (${email})
                          </p>
                          <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                            <strong>Subject:</strong> ${subject}
                          </p>
                          <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 0; color: #333333; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
                          </div>
                        </div>
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                          <p style="margin: 0; color: #999999; font-size: 14px; line-height: 1.5;">
                            You can reply directly to this email to respond to ${name}.
                          </p>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 30px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
                        <p style="margin: 0; color: #999999; font-size: 12px;">
                          © ${new Date().getFullYear()} Selflyx. All rights reserved.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
      `;

      try {
        const { data, error } = await this.resend.emails.send({
          from: config.mail.from || 'onboarding@resend.dev',
          to: supportEmail,
          replyTo: email,
          subject: `Contact Form: ${subject}`,
          html: htmlContent,
        });

        if (error) {
          logger.error('❌ [EMAIL] Resend API error (contact form):', {
            statusCode: (error as any)?.statusCode,
            message: error?.message,
          });
          return false;
        }

        logger.info(`✅ [EMAIL] Contact form email sent successfully`, { emailId: data?.id });
        return true;
      } catch (error: any) {
        logger.error(`❌ [EMAIL] Failed to send contact form email:`, {
          message: error?.message || 'Unknown error',
        });
        return false;
      }
    } catch (error: any) {
      logger.error('❌ [EMAIL] Failed to send contact form email:', error);
      return false;
    }
  }

  async sendTrainingReady(email: string): Promise<boolean> {
    try {
      if (!config.mail.smtp.pass || !this.resend) {
        logger.error('❌ [EMAIL] Resend API not configured. Cannot send training ready email.');
        return false;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Your AI clone is ready 🎉</h2>
            <p>Your training is complete. You can now test and share your AI clone.</p>
            <p><a href="${config.frontendUrl || 'https://selflyx.com'}/dashboard" style="color:#2563eb;">Open Dashboard</a></p>
          </div>
        </body>
        </html>
      `;

      const { error } = await this.resend.emails.send({
        from: config.mail.from || 'onboarding@resend.dev',
        to: email,
        subject: 'Your AI clone is ready',
        html: htmlContent,
      });

      if (error) {
        logger.error('❌ [EMAIL] Training ready email failed:', error);
        return false;
      }
      return true;
    } catch (error: any) {
      logger.error('❌ [EMAIL] Training ready email error:', error);
      return false;
    }
  }

  /**
   * Generic email sending method for receipts, notifications, etc.
   */
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      if (!config.mail.smtp.pass || !this.resend) {
        logger.error('❌ [EMAIL] Resend API not configured');
        return false;
      }

      if (isProd) {
        try {
          const result = await this.resend.emails.send({
            from: config.mail.from || 'onboarding@resend.dev',
            to,
            subject,
            html,
          });

          const { data, error } = result || { data: null, error: null };
          if (error) {
            logger.error('❌ [EMAIL] Send failed:', error);
            return false;
          }

          logger.info(`✅ [EMAIL] Email sent: ${subject} to ${to}`, { emailId: data?.id });
          return true;
        } catch (error: any) {
          logger.error('❌ [EMAIL] Send error:', error);
          return false;
        }
      } else {
        // Development: Log but don't send
        logger.info(`📧 [EMAIL] Development mode: Would send email "${subject}" to ${to}`);
        return true;
      }
    } catch (error: any) {
      logger.error('❌ [EMAIL] Send error:', error);
      return false;
    }
  }

  /**
   * ✅ ADD: Email templates for notifications
   */
  async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    const appUrl = (config as any).appUrl || config.frontendUrl || 'https://selflyx.com';
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #8B5CF6;">Welcome to Selflyx, ${userName}!</h1>
        <p>We're excited to have you on board. Your AI clone is ready to be created.</p>
        <a href="${appUrl}/onboarding/quiz"
           style="display: inline-block; background: linear-gradient(135deg, #8B5CF6, #6366F1);
                  color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;
                  margin: 16px 0;">
          Start Building Your AI
        </a>
        <p>If you have any questions, reply to this email or visit our <a href="${appUrl}/help">Help Center</a>.</p>
      </body>
      </html>
    `;
    return this.sendEmail(userEmail, 'Welcome to Selflyx! 🎉', html);
  }

  async sendAIReadyEmail(userEmail: string, userName: string): Promise<boolean> {
    const appUrl = (config as any).appUrl || config.frontendUrl || 'https://selflyx.com';
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #10B981;">Your AI is Ready, ${userName}! ✅</h1>
        <p>Great news! Your AI has finished training and is ready to chat with your audience.</p>
        <a href="${appUrl}/dashboard"
           style="display: inline-block; background: linear-gradient(135deg, #8B5CF6, #6366F1);
                  color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;
                  margin: 16px 0;">
          View Dashboard
        </a>
        <p><strong>Next steps:</strong></p>
        <ul>
          <li>Test your AI in the dashboard</li>
          <li>Get your embed code to add to your website</li>
          <li>Share your public chat link with your audience</li>
        </ul>
      </body>
      </html>
    `;
    return this.sendEmail(userEmail, '✅ Your AI Clone is Ready!', html);
  }

  async sendPaymentReceipt(userEmail: string, userName: string, amount: number, transactionId: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>Payment Received</h1>
        <p>Hi ${userName},</p>
        <p>Thank you for your payment. Here are the details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #E5E7EB;"><strong>Amount:</strong></td>
            <td style="padding: 8px; border: 1px solid #E5E7EB;">$${(amount / 100).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #E5E7EB;"><strong>Transaction ID:</strong></td>
            <td style="padding: 8px; border: 1px solid #E5E7EB;">${transactionId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #E5E7EB;"><strong>Date:</strong></td>
            <td style="padding: 8px; border: 1px solid #E5E7EB;">${new Date().toLocaleString()}</td>
          </tr>
        </table>
      </body>
      </html>
    `;
    return this.sendEmail(userEmail, 'Payment Receipt from Selflyx', html);
  }

  /**
   * Send weekly summary email to creators
   */
  async sendWeeklySummary(
    userEmail: string,
    stats: {
      totalChats: number;
      newChats: number;
      revenue: number;
      earnings: number;
      avgResponseTime: number;
      satisfaction: number;
      topQuestions?: string[];
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Weekly AI Summary</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Your Weekly AI Summary</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 30px;">Here's how your AI clone performed this week:</p>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="margin-top: 0; color: #667eea; font-size: 20px;">📊 Key Metrics</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
              <div>
                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Total Chats</div>
                <div style="font-size: 24px; font-weight: bold; color: #111827; margin-top: 5px;">${stats.totalChats.toLocaleString()}</div>
                <div style="font-size: 12px; color: #10b981; margin-top: 5px;">+${stats.newChats} this week</div>
              </div>
              <div>
                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Your Earnings</div>
                <div style="font-size: 24px; font-weight: bold; color: #111827; margin-top: 5px;">$${(stats.earnings / 100).toFixed(2)}</div>
                <div style="font-size: 12px; color: #10b981; margin-top: 5px;">From ${stats.revenue > 0 ? '$' + (stats.revenue / 100).toFixed(2) : '$0'} revenue</div>
              </div>
            </div>
          </div>

          <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="margin-top: 0; color: #667eea; font-size: 20px;">⚡ Performance</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
              <div>
                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Avg Response Time</div>
                <div style="font-size: 20px; font-weight: bold; color: #111827; margin-top: 5px;">${(stats.avgResponseTime / 1000).toFixed(1)}s</div>
              </div>
              <div>
                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Satisfaction</div>
                <div style="font-size: 20px; font-weight: bold; color: #111827; margin-top: 5px;">${(stats.satisfaction * 100).toFixed(0)}%</div>
              </div>
            </div>
          </div>

          ${stats.topQuestions && stats.topQuestions.length > 0 ? `
          <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="margin-top: 0; color: #667eea; font-size: 20px;">🔥 Top Questions This Week</h2>
            <ul style="margin: 15px 0; padding-left: 20px;">
              ${stats.topQuestions.slice(0, 5).map((q: string) => `<li style="margin-bottom: 8px; color: #374151;">${q}</li>`).join('')}
            </ul>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'https://selflyx.com'}/dashboard" 
               style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              View Full Dashboard →
            </a>
          </div>

          <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
            Keep engaging with your audience! 🚀
          </p>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(userEmail, 'Your Weekly AI Summary - Selflyx', html);
  }
}

// OTP utilities
export const generateOTP = (length: number = 6): string => {
  // ✅ Development: Return fixed OTP "123456"
  if (!isProd) {
    return DEV_OTP;
  }
  
  // ✅ Production: Generate random OTP
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
};

export const hashOTP = async (otp: string): Promise<string> => {
  return bcrypt.hash(otp, 10);
};

export const verifyOTP = async (otp: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(otp, hash);
};

// Password utilities
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Token utilities for public profiles
export const generateProfileToken = (userId: string, handle: string): string => {
  const payload = {
    userId,
    handle,
    exp: Math.floor(Date.now() / 1000) + (48 * 60 * 60), // 48 hours
  };
  
  const token = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex');
  
  return `${token}.${signature}`;
};

export const verifyProfileToken = (token: string): { userId: string; handle: string } | null => {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    
    const expectedSignature = crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('hex');
    if (signature !== expectedSignature) return null;
    
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
    }
    
    return { userId: decoded.userId, handle: decoded.handle };
  } catch (error) {
    return null;
  }
};

// Invite code generation
export const generateInviteCode = (): string => {
  return crypto.randomBytes(8).toString('hex');
};
