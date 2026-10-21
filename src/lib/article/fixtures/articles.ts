// Trimmed but structurally faithful samples of `action=parse` output from en.wikipedia.org.

const thumb = (file: string, width: number, extra = "") =>
  `//thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/${width}px-${file}${extra}?utm_source=en.wikipedia.org`;

export const ORDINARY_ARTICLE = `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr">
<style data-mw-deduplicate="TemplateStyles:r1">.mw-parser-output .hatnote{font-style:italic}</style><div role="note" class="hatnote navigation-not-searchable">For other uses, see <a href="/wiki/Pi_(disambiguation)">Pi (disambiguation)</a>.</div>
<div class="shortdescription nomobile noexcerpt noprint searchaux" style="display:none">Mathematical constant</div>
<table class="infobox"><tbody><tr><td><img src="${thumb("Infobox.jpg", 220)}" width="220" height="150" data-file-width="2000" /></td></tr></tbody></table>
<figure class="mw-default-size mw-halign-right skin-invert-image" typeof="mw:File/Thumb"><a href="/wiki/File:Lead.svg" class="mw-file-description"><img alt="A diagram of a circle" src="${thumb("Lead.svg", 250, ".png")}" width="250" height="249" class="mw-file-element" srcset="${thumb("Lead.svg", 500, ".png")} 2x" data-file-width="512" data-file-height="510" /></a><figcaption>The <a href="/wiki/Circumference">circumference</a> of a circle.</figcaption></figure>
<p>The number <b>π</b> is a <a href="/wiki/Mathematical_constant">mathematical constant</a> that is the ratio of a <a href="/wiki/Circle">circle</a>'s circumference to its diameter.<sup id="cite_ref-1" class="reference"><a href="#cite_note-1"><span class="cite-bracket">[</span>1<span class="cite-bracket">]</span></a></sup><style data-mw-deduplicate="TemplateStyles:r2">.mw-parser-output .frac{white-space:nowrap}</style> It is approximately <span class="frac">22/7</span>.<style data-mw-deduplicate="TemplateStyles:r3">.x{}</style> See also <a href="https://www.example.com/pi" class="external text">an external page</a> and <a href="/w/index.php?title=Unwritten_topic&amp;action=edit&amp;redlink=1" class="new" title="Unwritten topic (page does not exist)">an unwritten topic</a>.</p>
<p>Inline math <span class="mwe-math-element"><span class="mwe-math-mathml-inline mwe-math-mathml-a11y" style="display: none;"><math><mi>x</mi></math></span><img src="https://wikimedia.org/api/rest_v1/media/math/render/svg/abc" class="mwe-math-fallback-image-inline mw-invert skin-invert" aria-hidden="true" alt="x" /></span> stays inside its paragraph. <a href="/wiki/Category:Real_numbers">Category link</a>, <a href="/wiki/Help:IPA">help link</a>, <a href="//fr.wikipedia.org/wiki/Pi" class="extiw">French</a>.</p>
<div class="mw-heading mw-heading2"><h2 id="Fundamentals">Fundamentals</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Pi&amp;action=edit&amp;section=1">edit</a><span class="mw-editsection-bracket">]</span></span></div>
<div class="mw-heading mw-heading3"><h3 id="Name">Name</h3></div>
<p>The symbol used by mathematicians.<img src="x" onerror="window.__xss = true" /></p>
<ul><li>First item with <a href="/wiki/Euler%27s_identity#Explanation">a section link</a><ul><li>Nested item</li></ul></li><li>Second item <img src="${thumb("Tiny.png", 20)}" width="20" height="20" /></li></ul>
<div class="mw-heading mw-heading4"><h4 id="Früher_Gebrauch">Früher Gebrauch</h4></div>
<p>Deep content.</p>
<div class="mw-heading mw-heading5"><h5 id="Footnote_heading">Footnote heading</h5></div>
<p>Under an H5.</p>
<div class="mw-heading mw-heading2"><h2 id="Data">Data</h2></div>
<table class="wikitable"><caption>Digits</caption><tbody><tr><th>n</th><th>Digit</th></tr><tr><td>1</td><td><p>3</p></td></tr></tbody></table>
<table class="multicol"><tbody><tr><td><p>Layout table paragraph</p></td></tr></tbody></table>
<figure typeof="mw:File/Thumb"><a href="/wiki/File:Small.jpg"><img alt="" src="${thumb("Small.jpg", 250)}" srcset="${thumb("Small.jpg", 500)} 2x" width="250" height="200" data-file-width="600" /></a><figcaption></figcaption></figure>
<figure typeof="mw:File/Thumb"><a href="/wiki/File:Big.jpg"><img alt="Big photo" src="${thumb("Big.jpg", 250)}" width="250" height="180" data-file-width="4000" /></a><figcaption>A big photo</figcaption></figure>
<div class="legend"><span><a href="/wiki/File:Marker.svg"><img src="${thumb("Marker.svg", 20, ".png")}" width="8" height="13" data-file-width="100" /></a></span></div>
<blockquote><p>A quotation paragraph.</p></blockquote>
<div class="mw-heading mw-heading2"><h2 id="References">References</h2></div>
<div class="reflist"><div class="mw-references-wrap"><ol class="references"><li id="cite_note-1"><span class="mw-cite-backlink"><b><a href="#cite_ref-1">^</a></b></span> <span class="reference-text">A source with <a href="https://example.org/book" class="external text">a link</a>.</span></li></ol></div></div>
<div class="navbox"><p>Navigation box paragraph</p></div>
<p class="mw-empty-elt"></p>
</div>`;

