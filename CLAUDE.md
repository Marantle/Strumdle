# Strumdle — Claude Code Guidelines

## Running checks

Always run these before considering a task done:

```bash
eval "$(fnm env --shell bash)" && npm run build --prefix d:/repo/chartle
eval "$(fnm env --shell bash)" && npm run lint --prefix d:/repo/chartle
```

## UI Standards (enforced)

### Animation
- NEVER use `transition-all` or `transition: all` — always name specific properties (`transition-[opacity,transform]`, `transition-colors`, etc.)
- ALL animated elements must have a `motion-reduce:animate-none` or `motion-reduce:transition-none` Tailwind variant
- CSS `@keyframes` blocks must have a paired `@media (prefers-reduced-motion: reduce)` that disables or stills them

### Accessibility
- Every icon-only button (no visible text) MUST have `aria-label`
- Every modal/dialog overlay MUST have `role="presentation"` on the backdrop and `role="dialog" aria-modal="true" aria-labelledby="<heading-id>"` on the panel
- Modal backdrops must close on click via `e.target === e.currentTarget` check (not stopPropagation on the dialog), plus `onKeyDown` for Escape
- Combobox/autocomplete inputs MUST have full ARIA: `role="combobox"`, `aria-autocomplete`, `aria-expanded`, `aria-controls`, `aria-activedescendant`
- Listbox option items MUST have `role="option"`, `aria-selected`, and an `onKeyDown` handler alongside `onClick`
- Async state updates visible to the user (guesses, results) MUST be announced via an `aria-live="polite"` region
- `<label>` elements MUST be associated with a control via `htmlFor` + matching `id`; use `<p>` for visual section headers that aren't form labels

### Dark mode
- The `.dark` CSS block MUST include `color-scheme: dark`

### Typography
- All `<h1>` and `<h2>` elements MUST have `text-wrap: balance` (already in `@layer base` in `index.css`)

## React / JSX

- NEVER define a component function inside another component function — always at module level
- NEVER read `localStorage` inside a `.map()` or render loop — pre-compute with `useMemo`
- NEVER use inline IIFEs `(() => { ... })()` inside JSX — extract to named variables or functions
- Ternary chains 2+ levels deep inside JSX MUST be extracted to a named variable or helper function before the `return`
- Expensive derivations (filter, map, sort, reduce on non-trivial data) inside render MUST use `useMemo`
- `&&` conditionals in JSX where the left side is a non-boolean (string, number) MUST be written as `value ? <el/> : null`
- Static inline `style={{ }}` objects MUST be replaced with Tailwind utility classes where possible
- Static JSX created from constant data (e.g. `ITEMS.map(...)`) MUST be hoisted to module-level constants so elements are created once, not on every render
- ALL hooks must be called before any early returns

## Composition (React 19 + Vercel patterns)

- Use `use(Context)` instead of `useContext(Context)` — this is React 19
- NEVER add boolean props that switch between fundamentally different rendered structures — use conditional rendering at the call site or explicit variant components instead
- Dead/always-constant props MUST be removed — if a prop is always the same value at every call site, inline the default and delete the prop
- Do NOT add `open: boolean` props to modal components that simply return null when false — the parent should do conditional rendering instead
