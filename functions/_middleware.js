export async function onRequest(context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  return new HTMLRewriter()
    .on('head', { element(el) { el.append('<link rel="stylesheet" href="/goalgrid-v111.css?v=1110">', { html: true }); } })
    .on('body', { element(el) { el.append('<script src="/goalgrid-v111.js?v=1110"></script>', { html: true }); } })
    .transform(response);
}
