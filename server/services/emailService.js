const nodemailer = require('nodemailer');

// Email configuration from environment variables
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || ''
  }
};

// Create transporter
let transporter = null;

// Initialize email transporter
function initEmailService() {
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.warn('⚠️  Email service not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env file.');
    return false;
  }

  try {
    transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth
    });

    console.log('✅ Email service initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize email service:', error);
    return false;
  }
}

// Verify email connection
async function verifyEmailConnection() {
  if (!transporter) {
    return false;
  }

  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email verification failed:', error);
    return false;
  }
}

// Send email function
async function sendEmail({ to, subject, html, text }) {
  if (!transporter) {
    console.warn('Email service not initialized. Email not sent to:', to);
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const mailOptions = {
      from: `"NearNect" <${emailConfig.auth.user}>`,
      to: to,
      subject: subject,
      html: html || text,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send failed:', error);
    return { success: false, error: error.message };
  }
}

// Email templates
const emailTemplates = {
  // Welcome email
  welcome: (userName) => ({
    subject: 'Welcome to NearNect! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6c5ce7, #E91E63); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #6c5ce7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to NearNect!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Thank you for joining NearNect. We're excited to have you on board!</p>
            <p>You can now:</p>
            <ul>
              <li>Search for local service providers</li>
              <li>Book services easily</li>
              <li>Chat with service providers</li>
              <li>Leave reviews and ratings</li>
            </ul>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="button">Get Started</a>
            <p>If you have any questions, feel free to contact our support team.</p>
            <p>Best regards,<br>The NearNect Team</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Booking confirmation
  bookingConfirmation: (booking) => ({
    subject: `Booking Confirmed - ${booking.service}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #00b894, #6c5ce7); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .booking-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Booking Confirmed!</h1>
          </div>
          <div class="content">
            <h2>Your booking has been confirmed</h2>
            <div class="booking-details">
              <div class="detail-row">
                <strong>Service:</strong>
                <span>${booking.service}</span>
              </div>
              <div class="detail-row">
                <strong>Date & Time:</strong>
                <span>${new Date(booking.scheduledFor).toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <strong>Address:</strong>
                <span>${booking.address}</span>
              </div>
              <div class="detail-row">
                <strong>Amount:</strong>
                <span>₹${booking.amount}</span>
              </div>
            </div>
            <p>Your service provider will contact you soon. You can track your booking in your dashboard.</p>
            <p>Best regards,<br>The NearNect Team</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Payment confirmation
  paymentConfirmation: (payment) => ({
    subject: 'Payment Successful - NearNect',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #00b894, #6c5ce7); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .payment-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💳 Payment Successful!</h1>
          </div>
          <div class="content">
            <h2>Your payment has been processed</h2>
            <div class="payment-details">
              <p><strong>Amount:</strong> ₹${payment.amount}</p>
              <p><strong>Transaction ID:</strong> ${payment.gatewayTransactionId || 'N/A'}</p>
              <p><strong>Date:</strong> ${new Date(payment.paidAt).toLocaleString()}</p>
            </div>
            <p>Thank you for your payment. Your booking is now confirmed!</p>
            <p>Best regards,<br>The NearNect Team</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // New message notification
  newMessage: (senderName, messagePreview) => ({
    subject: `New message from ${senderName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6c5ce7, #E91E63); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #6c5ce7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 New Message</h1>
          </div>
          <div class="content">
            <h2>You have a new message from ${senderName}</h2>
            <p style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #6c5ce7;">
              "${messagePreview}"
            </p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/chat.html" class="button">View Message</a>
            <p>Best regards,<br>The NearNect Team</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Password reset
  passwordReset: (resetLink) => ({
    subject: 'Reset Your Password - NearNect',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6c5ce7, #E91E63); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #6c5ce7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { color: #e17055; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>You requested to reset your password. Click the button below to create a new password:</p>
            <a href="${resetLink}" class="button">Reset Password</a>
            <p class="warning">⚠️ This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
            <p>Best regards,<br>The NearNect Team</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// Helper functions to send specific emails
async function sendWelcomeEmail(userEmail, userName) {
  const template = emailTemplates.welcome(userName);
  return await sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html
  });
}

async function sendBookingConfirmationEmail(userEmail, booking) {
  const template = emailTemplates.bookingConfirmation(booking);
  return await sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html
  });
}

async function sendPaymentConfirmationEmail(userEmail, payment) {
  const template = emailTemplates.paymentConfirmation(payment);
  return await sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html
  });
}

async function sendNewMessageEmail(userEmail, senderName, messagePreview) {
  const template = emailTemplates.newMessage(senderName, messagePreview);
  return await sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html
  });
}

async function sendPasswordResetEmail(userEmail, resetLink) {
  const template = emailTemplates.passwordReset(resetLink);
  return await sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html
  });
}

module.exports = {
  initEmailService,
  verifyEmailConnection,
  sendEmail,
  sendWelcomeEmail,
  sendBookingConfirmationEmail,
  sendPaymentConfirmationEmail,
  sendNewMessageEmail,
  sendPasswordResetEmail,
  emailTemplates
};

