import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Helper function to get public URL for uploaded images
export function getImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    const { data } = supabase.storage
        .from('car-images')
        .getPublicUrl(path);

    return data.publicUrl;
}

// Helper function to upload image
export async function uploadImage(file: File, folder: string = 'cars'): Promise<string | null> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${folder}/${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('car-images')
            .upload(fileName, file);

        if (error) throw error;

        return data.path;
    } catch (error) {
        console.error('Error uploading image:', error);
        return null;
    }
}

// Helper function to delete image
export async function deleteImage(path: string): Promise<boolean> {
    try {
        const { error } = await supabase.storage
            .from('car-images')
            .remove([path]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting image:', error);
        return false;
    }
}
