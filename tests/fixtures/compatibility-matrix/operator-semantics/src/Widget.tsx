interface Props {
  ok: boolean;
  label: string;
}

export const Widget = ({ ok, label }: Props) => (
  <>{ok && <strong>{label}</strong>}</>
);

export const Banner = ({ ok, label }: Props) => (
  <>{ok && (label ? <strong>{label}</strong> : <em>none</em>)}</>
);
