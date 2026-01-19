import { supabase } from "@/lib/supabase";

export async function logAction(action: string, resourceId?: string, details?: string) {
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.warn("Attempted to log action without authenticated user");
            return;
        }

        const { error } = await supabase
            .from('audit_logs')
            .insert({
                user_email: user.email,
                action,
                resource_id: resourceId,
                details
            });

        if (error) {
            console.error("❌ Failed to write audit log:", error);
            alert(`Audit Log Error: ${error.message}`); // Temporary alert to show user the error
        } else {
            console.log("✅ Audit log recorded successfully");
        }
    } catch (err) {
        console.error("❌ Error in logAction:", err);
    }
}
