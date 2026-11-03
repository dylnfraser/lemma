/**
 * Wikipedia names some editions with codes that aren't valid language tags: legacy and project codes ("simple" for
 * Simple English, "zh-yue" for Cantonese, "eml" for a retired code). These are their standard (BCP 47) equivalents,
 * as MediaWiki maps them, for `lang` and `hreflang`: screen readers pick a voice by them, and browsers pick glyphs.
 */
const WIKI_TO_BCP47: Record<string, string> = {
  als: "gsw",
  "bat-smg": "sgs",
  "be-x-old": "be-tarask",
  "cbk-zam": "cbk",
  eml: "egl",
  "fiu-vro": "vro",
  "map-bms": "jv-x-bms",
  "nds-nl": "nds-NL",
  nrm: "nrf",
  "roa-rup": "rup",
  simple: "en",
  "zh-classical": "lzh",
  "zh-min-nan": "nan",
  "zh-yue": "yue",
};

/** The language tag for a Wikipedia edition's code. */
export const languageTag = (code: string): string => WIKI_TO_BCP47[code] ?? code;
