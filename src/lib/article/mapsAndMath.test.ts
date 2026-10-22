import { describe, expect, it } from "vitest";
import { extractSisterLinks, extractSpokenAudio } from "./articleExtras";
import { convertMaps, findArticleCoordinates, openStreetMapUrl, readGeo, tintMath } from "./mapsAndMath";

const html = (markup: string) => {
  const root = document.createElement("div");
  root.innerHTML = markup;
  return root;
};

const COORD = `<a class="external text" href="https://geohack.toolforge.org/geohack.php?params=48_51_N_2_17_E"
  ><span class="geo-default">48°51′N 2°17′E</span><span style="display:none"><span class="geo">48.858222; 2.294500</span></span></a>`;

describe("coordinates", () => {
  it("reads {{coord}}'s decimal pair and rejects nonsense", () => {
    expect(readGeo(html('<span class="geo">48.858222; 2.294500</span>'))).toEqual({ lat: 48.858222, lon: 2.2945 });
    expect(readGeo(html('<span class="geo">-33.9; 18.4</span>'))).toEqual({ lat: -33.9, lon: 18.4 });
    expect(readGeo(html('<span class="geo">95; 10</span>'))).toBeNull();
    expect(readGeo(null)).toBeNull();
  });

  it("only takes the subject's coordinates (title or infobox), not any in the text", () => {
    expect(findArticleCoordinates(html(`<p>${COORD}</p>`))).toBeNull();
    expect(findArticleCoordinates(html(`<table class="infobox"><tr><td>${COORD}</td></tr></table>`))).toEqual({ lat: 48.858222, lon: 2.2945 });
  });

  it("builds OpenStreetMap links with a marker", () => {
    expect(openStreetMapUrl({ lat: 48.858222, lon: 2.2945 }, 16)).toBe(
      "https://www.openstreetmap.org/?mlat=48.858222&mlon=2.2945#map=16/48.858222/2.2945",
    );
  });
});

describe("convertMaps", () => {
  it("points coordinate links at OpenStreetMap", () => {
    const root = html(COORD);
    convertMaps(root, null);
    expect(root.querySelector("a")!.getAttribute("href")).toBe(openStreetMapUrl({ lat: 48.858222, lon: 2.2945 }));
  });

  it("turns a mapframe into a sharp, linked map that isn't an image for the viewer", () => {
    const root = html(`<a class="mw-kartographer-map mw-file-description" data-zoom="16"
      ><img class="mw-file-element" src="https://maps.wikimedia.org/img/osm-intl,16,a,a,250x200.png?lang=en" srcset="x 2x" width="250" height="200"></a>`);
    convertMaps(root, { lat: 1, lon: 2 });
    const frame = root.querySelector("a.map-frame")!;
    expect(frame.getAttribute("href")).toBe(openStreetMapUrl({ lat: 1, lon: 2 }, 16));
    expect(frame.querySelector("img")!.className).toBe("map-image");
    expect(frame.querySelector("img")!.getAttribute("src")).toContain("250x200@2x.png");
    expect(frame.querySelector("img")!.hasAttribute("srcset")).toBe(false);
    expect(frame.textContent).toBe("Open map");
  });

  it("leaves a map without a known position unlinked", () => {
    const root = html(`<span class="mw-kartographer-map"><img src="https://maps.wikimedia.org/img/osm-intl,9,a,a,300x300.png"></span>`);
    convertMaps(root, null);
    expect(root.querySelector("span.map-frame img.map-image")).not.toBeNull();
    expect(root.querySelector("a")).toBeNull();
  });
});

it("tints Wikipedia's formula pictures, and only those", () => {
  const root = html(`
    <img class="mwe-math-fallback-image-inline mw-invert" src="https://wikimedia.org/api/rest_v1/media/math/render/svg/abc123">
    <img class="mwe-math-fallback-image-inline" src="https://evil.example/x.svg">`);
  tintMath(root);
  const [formula, other] = root.querySelectorAll("img");
  expect(formula.classList.contains("math-tinted")).toBe(true);
  expect(formula.classList.contains("mw-invert")).toBe(false);
  expect(formula.style.getPropertyValue("--math-src")).toContain("render/svg/abc123");
  expect(other.classList.contains("math-tinted")).toBe(false);
});

it("takes the Spoken Wikipedia recording out of the text", () => {
  const root = html(`<div class="spoken-wikipedia"><span class="duration"><span class="min">50</span> minutes</span>
    <audio><source src="//upload.wikimedia.org/a.oga" type="audio/ogg"><source src="//upload.wikimedia.org/a.mp3" type="audio/mpeg"></audio>
    <div class="spoken-wikipedia-disclaimer">This audio file is based on a version from this article dated 19 October 2006 (2006-10-19), and does not reflect subsequent edits.</div></div><p>Text</p>`);
  expect(extractSpokenAudio(root)).toEqual({
    sources: [
      { src: "https://upload.wikimedia.org/a.oga", type: "audio/ogg" },
      { src: "https://upload.wikimedia.org/a.mp3", type: "audio/mpeg" },
    ],
    minutes: 50,
    recorded: "19 October 2006",
  });
  expect(root.querySelector(".spoken-wikipedia")).toBeNull();
  expect(extractSpokenAudio(root)).toBeNull();
});

it("collects one link per sister project, in a fixed order", () => {
  const root = html(`<div class="side-box"><a href="https://en.wikiquote.org/wiki/Special:Search/Douglas_Adams">quotes</a></div>
    <div class="sistersitebox"><a href="/wiki/Portal:Books">portal</a>
      <a href="https://en.wiktionary.org/wiki/Special:Search/Adams">Definitions</a>
      <a href="//commons.wikimedia.org/wiki/Category:Douglas_Adams">Media</a>
      <a href="https://en.wikiquote.org/wiki/Other">again</a></div>`);
  expect(extractSisterLinks(root)).toEqual([
    { project: "Wiktionary", description: "Definitions", url: "https://en.wiktionary.org/wiki/Special:Search/Adams" },
    { project: "Wikiquote", description: "Quotations", url: "https://en.wikiquote.org/wiki/Special:Search/Douglas_Adams" },
    { project: "Wikimedia Commons", description: "Media", url: "https://commons.wikimedia.org/wiki/Category:Douglas_Adams" },
  ]);
});
