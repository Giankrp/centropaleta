(() => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'top-return';
  button.textContent = '↑ Volver arriba';
  button.setAttribute('aria-label', 'Volver al inicio de la página');
  button.hidden = true;
  button.addEventListener('click', () => {
    window.scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  });
  document.body.append(button);
  const sync = () => { button.hidden = window.scrollY < 650; };
  window.addEventListener('scroll', sync, {passive:true});
  sync();
})();
