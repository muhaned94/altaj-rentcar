
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// WhatsApp Credentials (placeholder for now)
// const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
// const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

export async function sendTelegramMessage(text: string): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn("Telegram credentials not set. Message not sent.");
        return false;
    }

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: text,
                parse_mode: 'HTML',
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Telegram API Error:", errorData);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Failed to send Telegram message:", error);
        return false;
    }
}

export async function sendWhatsAppMessage(phone: string, text: string): Promise<boolean> {
    // Placeholder for WhatsApp implementation
    console.log(`[WhatsApp Mock] Sending to ${phone}: ${text}`);
    return true;
}
