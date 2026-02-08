import { Request, Response } from 'express';
import { z } from 'zod';
import { EmailService } from '../auth/authService';
import { EventLogger } from '../../services/eventLogger';
import { EVENT_TYPES } from '../../config/constants';
import { logger } from '../../config/logger';

const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200, 'Subject too long'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000, 'Message too long'),
});

export async function submitContactForm(req: Request, res: Response) {
  try {
    const { name, email, subject, message } = contactFormSchema.parse(req.body);

    // Send email to support
    const emailService = new EmailService();
    const emailSent = await emailService.sendContactEmail(name, email, subject, message);

    if (!emailSent) {
      logger.error('Failed to send contact form email', { email, subject });
      return res.status(500).json({
        success: false,
        error: 'Failed to send message. Please try again later.',
      });
    }

    // ✅ Log CONTACT_FORM_SUBMITTED event
    await EventLogger.logSystemEvent(EVENT_TYPES.CONTACT_FORM_SUBMITTED, {
      email: email.toLowerCase(),
      subject,
      messageLength: message.length,
    }).catch((err) => {
      logger.warn('Failed to log CONTACT_FORM_SUBMITTED event:', err);
    });

    return res.json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
    });
  } catch (error) {
    logger.error('Contact form submission error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}




















