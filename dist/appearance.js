/* Start every page in dark mode before paint; light mode is an explicit page choice. */
(() => {
  const root = document.documentElement;
  const apply = value => {
    const light = value === 'light';
    root.dataset.theme = light ? 'light' : 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#e9e7e2' : '#050505');
    document.querySelectorAll('.theme-toggle').forEach(button => {
      button.setAttribute('aria-pressed', String(light));
    });
  };
  apply('dark');
  document.addEventListener('DOMContentLoaded', () => {
    apply(root.dataset.theme);
    document.querySelectorAll('.theme-toggle').forEach(button => {
      button.addEventListener('click', () => {
        const value = root.dataset.theme === 'light' ? 'dark' : 'light';
        apply(value);
      });
    });
  });
})();
