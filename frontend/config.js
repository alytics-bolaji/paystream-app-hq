// config.js -- where the frontend finds the API.
//
// In PRODUCTION the page is served by Nginx (port 80/443) which proxies
// /api/ to the Node backend on the same host, so a relative "/api" base
// is correct and same-origin.
//
// In LOCAL DEV you open the page from a static server on some other port
// (e.g. http://localhost:8080). That server does NOT proxy /api, so we talk
// to the backend directly on http://localhost:3000 (the API allows CORS).
//
// You can always override explicitly by setting window.PAYSTREAM_API before
// this file loads (see config.local.js).
window.PAYSTREAM_API = window.PAYSTREAM_API || (function () {
  var l = window.location;
  var host = l.hostname;
  var isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  var onProxyPort = l.port === "" || l.port === "80" || l.port === "443";
  // local machine, served on a dev port -> go straight to the backend
  if (isLocalHost && !onProxyPort) return "http://localhost:3000";
  // otherwise (production behind Nginx) use the /api reverse-proxy path
  return "/api";
})();
