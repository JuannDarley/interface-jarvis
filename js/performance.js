/* Limita o trabalho gráfico no celular e pausa regiões fora da tela. */
(() => {
  const mobile = /Android|iPhone|JARVISAndroid/i.test(navigator.userAgent);
  document.documentElement.classList.toggle('mobile-lite', mobile);
  document.documentElement.classList.toggle('android-lite', /Android|JARVISAndroid/i.test(navigator.userAgent));

  function observeVisibility(element, callback) {
    let visible = false;
    let disposed = false;
    const notify = () => {
      if (!disposed) callback(visible && !document.hidden
        && !document.documentElement.classList.contains('face-active'));
    };
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      notify();
    }, { rootMargin: '100px' });
    observer.observe(element);
    document.addEventListener('visibilitychange', notify);
    window.addEventListener('jarvis:face-mode', notify);
    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener('visibilitychange', notify);
      window.removeEventListener('jarvis:face-mode', notify);
    };
  }

  window.JarvisPerformance = { mobile, observeVisibility };
  if (mobile) window.addEventListener('DOMContentLoaded', () => {
    for (const selector of ['.jarvis-identity', '.reactor-section', '.brain-section']) {
      const element = document.querySelector(selector);
      if (element) observeVisibility(element, active => element.classList.toggle('offscreen', !active));
    }
  });
})();
