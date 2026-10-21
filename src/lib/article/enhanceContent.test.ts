import { describe, expect, it } from "vitest";
import { compareKeys, enhanceContent, numericValue, sortKey } from "./enhanceContent";

function render(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  enhanceContent(container);
  return container;
}

const column = (table: Element, index: number) =>
  [...table.querySelectorAll("tbody tr")].slice(1).map((row) => (row as HTMLTableRowElement).cells[index]?.textContent?.trim());

describe("sort keys", () => {
  it("reads numbers in common formats", () => {
    expect(numericValue("1,234.5")).toBe(1234.5);
    expect(numericValue("−12 %")).toBe(-12);
    expect(numericValue("$3.4")).toBe(3.4);
    expect(numericValue("45 km")).toBe(45);
    expect(numericValue("Ada Lovelace")).toBeNull();
  });

  it("prefers data-sort-value and ignores footnotes", () => {
    const cell = document.createElement("td");
    cell.innerHTML = 'Ten<sup class="reference">[1]</sup>';
    expect(sortKey(cell)).toBe("Ten");
    cell.setAttribute("data-sort-value", "10");
    expect(sortKey(cell)).toBe("10");
  });

  it("compares numbers numerically and text naturally, empties last", () => {
    expect(["10", "9", "100"].sort(compareKeys)).toEqual(["9", "10", "100"]);
    expect(["b", "", "A"].sort(compareKeys)).toEqual(["A", "b", ""]);
  });
});

describe("sortable tables", () => {
  const table = render(`<table class="wikitable sortable"><tbody>
    <tr><th>Name</th><th>Value</th><th class="unsortable">Note</th></tr>
    <tr><td>b</td><td>2</td><td>x</td></tr>
    <tr><td>a</td><td>10</td><td>y</td></tr>
    <tr><td>c</td><td>1</td><td>z</td></tr>
    <tr class="sortbottom"><td>Total</td><td>13</td><td></td></tr>
  </tbody></table>`).querySelector("table")!;

  it("adds sort buttons to sortable headers only", () => {
    expect(table.querySelectorAll("th .sort-button").length).toBe(2);
    expect(table.querySelector("th.unsortable .sort-button")).toBeNull();
  });

  it("sorts numerically, toggles direction, and keeps totals at the bottom", () => {
    const [, value] = table.querySelectorAll<HTMLButtonElement>(".sort-button");
    value.click();
    expect(column(table, 1)).toEqual(["1", "2", "10", "13"]);
    expect(table.rows[0].cells[1].getAttribute("aria-sort")).toBe("ascending");
    value.click();
    expect(column(table, 1)).toEqual(["10", "2", "1", "13"]);
    expect(table.rows[0].cells[1].getAttribute("aria-sort")).toBe("descending");
  });
});

it("leaves tables split into sections unsortable", () => {
  const table = render(`<table class="wikitable sortable"><tbody>
    <tr><th>Group</th><th>Share</th></tr>
    <tr><td colspan="2">Section</td></tr>
    <tr><td>a</td><td>1</td></tr></tbody></table>`).querySelector("table")!;
  expect(table.querySelector(".sort-button")).toBeNull();
});

it("sorts tables with two-row headers, row headers and merged cells", () => {
  const table = render(`<table class="wikitable sortable"><tbody>
    <tr><th rowspan="2">City</th><th colspan="2">Population</th></tr>
    <tr><th>City proper</th><th>Metro</th></tr>
    <tr><th>Tokyo</th><td>14</td><td rowspan="2">37</td></tr>
    <tr><th>Yokohama</th><td>3.7</td></tr>
    <tr><th>Delhi</th><td>16</td><td>32</td></tr>
  </tbody></table>`).querySelector("table")!;
  const buttons = [...table.querySelectorAll<HTMLButtonElement>(".sort-button")].map((b) => b.textContent);
  // the grouping cell ("Population") isn't sortable; the columns under it are
  expect(buttons).toEqual(["City", "City proper", "Metro"]);
  const metro = [...table.querySelectorAll<HTMLButtonElement>(".sort-button")][2];
  metro.click();
  const order = () => [...table.querySelectorAll("tbody tr")].slice(2).map((row) => row.querySelector("th")!.textContent);
  expect(order()).toEqual(["Delhi", "Tokyo", "Yokohama"]);
  // the merged "37" was split so both rows keep their value
  expect([...table.querySelectorAll<HTMLTableRowElement>("tbody tr")].slice(2).map((row) => row.cells[2].textContent)).toEqual(["32", "37", "37"]);
  [...table.querySelectorAll<HTMLButtonElement>(".sort-button")][1].click();
  expect(order()).toEqual(["Yokohama", "Tokyo", "Delhi"]);
});

describe("collapsible content", () => {
  it("starts collapsed tables collapsed and toggles them", () => {
    const table = render(`<table class="wikitable mw-collapsible mw-collapsed"><tbody>
      <tr><th>Results</th></tr><tr><td>one</td></tr><tr><td>two</td></tr></tbody></table>`).querySelector("table")!;
    const toggle = table.querySelector<HTMLButtonElement>(".collapse-toggle")!;
    expect(toggle.textContent).toBe("Show");
    expect([...table.rows].slice(1).every((row) => row.hidden)).toBe(true);
    expect(table.rows[0].hidden).toBe(false);
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect([...table.rows].some((row) => row.hidden)).toBe(false);
  });

  it("collapses a div's content block", () => {
    const div = render(`<div class="mw-collapsible mw-collapsed"><div>Heading</div><div class="mw-collapsible-content">Body</div></div>`)
      .querySelector(".mw-collapsible")!;
    expect(div.querySelector<HTMLElement>(".mw-collapsible-content")!.hidden).toBe(true);
    div.querySelector<HTMLButtonElement>(".collapse-toggle")!.click();
    expect(div.querySelector<HTMLElement>(".mw-collapsible-content")!.hidden).toBe(false);
  });
});
