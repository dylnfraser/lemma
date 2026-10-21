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
<tr><td colspan="2" class="infobox-full-data"><table><tbody>
<tr><td style="text-align:center"><div id="before-after"></div> <b>Preceded by</b></td><td><b>Succeeded by</b></td></tr>
<tr><td><table><tbody><tr><td><img src="${thumb("Flag_A.svg", 20, ".png")}" width="20" height="13" /></td><td><a href="/wiki/Kingdom_of_Poland">Kingdom of Poland</a></td></tr><tr><td><img src="${thumb("Flag_B.svg", 20, ".png")}" width="20" height="12" /></td><td><a href="/wiki/German_Empire">German Empire</a></td></tr></tbody></table></td>
<td><table><tbody><tr><td><a href="/wiki/Soviet_Union">Soviet Union</a></td><td><img src="${thumb("Flag_C.svg", 20, ".png")}" width="20" height="13" /></td></tr></tbody></table></td></tr>
</tbody></table></td></tr>
<tr style="display:none"><th class="infobox-label">Hidden</th><td class="infobox-data">secret</td></tr>
<tr><td colspan="2"></td></tr>
</tbody></table>
<p>Poland is a country.</p>
</div>`;

export const EDIT_AFFORDANCES = `<div class="mw-parser-output">
<table class="infobox biota"><tbody>
<tr><th colspan="2">Rusty patched bumble bee<span class="plainlinks taxobox-edit-taxonomy"><a href="/wiki/Template:Taxonomy/Bombus" title="Edit this classification"><img alt="Edit this classification" src="${thumb("Red_Pencil_Icon.png", 16, "")}" width="16" height="16" /></a></span></th></tr>
<tr><th scope="row">Website</th><td><a href="https://example.org">example.org</a><span class="noprint"><a href="https://www.wikidata.org/wiki/Q1#P856" title="Edit this at Wikidata"><img alt="Edit this at Wikidata" src="${thumb("OOjs_UI_icon_edit-ltr.svg", 10, ".png")}" width="10" height="10" /></a></span></td></tr>
</tbody></table>
<div class="mw-heading mw-heading2"><h2 id="History">History</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=Bee&amp;action=edit&amp;section=1">edit</a><span class="mw-editsection-bracket">]</span></span></div>
<p>Bees numbered 40 as of 2020<sup class="plainlinks noexcerpt noprint asof-tag update" style="display:none;"><a href="//en.wikipedia.org/w/index.php?title=Bee&amp;action=edit">[update]</a></sup> and <a href="/w/index.php?title=Unwritten_bee&amp;action=edit&amp;redlink=1">an unwritten bee</a>.</p>
<ul class="references"><li id="cite_note-1"><cite>Bee book.</cite><span class="cs1-maint citation-comment"><code class="cs1-code">{{<a href="/wiki/Template:Cite_book" title="Template:Cite book">cite book</a>}}</code>: CS1 maint: multiple names</span></li></ul>
<div class="sidebar"><div class="sidebar-navbar"><a href="/wiki/Template:Bees" title="View this template">v</a></div></div>
<div class="navbar plainlinks hlist"><a href="/wiki/Template:Bees"><abbr title="Edit this template">e</abbr></a></div>
<ul><li><a href="https://example.org">Official website</a> <span class="noprint"><a href="https://www.wikidata.org/wiki/Q1#P856" title="Edit this at Wikidata"><img alt="Edit this at Wikidata" src="${thumb("OOjs_UI_icon_edit-ltr.svg", 10, ".png")}" width="10" height="10" /></a></span></li></ul>
<p>Edith the bee <img alt="Edith Bee portrait" src="${thumb("Edith.jpg", 20, "")}" width="20" height="20" /></p>
</div>`;

export const GALLERY_ARTICLE = `<div class="mw-parser-output">
<p>Some <a href="/wiki/Bridges">bridges</a>.</p>
<ul class="gallery mw-gallery-traditional">
<li class="gallerybox"><div class="thumb"><span typeof="mw:File"><a href="/wiki/File:Bridge.jpg" class="mw-file-description"><img alt="A stone bridge" src="${thumb("Bridge.jpg", 120)}" width="120" height="90" data-file-width="3000" /></a></span></div><div class="gallerytext">The <a href="/wiki/Old_Bridge">Old Bridge</a></div></li>
<li class="gallerybox"><div class="thumb"><span typeof="mw:File"><a href="/wiki/File:Bridge_plan.svg" class="mw-file-description"><img alt="" src="${thumb("Bridge_plan.svg", 120, ".png")}" width="120" height="90" data-file-width="800" /></a></span></div><div class="gallerytext">Its plan</div></li>
</ul>
<figure typeof="mw:File/Thumb"><img alt="A map" src="${thumb("Map.png", 250)}" width="250" height="200" data-file-width="2000" /><figcaption>A map</figcaption></figure>
<figure class="skin-invert-image" typeof="mw:File/Thumb"><img alt="A graph" src="${thumb("Graph.svg", 250, ".png")}" width="250" height="200" data-file-width="500" /><figcaption></figcaption></figure>
</div>`;

export const LEGEND_ARTICLE = `<div class="mw-parser-output">
<figure typeof="mw:File/Thumb"><img alt="A map" src="${thumb("Euro_map.svg", 250, ".png")}" width="250" height="200" data-file-width="2000" /><figcaption>Eurozone participation
<div class="legend"><span class="legend-color" style="background-color:#039;">&#160;</span>&#160;21 in the <a href="/wiki/Eurozone">eurozone</a></div>
<div class="legend"><span class="legend-color" style="background-color:#fc0;">&#160;</span>&#160;5 not in <a href="/wiki/ERM_II">ERM II</a>, but committed</div>
<i>Non-EU member states</i>
<div class="legend"><span class="legend-color" style="background-color:#f90;">&#160;</span>&#160;4 using the euro</div></figcaption></figure>
<p>The euro is a currency.</p>
</div>`;

export const EXTRAS_ARTICLE = `<div class="mw-parser-output">
<style data-mw-deduplicate="TemplateStyles:r1">.mw-parser-output .quotebox{border:1px solid var(--border-color-base,#a2a9b1);padding:6px}.mw-parser-output .legend-color{width:1.25em}.mw-parser-output .infobox{float:right},.mw-parser-output .hatnote{font-style:italic}@media screen{.mw-parser-output .chess-board td{width:24px}.mw-parser-output .navbox{display:none}}.global-leak{color:red}</style>
<style data-mw-deduplicate="TemplateStyles:r1">.mw-parser-output .quotebox{border:1px solid red}</style>
<div role="note" class="hatnote navigation-not-searchable">Main article: <a href="/wiki/Topic_history">Topic history</a></div>
<p>Topic (<span class="ext-phonos"><span data-ooui="{&quot;href&quot;:&quot;\/\/upload.wikimedia.org\/topic.ogg.mp3&quot;}"><a href="//upload.wikimedia.org/topic.ogg.mp3"></a></span></span>) is a thing.</p>
<div class="thumb tmulti tright"><div class="thumbinner multiimageinner"><div class="trow"><div class="theader">Two views</div></div><div class="trow">
<div class="tsingle"><div class="thumbimage"><span typeof="mw:File"><img alt="Left" src="${thumb("Left.jpg", 200)}" width="200" height="150" data-file-width="2000" /></span></div><div class="thumbcaption">The left view</div></div>
<div class="tsingle"><div class="thumbimage"><span typeof="mw:File"><img alt="Right" src="${thumb("Right.jpg", 200)}" width="200" height="150" data-file-width="2000" /></span></div><div class="thumbcaption">The right view</div></div>
</div><div class="trow"><div class="thumbcaption">Both views, side by side</div></div></div></div>
<div class="thumb tright"><div class="thumbinner"><table class="chess-board"><tbody><tr><td>a</td><td>b</td></tr></tbody></table><div class="thumbcaption">A board</div></div></div>
<figure typeof="mw:File/Thumb"><span><video poster="//upload.wikimedia.org/poster.jpg" controls="" id="mwe_player_0" width="200"><source src="//upload.wikimedia.org/clip.webm" type="video/webm" /><track src="https://commons.wikimedia.org/w/api.php?action=timedtext" kind="subtitles" /></video></span><figcaption>A clip</figcaption></figure>
<div class="haudio"><div class="listen-file-header"><a href="/wiki/File:Theme.ogg">The theme</a></div><div><span typeof="mw:File"><span><audio controls="" preload="none"><source src="//upload.wikimedia.org/theme.ogg" type="audio/ogg" /></audio></span></span></div><div class="description">Played on piano</div></div>
<table role="presentation" class="col-begin"><tbody><tr><td><ul><li><a href="/wiki/Alpha">Alpha</a></li></ul></td><td><ul><li><a href="/wiki/Beta">Beta</a></li></ul></td></tr></tbody></table>
<table class="wikitable sortable mw-collapsible"><tbody><tr><th>Name</th><th>Value</th></tr><tr><td>b</td><td>2</td></tr><tr><td>a</td><td>10</td></tr></tbody></table>
<table class="sidebar"><tbody><tr><td class="sidebar-pretitle">Part of a series on</td></tr><tr><th class="sidebar-title"><a href="/wiki/Topics">Topics</a></th></tr><tr><th class="sidebar-heading">Basics</th></tr><tr><td class="sidebar-content"><ul><li><a href="/wiki/Basic_topic">Basic topic</a></li></ul></td></tr></tbody></table>
<div role="navigation" class="navbox"><table class="nowraplinks"><tbody>
<tr><th colspan="2" class="navbox-title"><div class="navbar"><a href="/wiki/Template:Topic">v</a></div><div><a href="/wiki/Topic">Topic</a></div></th></tr>
<tr><th class="navbox-group">People</th><td class="navbox-list"><ul><li><a href="/wiki/Ada_Lovelace">Ada Lovelace</a></li><li><a href="/wiki/Alan_Turing">Alan Turing</a> <img src="${thumb("Flag.svg", 20, ".png")}" width="20" height="13" /></li></ul></td></tr>
<tr><th class="navbox-group">Works</th><td class="navbox-list"><table class="navbox-subgroup"><tbody><tr><th class="navbox-group">Books</th><td class="navbox-list"><ul><li><a href="/wiki/A_Book">A Book</a></li></ul></td></tr></tbody></table></td></tr>
<tr><td class="navbox-list"><img src="${thumb("Big.jpg", 200)}" width="200" height="150" /><a href="/wiki/Index">Index</a></td></tr>
</tbody></table></div>
</div>`;
