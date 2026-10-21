# Lemma Roadmap

A prioritized roadmap for evolving Lemma into a robust, private, and personal Wikipedia reader.

## Guiding principles

- Keep reading calm, fast, and distraction-free.
- Preserve privacy by default and avoid requiring accounts or a backend.
- Prefer local persistence for history, bookmarks, preferences, and offline content.
- Make Wikipedia navigation feel native to Lemma.
- Improve reliability and accessibility before adding unnecessary complexity.

---

## Milestone 1: Reliability and safety

### Harden Wikipedia API requests

- [x] Check `Response.ok` before parsing API responses.
- [x] Add typed response interfaces for each Wikipedia endpoint.
- [x] Return descriptive errors for failed requests and malformed responses.
- [x] Handle missing and deleted pages.
- [x] Handle redirects consistently and update the displayed/canonical title.
- [x] Add request cancellation with `AbortController`.
- [x] Cancel an article request when navigating to another article.
- [x] Cancel or supersede stale search requests.
- [x] Add reasonable request timeouts.

**Acceptance criteria**

- Failed requests never leave the reader in an indefinite loading state.
- Navigating quickly between articles cannot display an older response.
- Missing articles show an actionable error rather than an empty page.
- Search and article errors can be retried without reloading the app.

### Add article error states

- [x] Add a dedicated article error state.
- [x] Include a retry action.
- [x] Include a link back to search.
- [x] Distinguish between not found, offline, timeout, and generic failures where possible.
- [x] Preserve the requested title in the error UI.

### Make rendered article HTML safer

- [x] Define the HTML elements and attributes Lemma permits.
- [x] Sanitize Wikipedia-provided paragraph and list HTML before rendering with `{@html}`.
- [x] Remove scripts, event-handler attributes, embedded content, and unsafe URLs.
- [x] Normalize `http:` resources to `https:` where appropriate.
- [x] Add safe `rel` values to external links.
- [x] Document the trust boundary around Wikipedia HTML.

---

## Milestone 2: Native article navigation

### Rewrite Wikipedia links

- [x] Detect internal Wikipedia article links during parsing.
- [x] Rewrite internal article links to `/wiki/[title]` Lemma routes.
- [x] Preserve and encode section hashes.
- [x] Keep same-page section links inside the current article.
- [x] Support browser back and forward navigation.
- [x] Handle redirects after following an internal link.
- [x] Treat external links separately from Wikipedia links.
- [x] Open external links safely and visually identify them.
- [x] Define behavior for red links and nonexistent pages.
- [x] Define behavior for special namespaces such as `Category:`, `File:`, and `Help:`.

**Acceptance criteria**

- Readers can explore ordinary Wikipedia links without leaving Lemma.
- Same-page links scroll to the correct section.
- External destinations are clearly distinguishable.
- Back and forward navigation restore the expected article and location.

### Improve citations and references

- [x] Ensure citation links jump to the correct reference.
- [ ] Add a return link from a reference to its citation when available.
- [x] Style citations without disrupting line height.
- [ ] Handle repeated citations pointing to one reference.
- [ ] Verify reference lists are parsed and displayed consistently.

### Add a random article action

- [ ] Add a “Random article” action to the navigation or search interface.
- [ ] Load a random article from the active Wikipedia language.
- [ ] Show a useful error if the random endpoint fails.
- [ ] Make the action accessible from the keyboard or command palette.

---

## Milestone 3: Personal library

### Create local persistence infrastructure

- [ ] Add a typed storage abstraction.
- [ ] Version the stored data schema for future migrations.
- [ ] Handle unavailable or full browser storage gracefully.
- [ ] Keep all personal reading data on the device by default.
- [ ] Add a setting to clear all locally stored data.

Suggested entry shape:

```ts
type LibraryEntry = {
  title: string;
  visitedAt: number;
  savedAt?: number;
  scrollTarget?: string;
  progress?: number;
  thumbnail?: string;
};
```

### Add reading history

- [ ] Automatically record successfully opened articles.
- [ ] Update the most recent visit time without creating duplicates.
- [ ] Display recently viewed articles on the landing page.
- [ ] Add a full recent-history view to the library.
- [ ] Allow individual history entries to be removed.
- [ ] Add a “Clear history” action with confirmation.
- [ ] Avoid recording failed or missing pages.

### Add bookmarks

- [ ] Add a bookmark action beside article metadata or the source link.
- [ ] Clearly show whether the current article is saved.
- [ ] Persist bookmarks locally.
- [ ] Allow bookmarks to be removed from the article and library views.
- [ ] Display saved articles on a `/library` page.
- [ ] Support searching saved articles.
- [ ] Support sorting by title, recently saved, and recently visited.

### Add reading progress and restoration

