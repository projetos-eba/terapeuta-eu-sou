const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];

function isLocalOrigin(url: URL) {
  return (
    url.protocol === "http:" &&
    loopbackHosts.includes(url.hostname) &&
    !url.username &&
    !url.password &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash
  );
}

export function getLocalCheckoutReturnUrlBase(request: Request) {
  const requestUrl = new URL(request.url);
  const localOrigin = new URL(requestUrl.origin);
  if (!isLocalOrigin(localOrigin)) return null;

  // Next dev may normalize request.url to localhost even when the browser
  // authenticated on 127.0.0.1. Cookies do not cross those hostnames.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const browserOrigin = new URL(origin);
      if (
        isLocalOrigin(browserOrigin) &&
        browserOrigin.port === requestUrl.port
      ) {
        return browserOrigin.origin;
      }
    } catch {
      // Invalid/untrusted origins never override the local request origin.
    }
  }
  return requestUrl.origin;
}
