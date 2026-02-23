export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--error)" }}>
          404
        </h1>
        <p className="text-lg" style={{ color: "var(--muted)" }}>
          Page not found
        </p>
      </div>
    </main>
  );
}
