export async function onRequest(context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  return new HTMLRewriter()
    .on('head', { element(el) { el.append('<link rel="stylesheet" href="/goalgrid-v111.css?v=1119">', { html: true }); } })
    .on('body', { element(el) { el.append('<script src="/goalgrid-v111.js?v=1119"></script><script src="/goalgrid-v111-fix.js?v=1119"></script><script src="/goalgrid-v1112-fix.js?v=1119"></script><script src="/goalgrid-v1113-fix.js?v=1119"></script><script src="/goalgrid-v1114-ui.js?v=1119"></script><script src="/goalgrid-v1115-fix.js?v=1119"></script><script src="/goalgrid-v1116-fix.js?v=1119"></script><script src="/goalgrid-v1117-fix.js?v=1119"></script><script src="/goalgrid-v1118-fix.js?v=1119"></script><script src="/goalgrid-v1119-fix.js?v=1119"></script>', { html: true }); } })
    .transform(response);
}
