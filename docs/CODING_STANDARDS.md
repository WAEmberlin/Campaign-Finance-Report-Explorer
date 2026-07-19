# Coding Standards

- Prefer readability over cleverness
- Document every public function with JSDoc
- ES Modules only — no inline JavaScript or CSS in HTML beyond CDN bootstraps
- Use `async/await`; never silently fail — log with `createLogger(scope)`
- No global mutable state except intentional singletons (DB handle, Fuse index)
- UI components contain no business logic
- Services never import from `components/` or manipulate the DOM
- District 70 / House / 2026 are default filters only — never architectural assumptions
