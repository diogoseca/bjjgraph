const canonical = document
  .querySelector('link[rel="canonical"]')
  ?.getAttribute("href");

if (canonical) {
  const target = new URL(canonical, location.origin);
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target);
}
