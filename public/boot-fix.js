(() => {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.includes('/api/locales/')) {
      return Promise.race([
        nativeFetch(input, init),
        new Promise(resolve => setTimeout(() => resolve(new Response(JSON.stringify({ui:{},products:{}}), {status:200, headers:{'Content-Type':'application/json'}})), 1800))
      ]);
    }
    return nativeFetch(input, init);
  };
})();
