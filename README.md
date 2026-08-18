# MUJAWIB

## التطوير المحلي

```bash
pnpm install
pnpm dev
```

يفتح التطبيق على [http://localhost:3000](http://localhost:3000).

### خطأ `Cannot find module '../chunks/ssr/[turbopack]_runtime.js'`

يحدث عادة بسبب cache تالف في `.next` أو تشغيل أكثر من سيرفر dev.

**الحل:**

```powershell
# Windows — أوقف المنافذ 3000-3003 ثم احذف الـ cache
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Remove-Item -Recurse -Force .next
pnpm dev
```

أو استخدم:

```bash
pnpm dev:clean
```

> السكربت الافتراضي `pnpm dev` يستخدم webpack (بدون turbopack) لاستقرار أفضل على Windows. للتجربة مع turbopack: `pnpm dev:turbo`.