- [ ] Track article scroll progress.
- [ ] Store the last-read section or scroll position.
- [ ] Restore progress when reopening an article.
- [ ] Ask or unobtrusively offer to resume when appropriate.
- [ ] Add a slim reading-progress indicator.
- [ ] Mark articles as completed near the end of the page.
- [ ] Avoid excessive writes by throttling progress persistence.

### Build the library page

- [ ] Add a `/library` route.
- [ ] Include “Continue reading,” “Saved,” and “Recent” sections.
- [ ] Add empty states that direct users back to search.
- [ ] Add filtering and sorting controls.
- [ ] Make all library actions keyboard accessible.
- [ ] Keep the layout usable on mobile.

**Acceptance criteria**

- A reader can save an article and find it again after reopening the browser.
- A recently read article appears automatically in history.
- Reopening an unfinished article can return to the previous location.
- All personal data can be deleted from within Lemma.

---

## Milestone 4: Reader preferences

### Add appearance settings

- [ ] Support light, dark, and system themes.
- [ ] Add a small set of font-size options.
- [ ] Add narrow, normal, and wide article widths.
- [ ] Optionally support serif and sans-serif body text.
- [ ] Persist preferences locally.
- [ ] Apply stored preferences before first paint to avoid flashing.

### Improve motion preferences

- [x] Respect `prefers-reduced-motion` globally.
- [x] Disable or simplify landing-page text animations when reduced motion is enabled.
- [ ] Avoid animated scrolling when reduced motion is enabled.
- [x] Ensure content remains visible if animations fail or are disabled.

### Add a focused preferences interface

- [ ] Add a compact preferences panel or page.
- [ ] Include a reset-to-defaults action.
- [ ] Keep the number of controls intentionally limited.
- [ ] Ensure all controls have accessible labels and focus states.

---

## Milestone 5: Language support

### Make Wikipedia language configurable

- [ ] Move the Wikipedia host/language out of hardcoded endpoint schemas.
- [ ] Add a typed list of supported Wikipedia editions.
- [ ] Add a language selector.
- [ ] Persist the selected language locally.
- [ ] Search the selected Wikipedia edition.
- [ ] Generate the correct source URL for the selected edition.
- [ ] Include the language in Lemma URLs or otherwise make shared links unambiguous.
- [ ] Use locale-aware labels and metadata where practical.

### Support interlanguage navigation

- [ ] Fetch available language equivalents for the current article.
- [ ] Allow opening the equivalent article in another language.
- [ ] Gracefully handle articles without an equivalent translation.
- [ ] Preserve the selected language across search and navigation.

**Acceptance criteria**

- Changing language updates both search and article fetching.
- Shared Lemma links resolve to the intended Wikipedia edition.
- Source links point to the correct language-specific Wikipedia page.

---

## Milestone 6: Search and discovery

### Add local search history

- [ ] Save recent search queries locally.
- [ ] Show recent queries when the search box is empty and focused.
- [ ] Allow individual queries to be removed.
- [ ] Add a clear-search-history action.
- [ ] Avoid storing searches if private history is disabled.

### Refine search interaction

- [x] Add an explicit no-results state.
- [ ] Highlight matching text in suggestions where appropriate.
- [x] Improve active-result ARIA semantics with `aria-activedescendant`.
- [x] Ensure mouse hover and keyboard selection stay synchronized.
- [x] Cancel the active search when the query changes.
- [ ] Consider showing the active Wikipedia language in search.

### Add a command palette

- [ ] Open the palette with a documented keyboard shortcut.
- [ ] Search articles from the palette.
- [ ] Open recent and bookmarked articles.
- [ ] Trigger “Random article.”
- [ ] Open preferences and the library.
- [ ] Ensure it works fully with a keyboard and screen reader.

---

## Milestone 7: Sharing, metadata, and output

### Improve sharing

- [ ] Add a copy-article-link action.
- [ ] Retain the existing copy-section-link behavior.
- [ ] Use the Web Share API on supported mobile devices.
- [ ] Provide a clipboard fallback.
- [ ] Show accessible success and failure feedback.

### Add article-specific metadata

- [x] Set a dynamic page title for each article.
- [ ] Add an article-specific description where available.
- [ ] Set a canonical source URL.
- [ ] Add Open Graph metadata for articles.
- [ ] Use the article lead image when suitable.
- [ ] Add Twitter/X card metadata if desired.
- [x] Ensure error and missing-page routes are not indexed improperly.

### Add print and PDF-friendly styles

- [ ] Create a print stylesheet.
- [ ] Hide navigation, controls, and loading UI when printing.
- [ ] Preserve heading hierarchy and readable typography.
- [ ] Avoid splitting images and headings awkwardly across pages.
- [ ] Display source and canonical URL in printed output.

---

## Milestone 8: Offline and installable app

### Add PWA support

- [ ] Add a web app manifest.
- [ ] Add installable app icons.
- [ ] Add a service worker.
- [ ] Cache the application shell.
- [ ] Provide an offline fallback page.
- [ ] Clearly communicate when content is unavailable offline.

