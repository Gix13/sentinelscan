export default function Button({ children, onClick, type = "button", variant = "primary", disabled }) {
    const cls =
      variant === "primary"
        ? "btn btnPrimary"
        : variant === "ghost"
        ? "btn btnGhost"
        : "btn";

    return (
      <button className={cls} type={type} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    );
  }
