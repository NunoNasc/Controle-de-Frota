export function adminUnavailable(){return process.env.NODE_ENV==='production'||process.env.ALLOW_DEV_ADMIN!=='true';}
export function invalidAdminOrigin(request:Request){return !new Set([new URL(process.env.APP_URL??'http://localhost:3000').origin,'http://127.0.0.1:3000','http://localhost:3000']).has(request.headers.get('origin')??'');}
