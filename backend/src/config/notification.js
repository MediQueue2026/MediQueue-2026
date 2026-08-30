import dotenv from 'dotenv';
dotenv.config();

/**
 * Sanitizes and formats Sri Lankan mobile numbers into international format (947XXXXXXXX)
 * Examples: '0771234567' -> '94771234567', '+94771234567' -> '94771234567', '94771234567' -> '94771234567'
 */
export function formatSriLankanPhone(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '94' + cleaned.slice(1);
  } else if (cleaned.length === 9 && !cleaned.startsWith('94')) {
    cleaned = '94' + cleaned;
  }
  return cleaned;
}

/**
 * Dedicated Text.lk Sri Lanka SMS Gateway Provider
 * REST API Docs: https://text.lk (or app.text.lk v3 SMS API)
 */
class TextLkNotificationProvider {
  constructor() {
    this.apiKey = process.env.TEXTLK_API_KEY;
    this.senderId = process.env.TEXTLK_SENDER_ID || 'MediQueue';
    this.apiEndpoint = process.env.TEXTLK_API_ENDPOINT || 'https://app.text.lk/api/v3/sms/send';
  }

  async sendSMS(toPhone, message) {
    const formattedPhone = formatSriLankanPhone(toPhone);
    if (!formattedPhone) {
      console.warn('[TEXT.LK SMS NOTICE] Invalid or missing phone number:', toPhone);
      return { success: false, provider: 'textlk', error: 'Invalid phone number' };
    }

    if (!this.apiKey || this.apiKey.includes('your_textlk_api_token') || this.apiKey.trim() === '') {
      console.log(`[TEXT.LK SMS SIMULATION (No API Key Set)] To: ${formattedPhone} | Sender: ${this.senderId} | Message: "${message}"`);
      return { success: true, provider: 'textlk_simulated', messageId: `sim_${Date.now()}` };
    }

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          recipient: formattedPhone,
          sender_id: this.senderId,
          type: 'plain',
          message
        })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && (data.status === 'success' || data.code === 200 || data.data)) {
        console.log(`[TEXT.LK SMS SUCCESS] Sent to: ${formattedPhone} | MessageId: ${data.data?.uid || data.message_id || 'sent'}`);
        return { success: true, provider: 'textlk', messageId: data.data?.uid || data.message_id || `textlk_${Date.now()}` };
      } else {
        console.error('[TEXT.LK SMS ERROR]', data.message || data.error || response.statusText);
        console.log(`[FALLBACK LOG SMS] To: ${formattedPhone} | Message: "${message}"`);
        return { success: false, provider: 'textlk_fallback', error: data.message || 'SMS Gateway returned error' };
      }
    } catch (error) {
      console.error('[TEXT.LK SMS REQUEST FAILED]', error.message);
      console.log(`[FALLBACK LOG SMS] To: ${formattedPhone} | Message: "${message}"`);
      return { success: false, provider: 'textlk_fallback', error: error.message };
    }
  }
}

// Dedicated single provider instance for MediQueue Text.lk SMS Service
export const notificationProvider = new TextLkNotificationProvider();
