import { supabase } from "@/lib/supabase";

export async function logAction(action: string, resourceId?: string, details?: string) {
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        const userEmail = user?.email || 'Public User';

        const { error } = await supabase
            .from('audit_logs')
            .insert({
                user_email: userEmail,
                action,
                resource_id: resourceId,
                details
            });

        if (error) {
            console.error("❌ Failed to write audit log (RLS or Network):", error);
            // Suppress alert for user - we don't want to block the flow if logging fails
        } else {
            console.log("✅ Audit log recorded successfully");
        }
    } catch (err) {
        console.error("❌ Error in logAction:", err);
    }
}
