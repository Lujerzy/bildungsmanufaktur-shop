// Cloudflare Pages: alle /api/*-Anfragen an den Worker „bm-downloads“ weiterreichen (Service-Binding „API“).
export const onRequest = ({ request, env }) => env.API.fetch(request);
