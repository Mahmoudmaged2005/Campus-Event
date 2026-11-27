export default function TrustInfo({ trust }) {
  if (!trust) {
    return null;
  }
  if (trust.level === 'NEW') {
    return <p className="trust-line">Organizer trust: <strong>NEW</strong> (no reviewed events yet)</p>;
  }
  return (
    <p className="trust-line">
      Organizer trust: <strong>{trust.score}/100 ({trust.level})</strong>
      {' · '}{trust.approvedCount} approved, {trust.rejectedCount} rejected, {trust.resolvedFlagCount} resolved flags
    </p>
  );
}
