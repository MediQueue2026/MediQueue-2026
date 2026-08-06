import dotenv from 'dotenv';
dotenv.config();

/**
 * Flexible Notification Provider Interface
 * Allows switching between 'mock', 'twilio', or custom providers easily.
 */
class MockNotificationProvider {
  async sendSMS(toPhone, message) {
    console.log(`[MOCK SMS SENDER] To: ${toPhone} | Message: ${message}`);
    return { success: true, provider: 'mock', messageId: `mock_${Date.now()}` };
  }
}

class TwilioNotificationProvider {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromPhone = process.env.TWILIO_PHONE_NUMBER;
    this.client = null;
  }

  async sendSMS(toPhone, message) {
    try {
      if (!this.client) {
        const twilio = await import('twilio');
        this.client = twilio.default(this.accountSid, this.authToken);
      }
      const response = await this.client.messages.create({
        body: message,
        from: this.fromPhone,
        to: toPhone
      });
      return { success: true, provider: 'twilio', messageId: response.sid };
    } catch (error) {
      console.error('[TWILIO SMS ERROR]', error.message);
      // Fallback to mock logging so development never crashes
      console.log(`[FALLBACK MOCK SMS] To: ${toPhone} | Message: ${message}`);
      return { success: false, provider: 'twilio_fallback', error: error.message };
    }
  }
}

const providerType = process.env.NOTIFICATION_PROVIDER || 'mock';

export const notificationProvider = providerType === 'twilio' 
  ? new TwilioNotificationProvider()
  : new MockNotificationProvider();
