export const dynamic = "force-static";

export default function Offline() {
  return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center">
      <div className="text-5xl mb-4">&#9875;</div>
      <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>
        You&apos;re offline
      </h1>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        No connection right now. Pages, briefings, forecasts and charts you&apos;ve already
        opened are cached and still available — head back and pick a leg you viewed earlier.
        Live forecast refresh resumes automatically when you regain signal.
      </p>
    </div>
  );
}