export const DUPLICATE_HEADINGS = `<div class="mw-parser-output">
<div class="mw-heading mw-heading2"><h2 id="History">History</h2></div><p>One.</p>
<div class="mw-heading mw-heading2"><h2>History</h2></div><p>Two.</p>
<div class="mw-heading mw-heading2"><h2 id="  "> </h2></div><p>Three.</p>
</div>`;

export const SKIPPED_LEVELS = `<div class="mw-parser-output">
<h2 id="A">A</h2><p>a</p>
<h4 id="A_deep">A deep</h4><p>a deep</p>
<h3 id="A_mid">A mid</h3><p>a mid</p>
<h2 id="B">B</h2><p>b</p>
</div>`;

export const INFOBOX_ARTICLE = `<div class="mw-parser-output">
<table class="infobox ib-country vcard"><tbody>
<tr><th colspan="2" class="infobox-above"><div class="fn org country-name">Republic of Poland</div><div class="ib-country-names"><i>Rzeczpospolita Polska</i></div></th></tr>
<tr><td colspan="2" class="infobox-image"><a href="/wiki/File:Flag_of_Poland.svg" class="mw-file-description"><img alt="Flag" src="${thumb("Flag.svg", 125, ".png")}" width="125" height="78" data-file-width="1280" /></a><div class="infobox-caption"><a href="/wiki/Flag_of_Poland">Flag</a></div></td></tr>
<tr><td colspan="2" class="infobox-full-data"><span class="mw-tmh-player audio"><audio src="anthem.ogg"></audio></span>Anthem</td></tr>
<tr><td colspan="2" class="infobox-full-data"><div class="switcher-container"><div><img alt="Globe" src="${thumb("Globe.svg", 250, ".png")}" width="250" height="250" data-file-width="2000" /><span class="switcher-label">Show globe</span></div><div><img alt="Map of Europe" src="${thumb("Europe.svg", 250, ".png")}" width="250" height="200" data-file-width="2000" /><span class="switcher-label">Show map of Europe</span></div></div></td></tr>
<tr><th scope="row" class="infobox-label">Capital</th><td class="infobox-data"><a href="/wiki/Warsaw">Warsaw</a><br /><img src="${thumb("Coords.svg", 16, ".png")}" width="16" height="16" /></td></tr>
<tr><th colspan="2" class="infobox-header">Government</th></tr>
<tr><th scope="row" class="infobox-label">• President</th><td class="infobox-data"><a href="/wiki/Karol_Nawrocki">Karol Nawrocki</a></td></tr>
<tr><th scope="row" class="infobox-label">Regional languages</th><td class="infobox-data"><div class="collapsible-list mw-collapsible mw-collapsed"><div><div>List</div></div><ul class="mw-collapsible-content"><li>German<br />Belarusian<br />Lithuanian</li></ul></div></td></tr>
<tr><th scope="row" class="infobox-label">Cities</th><td class="infobox-data"><div class="collapsible-list mw-collapsible mw-collapsed"><div><div>Major cities</div></div><ul class="mw-collapsible-content"><li>A</li><li>B</li><li>C</li><li>D</li><li>E</li><li>F</li><li>G</li></ul></div></td></tr>
<tr style="display:none"><th class="infobox-label">Hidden</th><td class="infobox-data">secret</td></tr>
<tr><td colspan="2"></td></tr>
</tbody></table>
<p>Poland is a country.</p>
</div>`;
