// config.js -- where the frontend finds the API.
//
// The app is ALWAYS served behind a proxy that forwards /api to the backend,
// so a relative "/api" base is correct everywhere and the frontend and API are
// the same origin (no CORS, and the backend needs no published port):
//
//   * in a container : Nginx in the frontend image proxies /api -> paystream-api:3000
//   * on EC2         : Nginx proxies /api -> 127.0.0.1:3000
//   * local dev      : run `node dev-server.js`, which proxies /api -> localhost:3000
//
// A bare static server such as `python -m http.server` does NOT proxy /api and
// is not supported for this app -- use dev-server.js for local development.
//
// You can still override explicitly by setting window.PAYSTREAM_API before this
// file loads.
window.PAYSTREAM_API = window.PAYSTREAM_API || "/api";
