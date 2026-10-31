import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl sm:pt-8">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        This page doesn&apos;t exist, or it belongs to another account.
      </p>
      <Link href="/" className="mt-6 inline-block underline underline-offset-2">
        Back to home
      </Link>
    </div>
  );
}
