'use server';

export async function logBookingToN8n(bookingData: any) {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn('N8N_WEBHOOK_URL is not defined in environment variables. N8n logging skipped.');
        return;
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookingData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send booking to N8n: ${response.status} ${response.statusText}`, errorText);
        } else {
            console.log('Successfully sent booking to N8n');
        }

    } catch (error) {
        console.error('Error logging booking to N8n:', error);
    }
}
