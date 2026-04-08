export const Widget = ({ ok, label }: { ok: boolean; label: string }) => (
  <>{ok && <strong>{label}</strong>}</>
);

export const Banner = ({ ok, label }: { ok: boolean; label: string }) => (
  <>{ok && (label ? <strong>{label}</strong> : <em>none</em>)}</>
);
