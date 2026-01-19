export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // This prevents the admin layout from wrapping the login page
    return <>{children}</>;
}
