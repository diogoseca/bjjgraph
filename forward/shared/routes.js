export const devRoutes = [
  { id: "components", label: "Components", href: "/dev/components/" },
  { id: "screens", label: "Screens", href: "/dev/screens/" },
  { id: "use-cases", label: "Use cases", href: "/dev/use-cases/" },
  { id: "journeys", label: "Journeys", href: "/dev/user-journeys/" },
  { id: "sounds", label: "Sounds", href: "/dev/sounds/" },
];

export function renderDevRoutes(activeId) {
  return devRoutes
    .map(
      (route) =>
        `<a href="${route.href}"${route.id === activeId ? ' aria-current="page"' : ""}>${route.label}</a>`,
    )
    .join("");
}
