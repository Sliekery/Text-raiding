// ==UserScript==
// @name         Reddit Subreddit Filter
// @namespace    reddit-sub-filter
// @version      1.0.0
// @description  Hides posts from subreddits you choose (exact names + name patterns) on new, old and mobile-web Reddit.
// @match        https://www.reddit.com/*
// @match        https://old.reddit.com/*
// @match        https://new.reddit.com/*
// @match        https://sh.reddit.com/*
// @match        https://reddit.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // SETTINGS — edit these lists to taste. Names are case-insensitive, no "r/".
  // ---------------------------------------------------------------------------

  // Exact subreddit names to hide.
  const BLOCKED_SUBS = [
    // national / news / discussion
    'india', 'indiaspeaks', 'indiasocial', 'indianews', 'indiadiscussion',
    'indiaopen', 'indiannews', 'unitedstatesofindia', 'librandu', 'chodi',
    'bakchodi', 'indiapolitics', 'indianmodels',
    // memes / humour
    'indiandankmemes', 'indianpeoplefacebook', 'indianpeoplequora',
    'dankindianmemes', 'desimemes', 'sharktankindia', 'indiameme',
    // money / tech / jobs
    'indiainvestments', 'indianstockmarket', 'indianstreetbets',
    'developersindia', 'indiatech', 'personalfinanceindia', 'fireindia',
    'creditcardsindia', 'indianworkplace', 'indiancareers',
    // entertainment / sport
    'bollywood', 'bollyblindsngossip', 'bollywoodmemes', 'tollywood',
    'kollywood', 'indiancinema', 'indiacricket', 'indiangaming',
    'indianteenagers', 'indianaesthetic', 'indianfood', 'indiatravel',
    // diaspora
    'desi', 'abcdesis', 'nri', 'indianamerican',
    // cities / states
    'bangalore', 'bengaluru', 'mumbai', 'delhi', 'newdelhi', 'hyderabad',
    'chennai', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'lucknow', 'kochi',
    'chandigarh', 'gurgaon', 'noida', 'goa', 'kerala', 'tamilnadu',
    'karnataka', 'gujarat', 'maharashtra', 'telangana', 'andhrapradesh',
    'westbengal', 'bihar', 'uttarpradesh', 'odisha', 'assam', 'rajasthan',
  ];

  // Name patterns: a subreddit whose name matches any of these is hidden.
  // "india" skips names continuing with "na" (indiana, indianapolis,
  // indianajones). Add names to ALLOWED_SUBS if something gets caught wrongly.
  const BLOCKED_PATTERNS = [
    /india(?!na)/i,
    /bharat/i,
    /hindi/i,
    /bollywood/i,
  ];

  // Never hidden, even if a list or pattern above matches.
  const ALLOWED_SUBS = [];

  // true  = remove posts completely
  // false = collapse them into a small "hidden r/xyz" bar you can tap to reveal
  const HIDE_COMPLETELY = true;

  // ---------------------------------------------------------------------------

  const blocked = new Set(BLOCKED_SUBS.map((s) => s.toLowerCase()));
  const allowed = new Set(ALLOWED_SUBS.map((s) => s.toLowerCase()));
  const MARK = 'data-rsf-checked';
  let hiddenCount = 0;

  function normalize(name) {
    if (!name) return '';
    return String(name).trim().replace(/^\/?r\//i, '').replace(/\/.*$/, '').toLowerCase();
  }

  function isBlocked(name) {
    const sub = normalize(name);
    if (!sub || allowed.has(sub)) return false;
    if (blocked.has(sub)) return true;
    return BLOCKED_PATTERNS.some((re) => re.test(sub));
  }

  function hide(el, sub) {
    hiddenCount++;
    if (HIDE_COMPLETELY) {
      el.style.setProperty('display', 'none', 'important');
      return;
    }
    el.style.setProperty('display', 'none', 'important');
    const bar = document.createElement('div');
    bar.textContent = 'Hidden post from r/' + sub + ' (tap to show)';
    bar.style.cssText =
      'font:12px sans-serif;opacity:.6;padding:6px 12px;cursor:pointer;';
    bar.addEventListener('click', () => {
      el.style.removeProperty('display');
      bar.remove();
    });
    el.parentNode && el.parentNode.insertBefore(bar, el);
  }

  // Finds a subreddit name inside an element when no attribute carries it.
  function subFromLinks(el) {
    const link = el.querySelector('a[href^="/r/"], a[href*="reddit.com/r/"]');
    if (!link) return '';
    const m = link.getAttribute('href').match(/\/r\/([^/?#]+)/i);
    return m ? m[1] : '';
  }

  // The outermost wrapper of a feed item, so no empty gap is left behind.
  function container(el) {
    return el.closest('article') || el;
  }

  function check(el, getName) {
    if (el.hasAttribute(MARK)) return;
    const name = getName(el);
    if (!name) return; // not rendered yet; try again on the next mutation
    el.setAttribute(MARK, '');
    if (isBlocked(name)) hide(container(el), normalize(name));
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;

    // New Reddit / mobile web ("shreddit") posts in feeds and search results.
    root.querySelectorAll('shreddit-post:not([' + MARK + '])').forEach((el) =>
      check(el, (p) =>
        p.getAttribute('subreddit-name') ||
        p.getAttribute('subreddit-prefixed-name') ||
        subFromLinks(p)
      )
    );

    // Cross-posts and other shreddit cards that carry the sub as an attribute.
    root
      .querySelectorAll('[subreddit-prefixed-name]:not(shreddit-post):not([' + MARK + '])')
      .forEach((el) => {
        if (el.closest('shreddit-post')) return;
        check(el, (p) => p.getAttribute('subreddit-prefixed-name'));
      });

    // Old Reddit.
    root.querySelectorAll('.thing[data-subreddit]:not([' + MARK + '])').forEach((el) =>
      check(el, (p) => p.getAttribute('data-subreddit'))
    );

    // Community recommendations / search result rows that link to a sub.
    root
      .querySelectorAll(
        '[data-testid="search-community"]:not([' + MARK + ']), ' +
          'community-recommendation:not([' + MARK + '])'
      )
      .forEach((el) => check(el, subFromLinks));
  }

  // If you open a blocked sub directly, leave it alone — that was on purpose.
  const here = location.pathname.match(/^\/r\/([^/]+)/i);
  if (here && isBlocked(here[1])) return;

  // Infinite scroll keeps adding posts; rescan at most once per frame.
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan(document);
    });
  });

  function start() {
    scan(document);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['subreddit-name', 'subreddit-prefixed-name', 'data-subreddit'],
    });
  }

  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start);

  window.__redditSubFilter = { isBlocked, count: () => hiddenCount };
})();
