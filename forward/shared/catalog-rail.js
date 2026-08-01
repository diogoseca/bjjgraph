export function initCatalogRail({ rail, toggle, close, backdrop, nav }) {
  if (!rail || !toggle || !close || !backdrop || !nav) return;

  const media = window.matchMedia("(max-width: 1060px)");
  let open = false;

  const sync = ({ returnFocus = false } = {}) => {
    const drawer = media.matches;
    const expanded = drawer && open;
    rail.dataset.open = String(expanded);
    backdrop.dataset.open = String(expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    document.body.classList.toggle("catalog-rail-is-open", expanded);

    if (drawer) {
      rail.inert = !expanded;
      rail.setAttribute("aria-hidden", String(!expanded));
    } else {
      rail.inert = false;
      rail.removeAttribute("aria-hidden");
    }

    if (expanded) close.focus();
    else if (returnFocus && drawer) toggle.focus();
  };

  const setOpen = (next, options) => {
    open = Boolean(next);
    sync(options);
  };

  toggle.addEventListener("click", () => setOpen(!open));
  close.addEventListener("click", () => setOpen(false, { returnFocus: true }));
  backdrop.addEventListener("click", () =>
    setOpen(false, { returnFocus: true }),
  );
  nav.addEventListener("click", (event) => {
    if (media.matches && event.target.closest(".catalog-item")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open && media.matches) {
      event.preventDefault();
      setOpen(false, { returnFocus: true });
    }
  });
  media.addEventListener("change", () => {
    open = false;
    sync();
  });

  sync();
}
