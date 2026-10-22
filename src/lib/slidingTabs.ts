/**
 * A segmented control's highlight that slides to the selected tab instead of jumping. Put it on the tablist; it adds
 * one `.tab-indicator` behind the tabs and moves it to whichever has aria-selected="true", whenever `selected`
 * changes (pass the selected value so Svelte re-runs the update) or the tabs resize. Styles: `.tab-indicator` in
 * app.css; the tabs themselves should have no selected background of their own.
 */
export function slidingTabs(node: HTMLElement, _selected: unknown) {
  const indicator = document.createElement("span");
  indicator.className = "tab-indicator";
  indicator.setAttribute("aria-hidden", "true");
  node.prepend(indicator);

  function place() {
    const tab = node.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    indicator.hidden = !tab;
    if (!tab) return;
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.height = `${tab.offsetHeight}px`;
    indicator.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
  }

  // the first placement shouldn't slide in from the corner
  place();
  requestAnimationFrame(() => indicator.classList.add("ready"));

  const observer = new ResizeObserver(place);
  observer.observe(node);

  return {
    // after the rest of this update has rendered: the tabs' aria-selected may change after this runs
    update: () => queueMicrotask(place),
    destroy() {
      observer.disconnect();
      indicator.remove();
    },
  };
}