### Support offline saved articles

- [ ] Let users explicitly download a saved article for offline reading.
- [ ] Store sanitized article content and required metadata locally.
- [ ] Cache essential article images within a defined size budget.
- [ ] Show offline availability in the library.
- [ ] Allow downloaded content to be removed.
- [ ] Define storage limits and eviction behavior.
- [ ] Refresh stale offline articles on demand.

**Acceptance criteria**

- Lemma’s shell opens without a network connection after the first visit.
- Explicitly downloaded articles remain readable offline.
- Users can see and control how much offline content is stored.

---

## Testing and quality

### Establish a test suite

- [x] Add a unit-test runner compatible with SvelteKit and TypeScript.
- [x] Add DOM support for article parser tests.
- [ ] Add browser-level end-to-end tests for critical flows.
- [ ] Add `test`, `test:unit`, and `test:e2e` scripts.
- [ ] Run tests and type checks in CI.

### Test article parsing with fixtures

- [x] Add a fixture for an ordinary article.
- [ ] Add a fixture for a redirect.
- [x] Add fixtures with nested headings.
- [ ] Add fixtures for references and repeated citations.
- [x] Add fixtures for ordered, unordered, and nested lists.
- [ ] Add fixtures for images and galleries.
- [ ] Add an infobox-heavy article fixture.
- [ ] Add a missing-page response fixture.
- [x] Add fixtures with internal, external, section, and red links.
- [x] Verify unwanted markup and unsafe attributes are removed.

### Test article navigation utilities

- [x] Test heading ancestry.
- [x] Test block ancestry.
- [x] Test collapsible heading detection.
- [x] Test hidden blocks for collapsed sections.
- [x] Test malformed or skipped heading levels.

### Add component and end-to-end coverage

- [ ] Test search keyboard navigation.
- [ ] Test search loading, error, empty, and no-results states.
- [ ] Test the search-to-article flow.
- [ ] Test following an internal article link.
- [ ] Test same-page section navigation.
- [ ] Test collapsing and expanding sections.
- [ ] Test bookmarking and removing an article.
- [ ] Test history and reading-position restoration.
- [ ] Test preference persistence.
- [ ] Test mobile viewport behavior.

### Add accessibility checks

- [x] Verify heading hierarchy.
- [ ] Verify all interactive controls are keyboard accessible.
- [ ] Verify visible focus states.
- [x] Verify search combobox/listbox semantics.
- [ ] Announce loading, error, and copy-success states appropriately.
- [ ] Check color contrast in light and dark themes.
- [ ] Test at increased browser zoom and text size.
- [ ] Test with reduced motion enabled.

---

## Engineering and maintenance

### Improve observability without compromising privacy

- [ ] Add useful development-only logs for failed parsing and API responses.
- [ ] Avoid logging article history or search terms in production by default.
- [ ] If analytics are ever added, make them privacy-preserving and clearly documented.
- [ ] Add an optional diagnostics view for local troubleshooting.

### Add continuous integration

- [ ] Run `bun run check` for pull requests.
- [ ] Run unit and end-to-end tests.
- [ ] Build the production app.
- [ ] Add dependency update automation if desired.
- [x] Keep deployment adapter configuration explicit.

### Keep documentation current

- [ ] Document local storage behavior and privacy guarantees.
- [ ] Document supported Wikipedia languages.
- [ ] Document offline storage behavior and limits.
- [x] Add architecture notes for parsing and link rewriting.
- [x] Keep the README structure in sync with the project.

---

## Suggested implementation order

1. [x] Robust API errors, typed responses, cancellation, and retry UI.
2. [x] Sanitization and normalization of article HTML.
3. [x] Internal article links, section links, and citation navigation.
4. [x] Parser fixtures and navigation utility tests.
5. [ ] Local persistence foundation.
6. [ ] Reading history and recent articles.
7. [ ] Bookmarks and the `/library` page.
8. [ ] Scroll progress and resume reading.
9. [ ] Themes, typography controls, and reduced-motion support.
10. [ ] Language selection and interlanguage navigation.
11. [ ] Search history, random article, and command palette.
12. [ ] Sharing, metadata, and print styles.
13. [ ] PWA shell and explicitly downloaded offline articles.
14. [ ] Broader accessibility, end-to-end, and CI coverage.

## Product ideas to evaluate later

These may be valuable, but should follow the core private-reader milestones:

- [ ] Export and import bookmarks/history as JSON.
- [ ] Generate a reading list that can be shared without exposing full history.
- [ ] Add optional article notes or highlights stored only on-device.
- [ ] Add related-article recommendations sourced directly from Wikipedia.
- [ ] Add a distraction-free fullscreen reading mode.
- [ ] Add configurable keyboard shortcuts.
- [ ] Support additional Wikimedia projects where the parser is compatible.
