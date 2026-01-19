
import { NextResponse } from 'next/server';
import { sendTelegramMessage, sendWhatsAppMessage } from '@/lib/notifications';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, data } = body;

        if (type === 'new_booking') {
            const { customerName, carName, startDate, endDate, phone, branch, notes, pickupTime, days } = data;
            const message = `
🚗 <b>حجز جديد!</b>

👤 <b>العميل:</b> ${customerName}
📞 <b>الهاتف:</b> ${phone}
🚘 <b>السيارة:</b> ${carName}
� <b>الفرع:</b> ${branch || 'غير محدد'}
🕒 <b>الوقت:</b> ${startDate} الساعة ${pickupTime}
📅 <b>المدة:</b> ${days} يوم (${startDate} إلى ${endDate})
📝 <b>ملاحظات:</b> ${notes || 'لا يوجد'}

<i>يرجى مراجعة لوحة التحكم للتفاصيل.</i>
      `;
            await sendTelegramMessage(message);
            return NextResponse.json({ success: true, message: 'Admin notified via Telegram' });
        }

        if (type === 'booking_approved') {
            const { customerPhone, customerName, carName } = data;
            const message = `مرحباً ${customerName}،\n\nتم تأكيد حجزك لسيارة ${carName} بنجاح! 🚗\nننتظرك في الموعد المحدد.\n\nشكراً لاختيارك خدماتنا.`;
            await sendWhatsAppMessage(customerPhone, message);
            return NextResponse.json({ success: true, message: 'Customer notified via WhatsApp' });
        }

        return NextResponse.json({ success: false, error: 'Invalid notification type' }, { status: 400 });

    } catch (error) {
        console.error('Notification API Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
