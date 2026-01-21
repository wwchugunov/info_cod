export default function Topbar({ title, subtitle, actions }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle ? <div style={{ color: "#6e6a67" }}>{subtitle}</div> : null}
      </div>
      <div>{actions}</div>
    </div>
  );
}
