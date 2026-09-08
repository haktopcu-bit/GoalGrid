export async function onRequest(context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  return new HTMLRewriter()
    .on('head', { element(el) { el.append('<link rel="stylesheet" href="/goalgrid-v111.css?v=1114">', { html: true }); } })
    .on('body', { element(el) { el.append('<script src="/goalgrid-v111.js?v=1114"></script><script src="/goalgrid-v111-fix.js?v=1114"></script><script src="/goalgrid-v1112-fix.js?v=1114"></script><script src="/goalgrid-v1113-fix.js?v=1114"></script><script src="/goalgrid-v1114-ui.js?v=1114"></script>', { html: true }); } })
    .transform(response);
}
